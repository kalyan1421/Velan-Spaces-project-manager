import 'package:flutter/foundation.dart';

@immutable
class WorkerEntity {
  const WorkerEntity({
    required this.id,
    required this.name,
    this.phone = '',
    this.trade = '',
    this.password = '',
    this.assignedProjects = const [],
  });

  final String id;
  final String name;
  final String phone;
  final String trade;
  final String password;
  final List<String> assignedProjects;
}
