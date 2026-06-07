import 'package:cloud_firestore/cloud_firestore.dart';
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

  factory ProjectComplaintModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>;
    return ProjectComplaintModel(
      id: snap.id,
      projectId: data['projectId'] ?? '',
      title: data['title'] ?? '',
      description: data['description'] ?? '',
      createdBy: data['createdBy'] ?? '',
      createdByName: data['createdByName'] ?? '',
      status: ProjectComplaintStatus.values.firstWhere(
        (status) => status.name == data['status'],
        orElse: () => ProjectComplaintStatus.open,
      ),
      attachments: List<String>.from(data['attachments'] ?? const []),
      resolutionNote: data['resolutionNote'] ?? '',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      updatedAt: (data['updatedAt'] as Timestamp?)?.toDate(),
      resolvedAt: (data['resolvedAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'projectId': projectId,
      'title': title,
      'description': description,
      'createdBy': createdBy,
      'createdByName': createdByName,
      'status': status.name,
      'attachments': attachments,
      'resolutionNote': resolutionNote,
      'createdAt': createdAt != null ? Timestamp.fromDate(createdAt!) : FieldValue.serverTimestamp(),
      'updatedAt': updatedAt != null ? Timestamp.fromDate(updatedAt!) : FieldValue.serverTimestamp(),
      'resolvedAt': resolvedAt != null ? Timestamp.fromDate(resolvedAt!) : null,
    };
  }
}
