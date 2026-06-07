import 'package:cloud_firestore/cloud_firestore.dart';
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

  factory LeadModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>;
    return LeadModel(
      id: snap.id,
      clientName: data['clientName'] ?? '',
      clientPhone: data['clientPhone'] ?? '',
      area: data['area'] ?? '',
      projectType: data['projectType'] ?? '',
      source: data['source'] ?? '',
      estimatedBudget: data['estimatedBudget'] ?? '',
      notes: data['notes'] ?? '',
      status: data['status'] ?? 'new',
      assignedManagerId: data['assignedManagerId'] ?? '',
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
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
