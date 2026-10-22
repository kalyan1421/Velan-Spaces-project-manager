import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/core/api/api_parse.dart';
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

  factory TimelinePhaseModel.fromApi(Map<String, dynamic> j) {
    return TimelinePhaseModel(
      id: apiString(j['id']),
      name: apiString(j['name'], 'Unnamed Phase'),
      startDate: apiDate(j['startDate']) ?? DateTime.now(),
      endDate: apiDate(j['endDate']) ?? DateTime.now(),
      status: PhaseStatus.values.firstWhere(
        (e) => e.name == j['status'],
        orElse: () => PhaseStatus.pending,
      ),
      orderIndex: apiInt(j['orderIndex']) ?? 0,
      tasks: (j['tasks'] as List? ?? const [])
          .whereType<Map>()
          .map((t) => TimelineTaskModel.fromApi(Map<String, dynamic>.from(t)))
          .toList(),
      notes: j['notes'] as String?,
      createdAt: apiDate(j['createdAt']),
      updatedAt: apiDate(j['updatedAt']),
    );
  }

  /// Body for `PUT /projects/:id/timeline` (one phase).
  static Map<String, dynamic> toApiJson(TimelinePhaseEntity p) {
    return {
      'id': p.id,
      'name': p.name,
      'startDate': apiTimestamp(p.startDate),
      'endDate': apiTimestamp(p.endDate),
      'status': p.status.name,
      'notes': p.notes,
      'createdAt': apiTimestamp(p.createdAt),
      'tasks': p.tasks.map(TimelineTaskModel.toApiJson).toList(),
    };
  }

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
    super.checklistItems,
    super.comments,
    super.photoProofUrls,
    super.priority,
    super.createdAt,
    super.updatedAt,
  });

  factory TimelineTaskModel.fromApi(Map<String, dynamic> j) {
    return TimelineTaskModel(
      id: apiString(j['id']),
      title: apiString(j['title']),
      description: j['description'] as String?,
      status: TaskStatus.values.firstWhere(
        (e) => e.name == j['status'],
        orElse: () => TaskStatus.pending,
      ),
      phaseId: j['phaseId'] as String?,
      plannedStart: apiDate(j['plannedStart']),
      plannedEnd: apiDate(j['plannedEnd']),
      actualStart: apiDate(j['actualStart']),
      actualEnd: apiDate(j['actualEnd']),
      assignedWorkerId: j['assignedWorkerId'] as String?,
      roomId: j['roomId'] as String?,
      checklistItems: (j['checklistItems'] as List? ?? const [])
          .whereType<Map>()
          .map((item) => TaskChecklistItem(
                id: apiString(item['id']),
                label: apiString(item['label']),
                isDone: item['isDone'] == true,
              ))
          .toList(),
      comments: (j['comments'] as List? ?? const [])
          .whereType<Map>()
          .map((c) => TaskCommentEntity(
                id: apiString(c['id']),
                text: apiString(c['text']),
                postedBy: apiString(c['postedBy']),
                postedById: apiString(c['postedById']),
                createdAt: apiDate(c['createdAt']),
              ))
          .toList(),
      photoProofUrls: apiStringList(j['photoProofUrls']),
      priority: TaskPriority.values.firstWhere(
        (p) => p.name == j['priority'],
        orElse: () => TaskPriority.medium,
      ),
      createdAt: apiDate(j['createdAt']),
      updatedAt: apiDate(j['updatedAt']),
    );
  }

  static Map<String, dynamic> toApiJson(TimelineTaskEntity t) {
    return {
      'id': t.id,
      'title': t.title,
      'description': t.description,
      'status': t.status.name,
      'priority': t.priority.name,
      'plannedStart': apiTimestamp(t.plannedStart),
      'plannedEnd': apiTimestamp(t.plannedEnd),
      'actualStart': apiTimestamp(t.actualStart),
      'actualEnd': apiTimestamp(t.actualEnd),
      'assignedWorkerId': t.assignedWorkerId,
      'roomId': t.roomId,
      'checklistItems': t.checklistItems
          .map((i) => {'id': i.id, 'label': i.label, 'isDone': i.isDone})
          .toList(),
      'comments': t.comments
          .map((c) => {
                'id': c.id,
                'text': c.text,
                'postedBy': c.postedBy,
                'postedById': c.postedById,
                'createdAt': apiTimestamp(c.createdAt),
              })
          .toList(),
      'photoProofUrls': t.photoProofUrls,
      'createdAt': apiTimestamp(t.createdAt),
    };
  }

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
      checklistItems: (json['checklistItems'] as List<dynamic>? ?? const [])
          .map((item) => TaskChecklistItem(
                id: item['id'] ?? '',
                label: item['label'] ?? '',
                isDone: item['isDone'] ?? false,
              ))
          .toList(),
      comments: (json['comments'] as List<dynamic>? ?? const [])
          .map((comment) => TaskCommentEntity(
                id: comment['id'] ?? '',
                text: comment['text'] ?? '',
                postedBy: comment['postedBy'] ?? '',
                postedById: comment['postedById'] ?? '',
                createdAt: (comment['createdAt'] as Timestamp?)?.toDate(),
              ))
          .toList(),
      photoProofUrls: List<String>.from(json['photoProofUrls'] ?? const []),
      priority: TaskPriority.values.firstWhere(
        (priority) => priority.name == json['priority'],
        orElse: () => TaskPriority.medium,
      ),
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
      'checklistItems': checklistItems
          .map((item) => {
                'id': item.id,
                'label': item.label,
                'isDone': item.isDone,
              })
          .toList(),
      'comments': comments
          .map((comment) => {
                'id': comment.id,
                'text': comment.text,
                'postedBy': comment.postedBy,
                'postedById': comment.postedById,
                'createdAt': comment.createdAt != null
                    ? Timestamp.fromDate(comment.createdAt!)
                    : FieldValue.serverTimestamp(),
              })
          .toList(),
      'photoProofUrls': photoProofUrls,
      'priority': priority.name,
      'createdAt': createdAt != null ? Timestamp.fromDate(createdAt!) : null,
      'updatedAt': updatedAt != null ? Timestamp.fromDate(updatedAt!) : null,
    };
  }
}
