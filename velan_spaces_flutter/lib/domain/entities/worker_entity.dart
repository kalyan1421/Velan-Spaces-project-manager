import 'package:flutter/foundation.dart';

@immutable
class WorkerEntity {
  const WorkerEntity({
    required this.id,
    required this.name,
    this.phone = '',
    this.trade = '',
    this.assignedProjects = const [],
  });

  final String id;
  final String name;
  final String phone;
  final String trade;
  final List<String> assignedProjects;
}
