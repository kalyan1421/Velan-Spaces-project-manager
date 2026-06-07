import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/data/models/notification_model.dart';

class NotificationDatasource {
  final FirebaseFirestore _firestore;

  NotificationDatasource(this._firestore);

  /// Watch notifications for a specific user (by their role-based uid)
  Stream<List<NotificationModel>> watchNotifications(String userId) {
    return _firestore
        .collection('users')
        .doc(userId)
        .collection('notifications')
        .orderBy('createdAt', descending: true)
        .limit(50)
        .snapshots()
        .map((snap) =>
            snap.docs.map((d) => NotificationModel.fromSnapshot(d)).toList());
  }

  /// Mark a single notification as read
  Future<void> markAsRead(String userId, String notificationId) async {
    await _firestore
        .collection('users')
        .doc(userId)
        .collection('notifications')
        .doc(notificationId)
        .update({'isRead': true});
  }

  /// Mark all notifications as read
  Future<void> markAllAsRead(String userId) async {
    final batch = _firestore.batch();
    final unread = await _firestore
        .collection('users')
        .doc(userId)
        .collection('notifications')
        .where('isRead', isEqualTo: false)
        .get();

    for (final doc in unread.docs) {
      batch.update(doc.reference, {'isRead': true});
    }

    await batch.commit();
  }

  /// Delete a notification
  Future<void> deleteNotification(String userId, String notificationId) async {
    await _firestore
        .collection('users')
        .doc(userId)
        .collection('notifications')
        .doc(notificationId)
        .delete();
  }

  /// Clear all notifications
  Future<void> clearAll(String userId) async {
    final batch = _firestore.batch();
    final all = await _firestore
        .collection('users')
        .doc(userId)
        .collection('notifications')
        .get();

    for (final doc in all.docs) {
      batch.delete(doc.reference);
    }

    await batch.commit();
  }

  /// Send a notification to a user (used by Cloud Functions, but also available client-side)
  Future<void> sendNotification({
    required String targetUserId,
    required String title,
    required String body,
    required String type,
    String projectId = '',
    String projectName = '',
    String senderId = '',
    String senderName = '',
  }) async {
    await _firestore
        .collection('users')
        .doc(targetUserId)
        .collection('notifications')
        .add({
      'title': title,
      'body': body,
      'type': type,
      'projectId': projectId,
      'projectName': projectName,
      'senderId': senderId,
      'senderName': senderName,
      'isRead': false,
      'createdAt': FieldValue.serverTimestamp(),
    });
  }
}
