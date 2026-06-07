import 'package:flutter/foundation.dart';

@immutable
class ManagerEntity {
  const ManagerEntity({
    required this.id,
    required this.name,
    this.phone = '',
    this.email = '',
    this.password = '',
    this.isSuspended = false,
    this.assignedProjects = const [],
  });

  final String id;
  final String name;
  final String phone;
  final String email;
  final String password;
  final bool isSuspended;
  final List<String> assignedProjects;
}
