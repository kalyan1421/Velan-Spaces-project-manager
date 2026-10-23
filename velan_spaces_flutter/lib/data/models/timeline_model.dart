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

}
