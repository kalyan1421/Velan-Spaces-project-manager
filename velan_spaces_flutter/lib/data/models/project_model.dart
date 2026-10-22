import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/core/api/api_parse.dart';
import 'package:velan_spaces_flutter/domain/entities/project_entity.dart';

class ProjectModel extends ProjectEntity {
  const ProjectModel({
    required super.id,
    required super.projectCode,
    required super.projectName,
    required super.clientName,
    required super.location,
    required super.budget,
    required super.currentSpend,
    required super.isComplete,
    required super.managerIds,
    super.budgetAccessManagerIds,
    super.estimatedCost,
    super.completionPercentage,
    super.startDate,
    super.targetEndDate,
    super.workerIds,
    super.createdAt,
    super.clientPhone,
    super.clientEmail,
  });

  /// From the Velan API (camelCase JSON). Money/contact fields the caller may
  /// not see are simply absent and default to empty.
  factory ProjectModel.fromApi(Map<String, dynamic> j) {
    return ProjectModel(
      id: apiString(j['id']),
      projectCode: apiString(j['projectCode']),
      projectName: apiString(j['projectName']),
      clientName: apiString(j['clientName']),
      clientPhone: apiString(j['clientPhone']),
      clientEmail: apiString(j['clientEmail']),
      location: apiString(j['location']),
      budget: apiDouble(j['budget']),
      estimatedCost: apiDouble(j['estimatedCost']),
      currentSpend: apiDouble(j['currentSpend']),
      completionPercentage: apiInt(j['completionPercentage']) ?? 0,
      isComplete: j['isComplete'] == true,
      managerIds: apiStringList(j['managerIds']),
      budgetAccessManagerIds: apiStringList(j['budgetAccessManagerIds']),
      workerIds: apiStringList(j['workerIds']),
      startDate: apiDate(j['startDate']),
      targetEndDate: apiDate(j['targetEndDate']),
      createdAt: apiDate(j['createdAt']),
    );
  }

  factory ProjectModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>;
    return ProjectModel(
      id: snap.id,
      projectCode: data['projectCode'] ?? snap.id,
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
      budgetAccessManagerIds: (data['budgetAccessManagerIds'] as List?)?.map((e) => e.toString()).toList() ?? [],
      workerIds: (data['workerIds'] as List?)?.map((e) => e.toString()).toList() ?? [],
      startDate: (data['startDate'] as Timestamp?)?.toDate(),
      targetEndDate: (data['targetEndDate'] as Timestamp?)?.toDate(),
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'projectCode': projectCode,
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
      'budgetAccessManagerIds': budgetAccessManagerIds,
      'workerIds': workerIds,
      if (startDate != null) 'startDate': Timestamp.fromDate(startDate!),
      if (targetEndDate != null) 'targetEndDate': Timestamp.fromDate(targetEndDate!),
    };
  }
}

