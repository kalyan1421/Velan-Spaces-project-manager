import 'package:flutter/foundation.dart';

@immutable
class NotificationEntity {
  const NotificationEntity({
    required this.id,
    required this.title,
    required this.body,
    required this.type,
    this.projectId = '',
    this.projectName = '',
    this.senderId = '',
    this.senderName = '',
    this.isRead = false,
    this.createdAt,
  });

  final String id;
  final String title;
  final String body;
  final String type;        // update, design, settlement, status_change, assignment, chat, complaint
  final String projectId;
  final String projectName;
  final String senderId;
  final String senderName;
  final bool isRead;
  final DateTime? createdAt;
}
