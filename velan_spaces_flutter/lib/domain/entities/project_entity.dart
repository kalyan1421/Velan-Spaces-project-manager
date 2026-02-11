import 'package:flutter/foundation.dart';

@immutable
class ProjectEntity {
  const ProjectEntity({
    required this.id,
    required this.projectName,
    required this.clientName,
    required this.location,
    required this.budget,
    required this.currentSpend,
    required this.isComplete,
    required this.managerIds,
    this.estimatedCost = 0,
    this.completionPercentage = 0,
    this.startDate,
    this.targetEndDate,
    this.workerIds = const [],
    this.createdAt,
    this.clientPhone = '',
    this.clientEmail = '',
  });

  final String id;
  final String projectName;
  final String clientName;
  final String clientPhone;
  final String clientEmail;
  final String location;
  final double budget;
  final double estimatedCost;
  final double currentSpend;
  final int completionPercentage;
  final bool isComplete;
  final List<String> managerIds;
  final List<String> workerIds;
  final DateTime? startDate;
  final DateTime? targetEndDate;
  final DateTime? createdAt;
}
