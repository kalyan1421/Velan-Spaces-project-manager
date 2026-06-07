import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/core/services/notification_service.dart';
import 'package:velan_spaces_flutter/data/datasources/notification_datasource.dart';
import 'package:velan_spaces_flutter/domain/entities/notification_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';

// ─── Datasource ──────────────────────────────────────────────────────────
final notificationDatasourceProvider = Provider<NotificationDatasource>((ref) {
  final firestore = ref.watch(firestoreProvider);
  return NotificationDatasource(firestore);
});

// ─── NotificationService provider ────────────────────────────────────────
final notificationServiceProvider = Provider<NotificationService>((ref) {
  final ds = ref.watch(notificationDatasourceProvider);
  return NotificationService(ds);
});

// ─── Current User ID (uses stable doc-ID, not Firebase anonymous UID) ────
// Admin  → 'head'      (set at login via meta['id'])
// Manager → manager.id (Firestore doc ID, set at login via meta['id'])
// Worker  → worker.id
final _currentUserIdProvider = Provider<String>((ref) {
  final meta = ref.watch(currentUserMetaProvider);
  // Prefer the app-level id ('head' or Firestore doc id) over Firebase uid
  final id = meta['id'] as String?;
  if (id != null && id.isNotEmpty) return id;
  return meta['uid'] as String? ?? '';
});

// ─── Notifications Stream ────────────────────────────────────────────────
final notificationsProvider =
    StreamProvider<List<NotificationEntity>>((ref) {
  final ds = ref.watch(notificationDatasourceProvider);
  final userId = ref.watch(_currentUserIdProvider);
  if (userId.isEmpty) return Stream.value([]);
  return ds.watchNotifications(userId);
});

// ─── Unread Count ────────────────────────────────────────────────────────
final unreadNotificationCountProvider = Provider<int>((ref) {
  final notifications = ref.watch(notificationsProvider).valueOrNull ?? [];
  return notifications.where((n) => !n.isRead).length;
});

// ─── Controller ──────────────────────────────────────────────────────────
final notificationControllerProvider =
    StateNotifierProvider<NotificationController, AsyncValue<void>>((ref) {
  return NotificationController(ref);
});

class NotificationController extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;

  NotificationController(this._ref) : super(const AsyncValue.data(null));

  NotificationDatasource get _datasource =>
      _ref.read(notificationDatasourceProvider);

  String get _userId {
    final meta = _ref.read(currentUserMetaProvider);
    // Must match _currentUserIdProvider — use stable doc ID ('head' or manager.id)
    // NOT meta['uid'] which is the ephemeral anonymous Firebase UID
    final id = meta['id'] as String?;
    if (id != null && id.isNotEmpty) return id;
    return meta['uid'] as String? ?? '';
  }

  Future<void> markAsRead(String notificationId) async {
    if (_userId.isEmpty) return;
    try {
      await _datasource.markAsRead(_userId, notificationId);
    } catch (_) {}
  }

  Future<void> markAllAsRead() async {
    if (_userId.isEmpty) return;
    state = const AsyncValue.loading();
    try {
      await _datasource.markAllAsRead(_userId);
      state = const AsyncValue.data(null);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> deleteNotification(String notificationId) async {
    if (_userId.isEmpty) return;
    state = const AsyncValue.loading();
    try {
      await _datasource.deleteNotification(_userId, notificationId);
      state = const AsyncValue.data(null);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> clearAll() async {
    if (_userId.isEmpty) return;
    state = const AsyncValue.loading();
    try {
      await _datasource.clearAll(_userId);
      state = const AsyncValue.data(null);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}
