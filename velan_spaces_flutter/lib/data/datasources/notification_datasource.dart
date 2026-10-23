import 'package:velan_spaces_flutter/core/api/api_client.dart';
import 'package:velan_spaces_flutter/core/api/api_parse.dart';
import 'package:velan_spaces_flutter/core/api/polling.dart';
import 'package:velan_spaces_flutter/data/models/notification_model.dart';

/// Notifications of the signed-in user, read through the Velan API.
/// The server creates notifications (and sends the push) when the underlying
/// event happens, so the app only reads and manages them.
class NotificationDatasource {
  NotificationDatasource(this._api);

  final ApiClient _api;

  static const topic = 'notifications';

  /// Latest notifications (newest first, the API returns up to 100).
  Stream<List<NotificationModel>> watchNotifications() {
    return pollJson<List<NotificationModel>>(
      fetchJson: () => _api.get('/notifications'),
      map: (json) => (json as List? ?? const [])
          .whereType<Map>()
          .map((m) => NotificationModel.fromApi(Map<String, dynamic>.from(m)))
          .toList(),
      topics: const [topic],
    );
  }

  Stream<int> watchUnreadCount() {
    return pollJson<int>(
      fetchJson: () => _api.get('/notifications/unread-count'),
      map: (json) => json is Map ? (apiInt(json['unread']) ?? 0) : 0,
      topics: const [topic],
    );
  }

  void _changed() => ApiInvalidation.instance.notify(topic);

  Future<void> markAsRead(String notificationId) async {
    await _api.patch('/notifications/$notificationId/read');
    _changed();
  }

  Future<void> markAllAsRead() async {
    await _api.post('/notifications/read-all');
    _changed();
  }

  Future<void> deleteNotification(String notificationId) async {
    await _api.delete('/notifications/$notificationId');
    _changed();
  }

  /// Deletes the caller's READ notifications; unread ones stay.
  Future<void> clearRead() async {
    await _api.delete('/notifications');
    _changed();
  }
}
