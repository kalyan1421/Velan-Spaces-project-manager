import 'package:velan_spaces_flutter/core/api/api_parse.dart';
import 'package:velan_spaces_flutter/domain/entities/project_chat_message_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';

class ProjectChatMessageModel extends ProjectChatMessageEntity {
  const ProjectChatMessageModel({
    required super.id,
    required super.projectId,
    required super.senderId,
    required super.senderName,
    required super.senderRole,
    required super.content,
    required super.messageType,
    super.attachmentUrls,
    super.readBy,
    super.createdAt,
  });

  factory ProjectChatMessageModel.fromApi(Map<String, dynamic> j) {
    return ProjectChatMessageModel(
      id: apiString(j['id']),
      projectId: apiString(j['projectId']),
      senderId: apiString(j['senderId']),
      senderName: apiString(j['senderName']),
      senderRole: userRoleFromString(j['senderRole'] as String?),
      content: apiString(j['content']),
      messageType: ProjectChatMessageType.values.firstWhere(
        (type) => type.name == j['messageType'],
        orElse: () => ProjectChatMessageType.text,
      ),
      attachmentUrls: apiStringList(j['attachmentUrls']),
      readBy: apiStringList(j['readBy']),
      createdAt: apiDate(j['createdAt']),
    );
  }

}
