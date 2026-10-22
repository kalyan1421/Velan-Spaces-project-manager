import 'package:velan_spaces_flutter/core/api/api_client.dart';
import 'package:velan_spaces_flutter/core/api/polling.dart';
import 'package:velan_spaces_flutter/data/models/timeline_model.dart';
import 'package:velan_spaces_flutter/domain/entities/timeline_entity.dart';

/// Timeline (phases with nested tasks) over the Velan API.
///
/// Managers edit the plan locally and save it whole ([savePhases], atomic on
/// the server). Field progress (status, checklist, comments, photo proofs) goes
/// through the per-task endpoint, which workers may use for their own tasks.
/// The server recomputes phase status and project completion.
class TimelineRepository {
  TimelineRepository({ApiClient? api}) : _api = api ?? ApiClient.instance;

  final ApiClient _api;

  void _changed(String projectId) =>
      ApiInvalidation.instance.notifyAll([ApiTopics.project(projectId), ApiTopics.projects]);

  Future<List<TimelinePhaseEntity>> getPhases(String projectId) async {
    final json = await _api.get('/projects/$projectId/timeline') as List;
    return json
        .whereType<Map>()
        .map((p) => TimelinePhaseModel.fromApi(Map<String, dynamic>.from(p)))
        .toList();
  }

  Future<void> savePhases(String projectId, List<TimelinePhaseEntity> phases) async {
    final normalized = normalizePhases(phases);
    await _api.put('/projects/$projectId/timeline', {
      'phases': normalized.map(TimelinePhaseModel.toApiJson).toList(),
    });
    _changed(projectId);
  }

  Future<void> _patchTask(String projectId, String taskId, Map<String, dynamic> body) async {
    await _api.patch('/projects/$projectId/timeline/tasks/$taskId', body);
    _changed(projectId);
  }

  /// Progress fields only (status + checklist); plan edits go through [savePhases].
  Future<void> updateTask(String projectId, String phaseId, TimelineTaskEntity task) => _patchTask(
        projectId,
        task.id,
        {
          'status': task.status.name,
          'checklistItems': task.checklistItems
              .map((i) => {'id': i.id, 'label': i.label, 'isDone': i.isDone})
              .toList(),
        },
      );

  Future<void> toggleChecklistItem(
    String projectId,
    String phaseId,
    String taskId,
    String checklistItemId,
  ) =>
      _patchTask(projectId, taskId, {'toggleChecklistItemId': checklistItemId});

  /// Author and time come from the signed-in user on the server.
  Future<void> addTaskComment(
    String projectId,
    String phaseId,
    String taskId,
    TaskCommentEntity comment,
  ) =>
      _patchTask(projectId, taskId, {
        'addComment': {'text': comment.text},
      });

  Future<void> addTaskPhotoProof(
    String projectId,
    String phaseId,
    String taskId,
    String photoUrl,
  ) =>
      _patchTask(projectId, taskId, {'addPhotoProofUrl': photoUrl});

  static List<TimelinePhaseEntity> normalizePhases(List<TimelinePhaseEntity> phases) {
    return phases.asMap().entries.map((entry) {
      final phase = entry.value;
      final updatedTasks = phase.tasks.map((task) {
        final shouldBeDone = task.checklistItems.isNotEmpty &&
            task.checklistItems.every((item) => item.isDone);
        final nextStatus = shouldBeDone
            ? TaskStatus.done
            : task.status == TaskStatus.done && task.checklistItems.isNotEmpty
                ? TaskStatus.inProgress
                : task.status;
        return task.copyWith(
          status: nextStatus,
          actualStart: task.hasStarted ? (task.actualStart ?? DateTime.now()) : task.actualStart,
          actualEnd: nextStatus == TaskStatus.done ? (task.actualEnd ?? DateTime.now()) : null,
          updatedAt: DateTime.now(),
        );
      }).toList();

      final normalizedPhase = phase.copyWith(
        orderIndex: entry.key,
        tasks: updatedTasks,
        updatedAt: DateTime.now(),
      );

      return normalizedPhase.copyWith(status: normalizedPhase.deriveStatusFromTasks());
    }).toList();
  }

  static int deriveProjectCompletion(List<TimelinePhaseEntity> phases) {
    if (phases.isEmpty) return 0;
    final allTasks = phases.expand((phase) => phase.tasks).toList();
    if (allTasks.isNotEmpty) {
      final doneTasks = allTasks.where((task) => task.status == TaskStatus.done).length;
      return ((doneTasks / allTasks.length) * 100).round();
    }

    final completedPhases =
        phases.where((phase) => phase.status == PhaseStatus.completed).length;
    return ((completedPhases / phases.length) * 100).round();
  }
}
