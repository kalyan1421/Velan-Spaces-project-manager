import 'package:velan_spaces_flutter/core/api/api_parse.dart';
import 'package:velan_spaces_flutter/domain/entities/project_complaint_entity.dart';

class ProjectComplaintModel extends ProjectComplaintEntity {
  const ProjectComplaintModel({
    required super.id,
    required super.projectId,
    required super.title,
    required super.description,
    required super.createdBy,
    required super.createdByName,
    super.status,
    super.attachments,
    super.resolutionNote,
    super.createdAt,
    super.updatedAt,
    super.resolvedAt,
  });

  factory ProjectComplaintModel.fromApi(Map<String, dynamic> j) {
    return ProjectComplaintModel(
      id: apiString(j['id']),
      projectId: apiString(j['projectId']),
      title: apiString(j['title']),
      description: apiString(j['description']),
      createdBy: apiString(j['createdBy']),
      createdByName: apiString(j['createdByName']),
      status: ProjectComplaintStatus.values.firstWhere(
        (status) => status.name == j['status'],
        orElse: () => ProjectComplaintStatus.open,
      ),
      attachments: apiStringList(j['attachments']),
      resolutionNote: apiString(j['resolutionNote']),
      createdAt: apiDate(j['createdAt']),
      updatedAt: apiDate(j['updatedAt']),
      resolvedAt: apiDate(j['resolvedAt']),
    );
  }

}
