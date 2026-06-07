import 'package:flutter/foundation.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';

enum ProjectChatMessageType { text, image, file }

@immutable
class ProjectChatMessageEntity {
  const ProjectChatMessageEntity({
    required this.id,
    required this.projectId,
    required this.senderId,
    required this.senderName,
    required this.senderRole,
    required this.content,
    required this.messageType,
    this.attachmentUrls = const [],
    this.readBy = const [],
    this.createdAt,
  });

  final String id;
  final String projectId;
  final String senderId;
  final String senderName;
  final UserRole senderRole;
  final String content;
  final ProjectChatMessageType messageType;
  final List<String> attachmentUrls;
  final List<String> readBy;
  final DateTime? createdAt;
}
