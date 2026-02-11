import 'package:flutter/foundation.dart';

@immutable
class TimelinePhaseEntity {
  const TimelinePhaseEntity({
    required this.name,
    this.status = 'pending',
    this.startDate,
    this.targetDate,
    this.progress = 0,
    this.tasks = const [],
  });

  final String name;
  final String status; // 'pending', 'in-progress', 'completed'
  final String? startDate;
  final String? targetDate;
  final int progress;
  final List<TimelineTaskEntity> tasks;
}

@immutable
class TimelineTaskEntity {
  const TimelineTaskEntity({
    required this.name,
    this.isComplete = false,
  });

  final String name;
  final bool isComplete;
}
