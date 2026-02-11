import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/domain/entities/manager_entity.dart';

class ManagerModel extends ManagerEntity {
  const ManagerModel({
    required super.id,
    required super.name,
    super.phone,
    super.email,
    super.assignedProjects,
  });

  factory ManagerModel.fromSnapshot(DocumentSnapshot snap) {
    final data = snap.data() as Map<String, dynamic>;
    return ManagerModel(
      id: snap.id,
      name: data['name'] ?? '',
      phone: data['phone'] ?? '',
      email: data['email'] ?? '',
      assignedProjects: List<String>.from(data['assignedProjects'] ?? []),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'phone': phone,
      'email': email,
      'assignedProjects': assignedProjects,
    };
  }
}
