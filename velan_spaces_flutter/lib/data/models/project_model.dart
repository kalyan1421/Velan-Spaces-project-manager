import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/domain/entities/project_entity.dart';

class ProjectModel extends ProjectEntity {
  const ProjectModel({
    required super.id,
    required super.projectName,
    required super.clientName,
    required super.location,
    required super.budget,
    required super.currentSpend,
    required super.isComplete,
    required super.managerIds,
    super.estimatedCost,
    super.completionPercentage,
    super.startDate,
    super.targetEndDate,
    super.workerIds,
    super.createdAt,
    super.clientPhone,
    super.clientEmail,
  });

  factory ProjectModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>;
    return ProjectModel(
      id: snap.id,
      projectName: data['projectName'] ?? '',
      clientName: data['clientName'] ?? '',
      clientPhone: data['clientPhone'] ?? '',
      clientEmail: data['clientEmail'] ?? '',
      location: data['location'] ?? '',
      budget: (data['budget'] as num?)?.toDouble() ?? 0.0,
      estimatedCost: (data['estimatedCost'] as num?)?.toDouble() ?? 0.0,
      currentSpend: (data['currentSpend'] as num?)?.toDouble() ?? 0.0,
      completionPercentage: (data['completionPercentage'] as num?)?.toInt() ?? 0,
      isComplete: data['isComplete'] ?? false,
      managerIds: (data['managerIds'] as List?)?.map((e) => e.toString()).toList() ?? [],
      workerIds: (data['workerIds'] as List?)?.map((e) => e.toString()).toList() ?? [],
      startDate: (data['startDate'] as Timestamp?)?.toDate(),
      targetEndDate: (data['targetEndDate'] as Timestamp?)?.toDate(),
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'projectName': projectName,
      'clientName': clientName,
      'clientPhone': clientPhone,
      'clientEmail': clientEmail,
      'location': location,
      'budget': budget,
      'estimatedCost': estimatedCost,
      'currentSpend': currentSpend,
      'completionPercentage': completionPercentage,
      'isComplete': isComplete,
      'managerIds': managerIds,
      'workerIds': workerIds,
      if (startDate != null) 'startDate': Timestamp.fromDate(startDate!),
      if (targetEndDate != null) 'targetEndDate': Timestamp.fromDate(targetEndDate!),
    };
  }
}

