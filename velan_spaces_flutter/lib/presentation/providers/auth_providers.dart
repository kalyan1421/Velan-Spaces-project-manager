import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
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

    print('✅ Session restored: ${session.role.name}');
    return true;
  }

  /// HEAD login with hardcoded credentials (admin / 12345)
  Future<bool> signInAsHead(String password) async {
    print('🔑 Attempting Admin Login with password: $password');
    if (password != '12345') {
      print('❌ Admin Login Failed: Invalid Password');
      state = AsyncValue.error('Invalid Admin Credentials', StackTrace.current);
      return false;
    }
    state = const AsyncValue.loading();
    print('🔄 Signing in anonymously to Firebase...');
    final result = await _authRepository.signInAnonymously();
    return result.fold(
      (failure) {
        print('❌ Firebase Sign-In Failed: ${failure.message}');
        state = AsyncValue.error(failure.message, StackTrace.current);
        return false;
      },
      (user) async {
        print('✅ Admin Login Successful. User ID: ${user.uid}');
        state = AsyncValue.data(user);
        final meta = {'name': 'Admin'};
        await _setSessionAndPersist(UserRole.head, meta);
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
      
      final result = await _authRepository.signInAnonymously();
      return result.fold(
        (failure) {
          state = AsyncValue.error(failure.message, StackTrace.current);
          return false;
        },
        (user) async {
          state = AsyncValue.data(user);
          final meta = {'name': name, 'id': name};
          await _setSessionAndPersist(UserRole.manager, meta);
          return true;
        },
      );
    } catch (e) {
      state = AsyncValue.error(e.toString(), StackTrace.current);
      return false;
    }
  }

  /// Worker login - simplified (any non-empty name)
  Future<bool> signInAsWorker(String name) async {
    state = const AsyncValue.loading();
    try {
      if (name.trim().isEmpty) {
        state = AsyncValue.error('Worker ID required', StackTrace.current);
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
          final meta = {'name': name, 'id': name};
          await _setSessionAndPersist(UserRole.worker, meta);
          return true;
        },
      );
    } catch (e) {
      state = AsyncValue.error(e.toString(), StackTrace.current);
      return false;
    }
  }

  /// Client login - validates project ID exists
  Future<bool> signInAsClient(String projectId) async {
    state = const AsyncValue.loading();
    try {
      if (projectId.trim().isEmpty) {
        state = AsyncValue.error('Project ID required', StackTrace.current);
        return false;
      }

      // Validate project exists
      final projectDs = _ref.read(firestoreProjectDatasourceProvider);
      final project = await projectDs.getProjectById(projectId.trim());
      
      if (project == null) {
        state = AsyncValue.error('Invalid Project ID', StackTrace.current);
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
          final meta = {'projectId': projectId.trim()};
          await _setSessionAndPersist(UserRole.client, meta);
          return true;
        },
      );
    } catch (e) {
      state = AsyncValue.error(e.toString(), StackTrace.current);
      return false;
    }
  }

  Future<void> signOut() async {
    state = const AsyncValue.loading();
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
}
