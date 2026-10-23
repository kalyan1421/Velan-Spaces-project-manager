import 'package:velan_spaces_flutter/core/api/api_parse.dart';
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

  factory ProjectUpdateModel.fromApi(Map<String, dynamic> j) {
    return ProjectUpdateModel(
      id: apiString(j['id']),
      postedBy: apiString(j['postedByName'], 'Unknown'),
      role: userRoleFromString(j['role'] as String?),
      type: apiString(j['type'], 'message'),
      content: apiString(j['content']),
      timestamp: apiDate(j['createdAt']) ?? DateTime.now(),
      category: j['category'] as String?,
      roomId: j['roomId'] as String?,
      associatedWorkerIds: apiStringList(j['associatedWorkerIds']),
      progressPercentage: apiInt(j['progressPercentage']),
      mediaUrls: apiStringList(j['mediaUrls']),
      comments: (j['comments'] as List? ?? const [])
          .whereType<Map>()
          .map((c) => Map<String, dynamic>.from(c))
          .toList(),
    );
  }

}
