import 'package:flutter/foundation.dart';

enum PhaseStatus { pending, inProgress, completed }
enum TaskStatus { pending, inProgress, blocked, done }
enum TaskPriority { low, medium, high }

@immutable
class TaskChecklistItem {
  const TaskChecklistItem({
    required this.id,
    required this.label,
    this.isDone = false,
  });

  final String id;
  final String label;
  final bool isDone;

  TaskChecklistItem copyWith({
    String? id,
    String? label,
    bool? isDone,
  }) {
    return TaskChecklistItem(
      id: id ?? this.id,
      label: label ?? this.label,
      isDone: isDone ?? this.isDone,
    );
  }
}

@immutable
class TaskCommentEntity {
  const TaskCommentEntity({
    required this.id,
    required this.text,
    required this.postedBy,
    required this.postedById,
    this.createdAt,
  });

  final String id;
  final String text;
  final String postedBy;
  final String postedById;
  final DateTime? createdAt;

  TaskCommentEntity copyWith({
    String? id,
    String? text,
    String? postedBy,
    String? postedById,
    DateTime? createdAt,
  }) {
    return TaskCommentEntity(
      id: id ?? this.id,
      text: text ?? this.text,
      postedBy: postedBy ?? this.postedBy,
      postedById: postedById ?? this.postedById,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

@immutable
class TimelineTaskEntity {
  final String id;
  final String title;
  final String? description;
  final TaskStatus status;
  // New fields
  final String? phaseId;
  final DateTime? plannedStart;
  final DateTime? plannedEnd;
  final DateTime? actualStart;
  final DateTime? actualEnd;
  final String? assignedWorkerId;
  final String? roomId;
  final List<TaskChecklistItem> checklistItems;
  final List<TaskCommentEntity> comments;
  final List<String> photoProofUrls;
  final TaskPriority priority;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const TimelineTaskEntity({
    required this.id,
    required this.title,
    this.description,
    this.status = TaskStatus.pending,
    this.phaseId,
    this.plannedStart,
    this.plannedEnd,
    this.actualStart,
    this.actualEnd,
    this.assignedWorkerId,
    this.roomId,
    this.checklistItems = const [],
    this.comments = const [],
    this.photoProofUrls = const [],
    this.priority = TaskPriority.medium,
    this.createdAt,
    this.updatedAt,
  });

  bool get hasStarted =>
      status == TaskStatus.inProgress ||
      status == TaskStatus.blocked ||
      status == TaskStatus.done;

  bool get hasChecklist => checklistItems.isNotEmpty;

  int get completedChecklistCount =>
      checklistItems.where((item) => item.isDone).length;

  bool get isChecklistComplete =>
      checklistItems.isNotEmpty &&
      checklistItems.every((item) => item.isDone);

  bool get isOverdue {
    if (status == TaskStatus.done || plannedEnd == null) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final end = DateTime(
      plannedEnd!.year,
      plannedEnd!.month,
      plannedEnd!.day,
    );
    return end.isBefore(today);
  }

  TimelineTaskEntity copyWith({
    String? id,
    String? title,
    String? description,
    TaskStatus? status,
    String? phaseId,
    DateTime? plannedStart,
    DateTime? plannedEnd,
    DateTime? actualStart,
    DateTime? actualEnd,
    String? assignedWorkerId,
    String? roomId,
    List<TaskChecklistItem>? checklistItems,
    List<TaskCommentEntity>? comments,
    List<String>? photoProofUrls,
    TaskPriority? priority,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return TimelineTaskEntity(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      status: status ?? this.status,
      phaseId: phaseId ?? this.phaseId,
      plannedStart: plannedStart ?? this.plannedStart,
      plannedEnd: plannedEnd ?? this.plannedEnd,
      actualStart: actualStart ?? this.actualStart,
      actualEnd: actualEnd ?? this.actualEnd,
      assignedWorkerId: assignedWorkerId ?? this.assignedWorkerId,
      roomId: roomId ?? this.roomId,
      checklistItems: checklistItems ?? this.checklistItems,
      comments: comments ?? this.comments,
      photoProofUrls: photoProofUrls ?? this.photoProofUrls,
      priority: priority ?? this.priority,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}

@immutable
class TimelinePhaseEntity {
  final String id;
  final String name;
  final DateTime startDate;
  final DateTime endDate;
  final PhaseStatus status;
  final List<TimelineTaskEntity> tasks;
  final int orderIndex;
  // New fields
  final String? notes;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  const TimelinePhaseEntity({
    required this.id,
    required this.name,
    required this.startDate,
    required this.endDate,
    this.status = PhaseStatus.pending,
    this.tasks = const [],
    this.orderIndex = 0,
    this.notes,
    this.createdAt,
    this.updatedAt,
  });

  // --- Domain Logic ---

  bool get isOverdue {
    if (status == PhaseStatus.completed) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final end = DateTime(endDate.year, endDate.month, endDate.day);
    return end.isBefore(today);
  }

  int get overdueDays {
    if (!isOverdue) return 0;
    final now = DateTime.now();
    return now.difference(endDate).inDays;
  }

  double get progress {
    if (tasks.isEmpty) return status == PhaseStatus.completed ? 1.0 : 0.0;
    final doneCount = tasks.where((t) => t.status == TaskStatus.done).length;
    return doneCount / tasks.length;
  }

  PhaseStatus deriveStatusFromTasks() {
    if (tasks.isEmpty) return status;
    final doneCount = tasks.where((task) => task.status == TaskStatus.done).length;
    if (doneCount == 0) return PhaseStatus.pending;
    if (doneCount == tasks.length) return PhaseStatus.completed;
    return PhaseStatus.inProgress;
  }

  TimelinePhaseEntity copyWith({
    String? id,
    String? name,
    DateTime? startDate,
    DateTime? endDate,
    PhaseStatus? status,
    List<TimelineTaskEntity>? tasks,
    int? orderIndex,
    String? notes,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return TimelinePhaseEntity(
      id: id ?? this.id,
      name: name ?? this.name,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      status: status ?? this.status,
      tasks: tasks ?? this.tasks,
      orderIndex: orderIndex ?? this.orderIndex,
      notes: notes ?? this.notes,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
}
