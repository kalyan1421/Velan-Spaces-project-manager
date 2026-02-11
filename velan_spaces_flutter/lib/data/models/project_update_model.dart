import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/domain/entities/project_update_entity.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';

class ProjectUpdateModel extends ProjectUpdateEntity {
  const ProjectUpdateModel({
    required super.id,
    required super.postedBy,
    required super.role,
    required super.type,
    required super.content,
    required super.timestamp,
    super.category,
    super.roomId,
    super.associatedWorkerIds,
    super.progressPercentage,
    super.mediaUrls,
    super.comments,
  });

  factory ProjectUpdateModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>;
    return ProjectUpdateModel(
      id: snap.id,
      postedBy: data['postedBy'] ?? '',
      role: userRoleFromString(data['role']),
      type: data['type'] ?? 'message',
      content: data['content'] ?? '',
      timestamp: (data['timestamp'] as Timestamp?)?.toDate() ?? DateTime.now(),
      category: data['category'],
      roomId: data['roomId'],
      associatedWorkerIds: List<String>.from(data['associatedWorkerIds'] ?? []),
      progressPercentage: (data['progressPercentage'] as num?)?.toInt(),
      mediaUrls: List<String>.from(data['mediaUrls'] ?? []),
      comments: List<Map<String, dynamic>>.from(
        (data['comments'] as List?)?.map((c) => Map<String, dynamic>.from(c as Map)) ?? [],
      ),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'postedBy': postedBy,
      'role': role.toString().split('.').last,
      'type': type,
      'content': content,
      'timestamp': Timestamp.fromDate(timestamp),
      'category': category,
      'roomId': roomId,
      'associatedWorkerIds': associatedWorkerIds,
      if (progressPercentage != null) 'progressPercentage': progressPercentage,
      'mediaUrls': mediaUrls,
    };
  }
}

