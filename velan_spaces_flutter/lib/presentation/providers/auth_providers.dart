import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/core/services/fcm_service.dart';
import 'package:velan_spaces_flutter/data/datasources/auth_datasource.dart';
import 'package:velan_spaces_flutter/data/datasources/firebase_auth_datasource.dart';
import 'package:velan_spaces_flutter/data/repositories/auth_repository_impl.dart';
import 'package:velan_spaces_flutter/domain/repositories/auth_repository.dart';
import 'package:velan_spaces_flutter/domain/entities/user_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';
import 'package:velan_spaces_flutter/data/datasources/worker_manager_datasource.dart';
import 'package:velan_spaces_flutter/data/datasources/firestore_worker_manager_datasource.dart';
import 'package:velan_spaces_flutter/data/datasources/firestore_project_datasource.dart';
import 'package:velan_spaces_flutter/data/datasources/project_datasource.dart';
import 'package:velan_spaces_flutter/core/session_service.dart';

// ─── Core Firebase Providers ──────────────────────────────────────────

final firebaseAuthProvider = Provider<FirebaseAuth>((_) => FirebaseAuth.instance);
final firestoreProvider = Provider<FirebaseFirestore>((_) => FirebaseFirestore.instance);

// ─── Datasource & Repository ──────────────────────────────────────────

final authDatasourceProvider = Provider<AuthDatasource>((ref) {
  return FirebaseAuthDatasourceImpl(
    firebaseAuth: ref.watch(firebaseAuthProvider),
    firestore: ref.watch(firestoreProvider),
  );
});

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepositoryImpl(ref.watch(authDatasourceProvider));
});

final workerManagerDatasourceProvider = Provider<WorkerManagerDatasource>((ref) {
  return FirestoreWorkerManagerDatasourceImpl(ref.watch(firestoreProvider));
});

final firestoreProjectDatasourceProvider = Provider<ProjectDatasource>((ref) {
  return FirestoreProjectDatasourceImpl(ref.watch(firestoreProvider));
});

// ─── Auth State ───────────────────────────────────────────────────────

final authStateChangesProvider = StreamProvider<UserEntity?>((ref) {
  return ref.watch(authRepositoryProvider).authStateChanges;
});

final currentUserRoleProvider = StateProvider<UserRole>((_) => UserRole.unknown);

final currentUserMetaProvider = StateProvider<Map<String, dynamic>>((_) => {});

// ─── Auth Notifier ────────────────────────────────────────────────────

final authNotifierProvider =
    StateNotifierProvider<AuthNotifier, AsyncValue<UserEntity?>>((ref) {
  return AuthNotifier(ref);
});

class AuthNotifier extends StateNotifier<AsyncValue<UserEntity?>> {
  final Ref _ref;

  AuthNotifier(this._ref) : super(const AsyncValue.data(null));

  AuthRepository get _authRepository => _ref.read(authRepositoryProvider);

  /// Helper to set role/meta and persist to storage
  Future<void> _setSessionAndPersist(UserRole role, Map<String, dynamic> meta) async {
    _ref.read(currentUserRoleProvider.notifier).state = role;
    _ref.read(currentUserMetaProvider.notifier).state = meta;
    await SessionService.saveSession(role: role, meta: meta);
  }

  /// Restore a previous session from secure storage (called on app startup)
  Future<bool> restoreSession() async {
    final session = await SessionService.loadSession();
    if (session == null) return false;

    // Check if Firebase still has a valid user
    final firebaseUser = FirebaseAuth.instance.currentUser;
    if (firebaseUser == null) {
      // Firebase session expired, clear local session too
      await SessionService.clearSession();
      return false;
    }

    // Restore role and metadata
    _ref.read(currentUserRoleProvider.notifier).state = session.role;
    _ref.read(currentUserMetaProvider.notifier).state = session.meta;

    // Create a simple UserEntity from the existing Firebase user
    state = AsyncValue.data(UserEntity(
      uid: firebaseUser.uid,
      email: firebaseUser.email,
    ));

    if (kDebugMode) print('✅ Session restored: ${session.role.name}');
    return true;
  }

  /// HEAD login with hardcoded credentials (admin / 12345)
  Future<bool> signInAsHead(String password) async {
    if (kDebugMode) print('🔑 Attempting Admin Login with password: $password');
    if (password != '12345') {
      if (kDebugMode) print('❌ Admin Login Failed: Invalid Password');
      state = AsyncValue.error('Invalid Admin Credentials', StackTrace.current);
      return false;
    }
    state = const AsyncValue.loading();
    if (kDebugMode) print('🔄 Signing in anonymously to Firebase...');
    final result = await _authRepository.signInAnonymously();
    return result.fold(
      (failure) {
        if (kDebugMode) print('❌ Firebase Sign-In Failed: ${failure.message}');
        state = AsyncValue.error(failure.message, StackTrace.current);
        return false;
      },
      (user) async {
        if (kDebugMode) print('✅ Admin Login Successful. User ID: ${user.uid}');
        state = AsyncValue.data(user);
        final meta = {'name': 'Admin', 'id': 'head'};
        await _setSessionAndPersist(UserRole.head, meta);
        // ─── Initialize FCM ────────────────────────────────────
        unawaited(_initFCM('head'));
        return true;
      },
    );
  }

  /// Manager login - simplified (any non-empty ID + password)
  Future<bool> signInAsManager(String name, {String password = ''}) async {
    state = const AsyncValue.loading();
    try {
      if (name.trim().isEmpty) {
        state = AsyncValue.error('Manager ID required', StackTrace.current);
        return false;
      }
      if (password.trim().isEmpty) {
        state = AsyncValue.error('Password required', StackTrace.current);
        return false;
      }

      final manager = await _ref.read(workerManagerDatasourceProvider).getManagerByName(name.trim());
      if (manager == null) {
        state = AsyncValue.error('Manager ID not found', StackTrace.current);
        return false;
      }
      if (manager.password != password) {
        state = AsyncValue.error('Invalid password', StackTrace.current);
        return false;
      }
      if (manager.isSuspended) {
        state = AsyncValue.error('Account suspended by Admin', StackTrace.current);
        return false;
      }
      
      final result = await _authRepository.signInAnonymously();
      return result.fold(
        (failure) {
          state = AsyncValue.error(failure.message, StackTrace.current);
          return false;
        },
        (user) async {
          state = AsyncValue.data(user);
          final meta = {'name': name, 'id': manager.id};
          await _setSessionAndPersist(UserRole.manager, meta);
          // ─── Initialize FCM ────────────────────────────────────
          unawaited(_initFCM(manager.id));
          return true;
        },
      );
    } catch (e) {
      state = AsyncValue.error(e.toString(), StackTrace.current);
      return false;
    }
  }

  /// Worker login - simplified (any non-empty name)
  Future<bool> signInAsWorker(String name, {String password = ''}) async {
    state = const AsyncValue.loading();
    try {
      if (name.trim().isEmpty) {
        state = AsyncValue.error('Worker ID required', StackTrace.current);
        return false;
      }
      if (password.trim().isEmpty) {
        state = AsyncValue.error('Password required', StackTrace.current);
        return false;
      }
      
      final worker = await _ref.read(workerManagerDatasourceProvider).getWorkerByName(name.trim());
      if (worker == null) {
        state = AsyncValue.error('Worker ID not found', StackTrace.current);
        return false;
      }
      if (worker.password != password) {
        state = AsyncValue.error('Invalid password', StackTrace.current);
        return false;
      }
      
      final result = await _authRepository.signInAnonymously();
      return result.fold(
        (failure) {
          state = AsyncValue.error(failure.message, StackTrace.current);
          return false;
        },
        (user) async {
          state = AsyncValue.data(user);
          final meta = {'name': name, 'id': worker.id};
          await _setSessionAndPersist(UserRole.worker, meta);
          // Workers get FCM too
          unawaited(_initFCM(worker.id));
          return true;
        },
      );
    } catch (e) {
      state = AsyncValue.error(e.toString(), StackTrace.current);
      return false;
    }
  }

  /// Client login - validates project ID exists
  Future<bool> signInAsClient(String projectInput) async {
    state = const AsyncValue.loading();
    try {
      if (projectInput.trim().isEmpty) {
        state = AsyncValue.error('Project ID required', StackTrace.current);
        return false;
      }

      // Validate project exists — resolves by doc ID OR projectCode field
      final projectDs = _ref.read(firestoreProjectDatasourceProvider);
      final project = await projectDs.getProjectById(projectInput.trim());
      // Use the real Firestore doc ID (not the typed code) for navigation
      final resolvedProjectId = project.id;

      final result = await _authRepository.signInAnonymously();
      return result.fold(
        (failure) {
          state = AsyncValue.error(failure.message, StackTrace.current);
          return false;
        },
        (user) async {
          state = AsyncValue.data(user);
          final meta = {'projectId': resolvedProjectId};
          await _setSessionAndPersist(UserRole.client, meta);
          return true;
        },
      );
    } catch (e) {
      state = AsyncValue.error('Project not found. Check your project ID.', StackTrace.current);
      return false;
    }
  }

  Future<void> signOut() async {
    state = const AsyncValue.loading();
    // Clean up FCM token before logout
    final meta = _ref.read(currentUserMetaProvider);
    final userId = meta['id'] as String? ?? '';
    if (userId.isNotEmpty) {
      await FCMService.instance.signOut(userId);
    }
    // Clear persisted session first
    await SessionService.clearSession();
    final result = await _authRepository.signOut();
    result.fold(
      (failure) => state = AsyncValue.error(failure.message, StackTrace.current),
      (_) {
        state = const AsyncValue.data(null);
        _ref.read(currentUserRoleProvider.notifier).state = UserRole.unknown;
        _ref.read(currentUserMetaProvider.notifier).state = {};
      },
    );
  }

  /// Initialize FCM push notifications for the logged-in user.
  Future<void> _initFCM(String userId) async {
    try {
      await FCMService.instance.initialize(
        userId: userId,
        onNotificationTap: (projectId) {
          // Navigation is not available here (no BuildContext).
          // The App widget listens to FCM taps via GoRouter.
          if (kDebugMode) print('🔔 Notification tap → project: $projectId');
        },
      );
    } catch (e) {
      if (kDebugMode) print('⚠️ FCM init error: $e');
    }
  }
}
