import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:velan_spaces_flutter/data/models/timeline_model.dart';
import 'package:velan_spaces_flutter/domain/entities/timeline_entity.dart';

class TimelineRepository {
  final FirebaseFirestore _firestore;

  TimelineRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  Future<List<TimelinePhaseEntity>> getPhases(String projectId) async {
    try {
      final snapshot = await _firestore
          .collection('projects')
          .doc(projectId)
          .collection('phases')
          .orderBy('orderIndex')
          .get();

      return snapshot.docs
          .map((doc) => TimelinePhaseModel.fromJson(doc.data()))
          .toList();
    } catch (e) {
      throw Exception('Failed to fetch timeline: $e');
    }
  }

  Future<void> savePhases(String projectId, List<TimelinePhaseEntity> phases) async {
    final normalizedPhases = normalizePhases(phases);
    final batch = _firestore.batch();
    final collectionRef = _firestore
        .collection('projects')
        .doc(projectId)
        .collection('phases');

    // For simplicity in MVP: Delete all and re-add to ensure order/updates are synced
    // In production, you would diff the lists to minimize writes.
    final existingDocs = await collectionRef.get();
    for (var doc in existingDocs.docs) {
      batch.delete(doc.reference);
    }

    for (var phase in normalizedPhases) {
      // Convert Entity to Model for JSON serialization
      final model = TimelinePhaseModel(
        id: phase.id,
        name: phase.name,
        startDate: phase.startDate,
        endDate: phase.endDate,
        status: phase.status,
        tasks: phase.tasks,
        orderIndex: phase.orderIndex,
        notes: phase.notes,
        createdAt: phase.createdAt,
        updatedAt: phase.updatedAt ?? DateTime.now(),
      );
      
      // Use phase.id as doc ID
      batch.set(collectionRef.doc(phase.id), model.toJson());
    }

    await batch.commit();
    await _persistProjectProgress(projectId, normalizedPhases);
  }

  Future<void> updateTask(String projectId, String phaseId, TimelineTaskEntity task) async {
    final phases = await getPhases(projectId);
    final updatedPhases = normalizePhases(
      phases.map((phase) {
        if (phase.id != phaseId) return phase;
        final updatedTasks = phase.tasks
            .map((existingTask) => existingTask.id == task.id ? task : existingTask)
            .toList();
        return phase.copyWith(
          tasks: updatedTasks,
          updatedAt: DateTime.now(),
        );
      }).toList(),
    );
    await savePhases(projectId, updatedPhases);
  }

  Future<void> toggleChecklistItem(
    String projectId,
    String phaseId,
    String taskId,
    String checklistItemId,
  ) async {
    final phases = await getPhases(projectId);
    final updatedPhases = normalizePhases(
      phases.map((phase) {
        if (phase.id != phaseId) return phase;
        final updatedTasks = phase.tasks.map((task) {
          if (task.id != taskId) return task;
          final updatedChecklist = task.checklistItems.map((item) {
            if (item.id != checklistItemId) return item;
            return item.copyWith(isDone: !item.isDone);
          }).toList();
          return task.copyWith(
            checklistItems: updatedChecklist,
            updatedAt: DateTime.now(),
          );
        }).toList();
        return phase.copyWith(tasks: updatedTasks, updatedAt: DateTime.now());
      }).toList(),
    );
    await savePhases(projectId, updatedPhases);
  }

  Future<void> addTaskComment(
    String projectId,
    String phaseId,
    String taskId,
    TaskCommentEntity comment,
  ) async {
    final phases = await getPhases(projectId);
    final updatedPhases = normalizePhases(
      phases.map((phase) {
        if (phase.id != phaseId) return phase;
        final updatedTasks = phase.tasks.map((task) {
          if (task.id != taskId) return task;
          return task.copyWith(
            comments: [...task.comments, comment],
            updatedAt: DateTime.now(),
          );
        }).toList();
        return phase.copyWith(tasks: updatedTasks, updatedAt: DateTime.now());
      }).toList(),
    );
    await savePhases(projectId, updatedPhases);
  }

  Future<void> addTaskPhotoProof(
    String projectId,
    String phaseId,
    String taskId,
    String photoUrl,
  ) async {
    final phases = await getPhases(projectId);
    final updatedPhases = normalizePhases(
      phases.map((phase) {
        if (phase.id != phaseId) return phase;
        final updatedTasks = phase.tasks.map((task) {
          if (task.id != taskId) return task;
          return task.copyWith(
            photoProofUrls: [...task.photoProofUrls, photoUrl],
            updatedAt: DateTime.now(),
          );
        }).toList();
        return phase.copyWith(tasks: updatedTasks, updatedAt: DateTime.now());
      }).toList(),
    );
    await savePhases(projectId, updatedPhases);
  }

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

  Future<void> _persistProjectProgress(
    String projectId,
    List<TimelinePhaseEntity> phases,
  ) async {
    await _firestore.collection('projects').doc(projectId).update({
      'completionPercentage': deriveProjectCompletion(phases),
      'isComplete': phases.isNotEmpty &&
          phases.every((phase) => phase.status == PhaseStatus.completed),
    });
  }
}
