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

}

