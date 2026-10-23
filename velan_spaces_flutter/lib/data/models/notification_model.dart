import 'package:velan_spaces_flutter/core/api/api_parse.dart';
import 'package:velan_spaces_flutter/domain/entities/notification_entity.dart';

class NotificationModel extends NotificationEntity {
  const NotificationModel({
    required super.id,
    required super.title,
    required super.body,
    required super.type,
    super.projectId,
    super.projectName,
    super.leadId,
    super.entityId,
    super.senderId,
    super.senderName,
    super.isRead,
    super.createdAt,
  });

  /// Parses a row of GET /notifications (camelCase).
  factory NotificationModel.fromApi(Map<String, dynamic> j) {
    return NotificationModel(
      id: apiString(j['id']),
      title: apiString(j['title']),
      body: apiString(j['body']),
      type: apiString(j['type']),
      projectId: apiString(j['projectId']),
      projectName: apiString(j['projectName']),
      leadId: apiString(j['leadId']),
      entityId: apiString(j['entityId']),
      senderId: apiString(j['senderId']),
      senderName: apiString(j['senderName']),
      isRead: j['isRead'] == true,
      createdAt: apiDate(j['createdAt']),
    );
  }
}
