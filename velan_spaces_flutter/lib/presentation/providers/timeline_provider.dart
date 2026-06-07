import 'package:riverpod_annotation/riverpod_annotation.dart';
import 'package:velan_spaces_flutter/data/repositories/timeline_repository.dart';
import 'package:velan_spaces_flutter/domain/entities/timeline_entity.dart';

part 'timeline_provider.g.dart';

// Helper to generate IDs without uuid package
String _generateId() => DateTime.now().millisecondsSinceEpoch.toString();

@riverpod
class Timeline extends _$Timeline {
  late final TimelineRepository _repository;

  @override
  FutureOr<List<TimelinePhaseEntity>> build(String projectId) async {
    _repository = TimelineRepository();
    return _repository.getPhases(projectId);
  }

  // --- Mutations (Local State Updates) ---

  void addPhase(String name, DateTime start, DateTime end, {String? notes}) {
    final currentList = state.value ?? [];
    final newPhase = TimelinePhaseEntity(
      id: _generateId(),
      name: name,
      startDate: start,
      endDate: end,
      orderIndex: currentList.length,
      tasks: const [],
      notes: notes,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
    state = AsyncValue.data(
      TimelineRepository.normalizePhases([...currentList, newPhase]),
    );
  }

  void updatePhase(String phaseId, {String? name, DateTime? start, DateTime? end, String? notes, PhaseStatus? status}) {
    final currentList = state.value ?? [];
    final newList = currentList.map((p) {
      if (p.id == phaseId) {
        return p.copyWith(
          name: name,
          startDate: start,
          endDate: end,
          notes: notes,
          status: status,
          updatedAt: DateTime.now(),
        );
      }
      return p;
    }).toList();
    state = AsyncValue.data(TimelineRepository.normalizePhases(newList));
  }

  void markPhaseComplete(String phaseId) {
    final currentList = state.value ?? [];
    final newList = currentList.map((p) {
      if (p.id == phaseId) {
        return p.copyWith(status: PhaseStatus.completed, updatedAt: DateTime.now());
      }
      return p;
    }).toList();
    state = AsyncValue.data(TimelineRepository.normalizePhases(newList));
  }

  void removePhase(String phaseId) {
    final currentList = state.value ?? [];
    final newList = currentList.where((p) => p.id != phaseId).toList();
    state = AsyncValue.data(TimelineRepository.normalizePhases(newList));
  }

  void addTask(
    String phaseId,
    String taskTitle, {
    String? description,
    String? workerId,
    String? roomId,
    DateTime? plannedStart,
    DateTime? plannedEnd,
    List<TaskChecklistItem> checklistItems = const [],
    TaskPriority priority = TaskPriority.medium,
  }) {
    final currentList = state.value ?? [];
    final newList = currentList.map((phase) {
      if (phase.id == phaseId) {
        final newTask = TimelineTaskEntity(
          id: _generateId(),
          title: taskTitle,
          description: description,
          status: TaskStatus.pending,
          phaseId: phaseId,
          assignedWorkerId: workerId,
          plannedStart: plannedStart,
          plannedEnd: plannedEnd,
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
          roomId: roomId,
          checklistItems: checklistItems,
          priority: priority,
        );
        return phase.copyWith(
          tasks: [...phase.tasks, newTask],
          updatedAt: DateTime.now(),
        );
      }
      return phase;
    }).toList();
    state = AsyncValue.data(TimelineRepository.normalizePhases(newList));
  }

  void toggleTaskStatus(String phaseId, String taskId) {
    final currentList = state.value ?? [];
    final newList = currentList.map((phase) {
      if (phase.id == phaseId) {
        final newTasks = phase.tasks.map((task) {
          if (task.id == taskId) {
            final newStatus = task.status == TaskStatus.done 
                ? TaskStatus.pending 
                : TaskStatus.done;
            return task.copyWith(
              status: newStatus,
              updatedAt: DateTime.now(),
              actualStart: newStatus != TaskStatus.pending
                  ? (task.actualStart ?? DateTime.now())
                  : null,
              actualEnd: newStatus == TaskStatus.done ? DateTime.now() : null,
            );
          }
          return task;
        }).toList();
        return phase.copyWith(tasks: newTasks, updatedAt: DateTime.now());
      }
      return phase;
    }).toList();
    state = AsyncValue.data(TimelineRepository.normalizePhases(newList));
  }

  void reorderPhases(int oldIndex, int newIndex) {
    final currentList = [...state.value ?? []].cast<TimelinePhaseEntity>();
    if (newIndex > oldIndex) newIndex -= 1;
    final item = currentList.removeAt(oldIndex);
    currentList.insert(newIndex, item);

    // Update order indices
    final updatedList = currentList.asMap().entries
        .map((e) => e.value.copyWith(orderIndex: e.key))
        .toList();

    state = AsyncValue.data(TimelineRepository.normalizePhases(updatedList));
  }

  // Helper _updatePhaseStatus removed in favor of explicit actions or simpler logic for now

  // --- Backend Sync ---

  Future<void> saveAll() async {
    final currentList = state.value;
    if (currentList == null) return;

    state = const AsyncValue.loading();
    try {
      final normalized = TimelineRepository.normalizePhases(currentList);
      await _repository.savePhases(projectId, normalized);
      state = AsyncValue.data(normalized);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}
