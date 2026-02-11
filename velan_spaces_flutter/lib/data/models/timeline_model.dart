import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/domain/entities/timeline_entity.dart';

class TimelinePhaseModel extends TimelinePhaseEntity {
  const TimelinePhaseModel({
    required super.id,
    required super.name,
    required super.startDate,
    required super.endDate,
    required super.status,
    required super.tasks,
    required super.orderIndex,
    super.notes,
    super.createdAt,
    super.updatedAt,
  });

  factory TimelinePhaseModel.fromJson(Map<String, dynamic> json) {
    return TimelinePhaseModel(
      id: json['id'] ?? '',
      name: json['name'] ?? 'Unnamed Phase',
      startDate: (json['startDate'] as Timestamp).toDate(),
      endDate: (json['endDate'] as Timestamp).toDate(),
      status: PhaseStatus.values.firstWhere(
          (e) => e.name == json['status'],
          orElse: () => PhaseStatus.pending),
      orderIndex: json['orderIndex'] ?? 0,
      tasks: (json['tasks'] as List<dynamic>? ?? [])
          .map((t) => TimelineTaskModel.fromJson(t))
          .toList(),
      notes: json['notes'],
      createdAt: (json['createdAt'] as Timestamp?)?.toDate(),
      updatedAt: (json['updatedAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'startDate': Timestamp.fromDate(startDate),
      'endDate': Timestamp.fromDate(endDate),
      'status': status.name,
      'orderIndex': orderIndex,
      'tasks': tasks.map((t) => (t as TimelineTaskModel).toJson()).toList(),
      'notes': notes,
      'createdAt': createdAt != null ? Timestamp.fromDate(createdAt!) : null,
      'updatedAt': updatedAt != null ? Timestamp.fromDate(updatedAt!) : null,
    };
  }
}

class TimelineTaskModel extends TimelineTaskEntity {
  const TimelineTaskModel({
    required super.id,
    required super.title,
    super.description,
    required super.status,
    super.phaseId,
    super.plannedStart,
    super.plannedEnd,
    super.actualStart,
    super.actualEnd,
    super.assignedWorkerId,
    super.roomId,
    super.createdAt,
    super.updatedAt,
  });

  factory TimelineTaskModel.fromJson(Map<String, dynamic> json) {
    return TimelineTaskModel(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      description: json['description'],
      status: TaskStatus.values.firstWhere(
          (e) => e.name == json['status'],
          orElse: () => TaskStatus.pending),
      phaseId: json['phaseId'],
      plannedStart: (json['plannedStart'] as Timestamp?)?.toDate(),
      plannedEnd: (json['plannedEnd'] as Timestamp?)?.toDate(),
      actualStart: (json['actualStart'] as Timestamp?)?.toDate(),
      actualEnd: (json['actualEnd'] as Timestamp?)?.toDate(),
      assignedWorkerId: json['assignedWorkerId'],
      roomId: json['roomId'],
      createdAt: (json['createdAt'] as Timestamp?)?.toDate(),
      updatedAt: (json['updatedAt'] as Timestamp?)?.toDate(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'description': description,
      'status': status.name,
      'phaseId': phaseId,
      'plannedStart': plannedStart != null ? Timestamp.fromDate(plannedStart!) : null,
      'plannedEnd': plannedEnd != null ? Timestamp.fromDate(plannedEnd!) : null,
      'actualStart': actualStart != null ? Timestamp.fromDate(actualStart!) : null,
      'actualEnd': actualEnd != null ? Timestamp.fromDate(actualEnd!) : null,
      'assignedWorkerId': assignedWorkerId,
      'roomId': roomId,
      'createdAt': createdAt != null ? Timestamp.fromDate(createdAt!) : null,
      'updatedAt': updatedAt != null ? Timestamp.fromDate(updatedAt!) : null,
    };
  }
}
