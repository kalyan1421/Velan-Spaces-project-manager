import 'package:flutter/foundation.dart';

enum ProjectComplaintStatus { open, inProgress, resolved, closed }

@immutable
class ProjectComplaintEntity {
  const ProjectComplaintEntity({
    required this.id,
    required this.projectId,
    required this.title,
    required this.description,
    required this.createdBy,
    required this.createdByName,
    this.status = ProjectComplaintStatus.open,
    this.attachments = const [],
    this.resolutionNote = '',
    this.createdAt,
    this.updatedAt,
    this.resolvedAt,
  });

  final String id;
  final String projectId;
  final String title;
  final String description;
  final String createdBy;
  final String createdByName;
  final ProjectComplaintStatus status;
  final List<String> attachments;
  final String resolutionNote;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DateTime? resolvedAt;

  ProjectComplaintEntity copyWith({
    String? id,
    String? projectId,
    String? title,
    String? description,
    String? createdBy,
    String? createdByName,
    ProjectComplaintStatus? status,
    List<String>? attachments,
    String? resolutionNote,
    DateTime? createdAt,
    DateTime? updatedAt,
    DateTime? resolvedAt,
  }) {
    return ProjectComplaintEntity(
      id: id ?? this.id,
      projectId: projectId ?? this.projectId,
      title: title ?? this.title,
      description: description ?? this.description,
      createdBy: createdBy ?? this.createdBy,
      createdByName: createdByName ?? this.createdByName,
      status: status ?? this.status,
      attachments: attachments ?? this.attachments,
      resolutionNote: resolutionNote ?? this.resolutionNote,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      resolvedAt: resolvedAt ?? this.resolvedAt,
    );
  }
}
