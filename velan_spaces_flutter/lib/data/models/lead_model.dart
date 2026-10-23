import 'package:velan_spaces_flutter/core/api/api_parse.dart';
import 'package:velan_spaces_flutter/domain/entities/lead_entity.dart';

class LeadModel extends LeadEntity {
  const LeadModel({
    required super.id,
    required super.clientName,
    super.clientPhone,
    super.area,
    super.projectType,
    super.source,
    super.estimatedBudget,
    super.notes,
    super.status,
    super.assignedManagerId,
    super.createdAt,
  });

  factory LeadModel.fromApi(Map<String, dynamic> j) {
    return LeadModel(
      id: apiString(j['id']),
      clientName: apiString(j['clientName']),
      clientPhone: apiString(j['clientPhone']),
      area: apiString(j['area']),
      projectType: apiString(j['projectType']),
      source: apiString(j['source']),
      estimatedBudget: apiString(j['estimatedBudget']),
      notes: apiString(j['notes']),
      status: apiString(j['status'], 'new'),
      assignedManagerId: apiString(j['assignedManagerId']),
      createdAt: apiDate(j['createdAt']),
    );
  }

  factory LeadModel.fromEntity(LeadEntity entity) {
    return LeadModel(
      id: entity.id,
      clientName: entity.clientName,
      clientPhone: entity.clientPhone,
      area: entity.area,
      projectType: entity.projectType,
      source: entity.source,
      estimatedBudget: entity.estimatedBudget,
      notes: entity.notes,
      status: entity.status,
      assignedManagerId: entity.assignedManagerId,
      createdAt: entity.createdAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'clientName': clientName,
      'clientPhone': clientPhone,
      'area': area,
      'projectType': projectType,
      'source': source,
      'estimatedBudget': estimatedBudget,
      'notes': notes,
      'status': status,
      'assignedManagerId': assignedManagerId,
    };
  }
}
