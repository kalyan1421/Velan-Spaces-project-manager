import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:velan_spaces_flutter/core/api/api_client.dart';
import 'package:velan_spaces_flutter/core/api/api_config.dart';
import 'package:velan_spaces_flutter/core/api/api_exception.dart';
import 'package:velan_spaces_flutter/core/api/token_store.dart';
import 'package:velan_spaces_flutter/core/services/fcm_service.dart';
import 'package:velan_spaces_flutter/core/session_service.dart';
import 'package:velan_spaces_flutter/data/datasources/api_worker_manager_datasource.dart';
import 'package:velan_spaces_flutter/data/datasources/worker_manager_datasource.dart';
import 'package:velan_spaces_flutter/domain/entities/user_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';

// ─── Core Providers ───────────────────────────────────────────────────

final apiClientProvider = Provider<ApiClient>((_) => ApiClient.instance);

/// Still used by features not yet moved to the API (leads, quotations,
/// notifications, portfolio). Removed when those modules migrate.
final firestoreProvider = Provider<FirebaseFirestore>((_) => FirebaseFirestore.instance);

final workerManagerDatasourceProvider = Provider<WorkerManagerDatasource>((ref) {
  return ApiWorkerManagerDatasource(ref.watch(apiClientProvider));
});

// ─── Auth State ───────────────────────────────────────────────────────

final currentUserRoleProvider = StateProvider<UserRole>((_) => UserRole.unknown);

/// Signed-in user details: id, name, email, username, and for clients
/// projectId (first project) + projectIds.
final currentUserMetaProvider = StateProvider<Map<String, dynamic>>((_) => {});

// ─── Auth Notifier ────────────────────────────────────────────────────

final authNotifierProvider =
    StateNotifierProvider<AuthNotifier, AsyncValue<UserEntity?>>((ref) {
  return AuthNotifier(ref);
});

/// Sign-in against the Velan backend: email (or a worker's username) +
/// password, or Google for existing accounts. The backend issues the session;
/// the role comes from the server, never from the device.
class AuthNotifier extends StateNotifier<AsyncValue<UserEntity?>> {
  AuthNotifier(this._ref) : super(const AsyncValue.data(null)) {
    _api.onSessionExpired = _onSessionExpired;
  }

  final Ref _ref;
  bool _googleReady = false;

  ApiClient get _api => _ref.read(apiClientProvider);

  Future<void> _setSessionAndPersist(UserRole role, Map<String, dynamic> meta) async {
    _ref.read(currentUserRoleProvider.notifier).state = role;
    _ref.read(currentUserMetaProvider.notifier).state = meta;
    await SessionService.saveSession(role: role, meta: meta);
  }

  /// Restore the previous session on startup (tokens in secure storage).
  Future<bool> restoreSession() async {
    if (!await TokenStore.instance.hasSession) {
      await SessionService.clearSession();
      return false;
    }
    try {
      // Refreshes the access token transparently if it has expired. Bounded:
      // this runs before the first frame, so a slow server must not hang
      // app start; we fall back to the cached profile instead.
      final me = await _api.get('/auth/me').timeout(
            const Duration(seconds: 6),
            onTimeout: () => throw ApiException(0, 'Server did not respond'),
          ) as Map<String, dynamic>;
      await _applyUser(me);
      if (kDebugMode) print('✅ Session restored: ${_ref.read(currentUserRoleProvider).name}');
      return true;
    } on ApiException catch (e) {
      if (e.isNetwork) {
        // Offline start: keep the user signed in with the cached profile.
        final cached = await SessionService.loadSession();
        if (cached != null) {
          _ref.read(currentUserRoleProvider.notifier).state = cached.role;
          _ref.read(currentUserMetaProvider.notifier).state = cached.meta;
          state = AsyncValue.data(UserEntity(uid: cached.meta['id'] as String? ?? ''));
          return true;
        }
      }
      await _clearLocal();
      return false;
    }
  }

  /// Email (or worker username) + password.
  Future<bool> signInWithPassword(String identifier, String password) async {
    if (identifier.trim().isEmpty || password.isEmpty) {
      state = AsyncValue.error('Enter your email or username and password', StackTrace.current);
      return false;
    }
    state = const AsyncValue.loading();
    try {
      final res = await _api.postPublic('/auth/login', {
        'identifier': identifier.trim(),
        'password': password,
      }) as Map<String, dynamic>;
      return await _completeSignIn(res);
    } on ApiException catch (e) {
      state = AsyncValue.error(e.message, StackTrace.current);
      return false;
    }
  }

  /// Google sign-in for accounts the administrator already created.
  Future<bool> signInWithGoogle() async {
    state = const AsyncValue.loading();
    try {
      await _ensureGoogle();
      final account = await GoogleSignIn.instance.authenticate();
      final idToken = account.authentication.idToken;
      // We only need Google to prove the email; the app session is ours.
      unawaited(GoogleSignIn.instance.signOut());
      if (idToken == null) throw ApiException(401, 'Google did not return a sign-in token');
      final res = await _api.postPublic('/auth/google', {'idToken': idToken}) as Map<String, dynamic>;
      return await _completeSignIn(res);
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled) {
        state = const AsyncValue.data(null);
      } else {
        state = AsyncValue.error(e.description ?? 'Google sign-in failed', StackTrace.current);
      }
      return false;
    } on ApiException catch (e) {
      state = AsyncValue.error(e.message, StackTrace.current);
      return false;
    }
  }

  Future<void> _ensureGoogle() async {
    if (_googleReady) return;
    await GoogleSignIn.instance.initialize(
      clientId: kIsWeb
          ? ApiConfig.googleWebClientId
          : (ApiConfig.googleIosClientId.isEmpty ? null : ApiConfig.googleIosClientId),
      serverClientId:
          ApiConfig.googleServerClientId.isEmpty ? null : ApiConfig.googleServerClientId,
    );
    _googleReady = true;
  }

  Future<bool> _completeSignIn(Map<String, dynamic> res) async {
    await TokenStore.instance.save(
      accessToken: res['accessToken'] as String,
      refreshToken: res['refreshToken'] as String,
    );
    try {
      await _applyUser(res['user'] as Map<String, dynamic>);
    } on ApiException catch (e) {
      await _clearLocal();
      state = AsyncValue.error(e.message, StackTrace.current);
      return false;
    }
    final userId = _ref.read(currentUserMetaProvider)['id'] as String? ?? '';
    unawaited(_initFCM(userId));
    return true;
  }

  /// Role + profile from the server; clients also get their project(s).
  Future<void> _applyUser(Map<String, dynamic> user) async {
    final role = userRoleFromString(user['role'] as String?);
    if (role == UserRole.unknown) {
      throw ApiException(403, 'This account has no access to the app.');
    }
    final meta = <String, dynamic>{
      'id': user['id'],
      'name': user['displayName'] ?? user['username'] ?? user['email'] ?? '',
      'email': user['email'],
      'username': user['username'],
    };
    if (role == UserRole.client) {
      final projects = (await _api.get('/projects') as List).whereType<Map>().toList();
      if (projects.isEmpty) {
        throw ApiException(403, 'No project is linked to your account yet. Please contact Velan Spaces.');
      }
      meta['projectId'] = projects.first['id'];
      meta['projectIds'] = projects.map((p) => p['id']).toList();
    }
    state = AsyncValue.data(UserEntity(
      uid: user['id'] as String,
      email: user['email'] as String?,
      role: role.name,
    ));
    await _setSessionAndPersist(role, meta);
  }

  Future<void> signOut() async {
    state = const AsyncValue.loading();
    final userId = _ref.read(currentUserMetaProvider)['id'] as String? ?? '';
    if (userId.isNotEmpty) {
      // Best-effort: never let a slow network keep the user from signing out.
      await FCMService.instance
          .signOut(userId)
          .timeout(const Duration(seconds: 5), onTimeout: () {});
    }
    try {
      await _api.post('/auth/logout').timeout(const Duration(seconds: 5));
    } catch (_) {
      // Revocation is best-effort; local tokens are cleared regardless.
    }
    await _clearLocal();
  }

  Future<void> _clearLocal() async {
    await TokenStore.instance.clear();
    await SessionService.clearSession();
    state = const AsyncValue.data(null);
    _ref.read(currentUserRoleProvider.notifier).state = UserRole.unknown;
    _ref.read(currentUserMetaProvider.notifier).state = {};
  }

  /// The refresh token was rejected (expired, revoked, account suspended).
  void _onSessionExpired() {
    unawaited(SessionService.clearSession());
    if (!mounted) return;
    state = const AsyncValue.data(null);
    _ref.read(currentUserRoleProvider.notifier).state = UserRole.unknown;
    _ref.read(currentUserMetaProvider.notifier).state = {};
  }

  /// Initialize FCM push notifications for the logged-in user.
  Future<void> _initFCM(String userId) async {
    if (userId.isEmpty) return;
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
