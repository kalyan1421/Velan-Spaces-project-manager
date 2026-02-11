import 'package:flutter/foundation.dart';

@immutable
class ManagerEntity {
  const ManagerEntity({
    required this.id,
    required this.name,
    this.phone = '',
    this.email = '',
    this.assignedProjects = const [],
  });

  final String id;
  final String name;
  final String phone;
  final String email;
  final List<String> assignedProjects;
}
