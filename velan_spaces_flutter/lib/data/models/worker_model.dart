import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/domain/entities/worker_entity.dart';

class WorkerModel extends WorkerEntity {
  const WorkerModel({
    required super.id,
    required super.name,
    super.phone,
    super.trade,
    super.assignedProjects,
  });

  factory WorkerModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>;
    return WorkerModel(
      id: snap.id,
      name: data['name'] ?? '',
      phone: data['phone'] ?? '',
      trade: data['trade'] ?? '',
      assignedProjects: List<String>.from(data['assignedProjects'] ?? []),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'phone': phone,
      'trade': trade,
      'assignedProjects': assignedProjects,
    };
  }
}
