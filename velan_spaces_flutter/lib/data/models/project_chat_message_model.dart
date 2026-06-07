import 'package:cloud_firestore/cloud_firestore.dart';
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

  factory ProjectChatMessageModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>;
    return ProjectChatMessageModel(
      id: snap.id,
      projectId: data['projectId'] ?? '',
      senderId: data['senderId'] ?? '',
      senderName: data['senderName'] ?? '',
      senderRole: userRoleFromString(data['senderRole']),
      content: data['content'] ?? '',
      messageType: ProjectChatMessageType.values.firstWhere(
        (type) => type.name == data['messageType'],
        orElse: () => ProjectChatMessageType.text,
      ),
      attachmentUrls: List<String>.from(data['attachmentUrls'] ?? const []),
      readBy: List<String>.from(data['readBy'] ?? const []),
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'projectId': projectId,
      'senderId': senderId,
      'senderName': senderName,
      'senderRole': senderRole.name.toUpperCase(),
      'content': content,
      'messageType': messageType.name,
      'attachmentUrls': attachmentUrls,
      'readBy': readBy,
      'createdAt': createdAt != null ? Timestamp.fromDate(createdAt!) : FieldValue.serverTimestamp(),
    };
  }
}
