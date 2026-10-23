import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:velan_spaces_flutter/data/datasources/notification_datasource.dart';
import 'package:velan_spaces_flutter/domain/entities/notification_entity.dart';
import 'package:velan_spaces_flutter/presentation/providers/auth_providers.dart';

// ─── Datasource ──────────────────────────────────────────────────────────
final notificationDatasourceProvider = Provider<NotificationDatasource>((ref) {
  return NotificationDatasource(ref.watch(apiClientProvider));
});

/// True once a user is signed in (the API scopes everything to the caller).
final _signedInProvider = Provider<bool>((ref) {
  final meta = ref.watch(currentUserMetaProvider);
  return ((meta['id'] as String?) ?? '').isNotEmpty;
});

// ─── Notifications Stream ────────────────────────────────────────────────
final notificationsProvider = StreamProvider<List<NotificationEntity>>((ref) {
  if (!ref.watch(_signedInProvider)) return Stream.value(const []);
  return ref.watch(notificationDatasourceProvider).watchNotifications();
});

// ─── Unread Count (GET /notifications/unread-count) ──────────────────────
final _unreadCountStreamProvider = StreamProvider<int>((ref) {
  if (!ref.watch(_signedInProvider)) return Stream.value(0);
  return ref.watch(notificationDatasourceProvider).watchUnreadCount();
});

final unreadNotificationCountProvider = Provider<int>((ref) {
  return ref.watch(_unreadCountStreamProvider).valueOrNull ?? 0;
});

// ─── Controller ──────────────────────────────────────────────────────────
final notificationControllerProvider =
    StateNotifierProvider<NotificationController, AsyncValue<void>>((ref) {
  return NotificationController(ref);
});

class NotificationController extends StateNotifier<AsyncValue<void>> {
  final Ref _ref;

  NotificationController(this._ref) : super(const AsyncValue.data(null));

  NotificationDatasource get _datasource => _ref.read(notificationDatasourceProvider);

  Future<void> markAsRead(String notificationId) async {
    try {
      await _datasource.markAsRead(notificationId);
    } catch (_) {}
  }

  Future<void> markAllAsRead() => _run(_datasource.markAllAsRead);

  Future<void> deleteNotification(String notificationId) =>
      _run(() => _datasource.deleteNotification(notificationId));

  /// Clears read notifications (the API keeps unread ones).
  Future<void> clearRead() => _run(_datasource.clearRead);

  Future<void> _run(Future<void> Function() action) async {
    state = const AsyncValue.loading();
    try {
      await action();
      if (mounted) state = const AsyncValue.data(null);
    } catch (e, st) {
      if (mounted) state = AsyncValue.error(e, st);
    }
  }
}
