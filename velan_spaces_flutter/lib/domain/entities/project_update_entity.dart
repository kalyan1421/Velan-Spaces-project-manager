import 'package:flutter/foundation.dart';
import 'package:velan_spaces_flutter/domain/entities/user_role.dart';

@immutable
class ProjectUpdateEntity {
  const ProjectUpdateEntity({
    required this.id,
    required this.postedBy,
    required this.role,
    required this.type,
    required this.content,
    required this.timestamp,
    this.category,
    this.roomId,
    this.associatedWorkerIds,
    this.progressPercentage,
    this.mediaUrls = const [],
    this.comments = const [],
  });

  final String id;
  final String postedBy;
  final UserRole role;
  final String type; // 'message', 'photo', 'video'
  final String content;
  final DateTime timestamp;
  final String? category;
  final String? roomId;
  final List<String>? associatedWorkerIds;
  final int? progressPercentage;
  final List<String> mediaUrls;
  final List<Map<String, dynamic>> comments;
}

