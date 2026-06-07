import 'package:flutter_test/flutter_test.dart';
import 'package:velan_spaces_flutter/data/repositories/timeline_repository.dart';
import 'package:velan_spaces_flutter/domain/entities/timeline_entity.dart';

void main() {
  group('TimelineRepository', () {
    test('deriveProjectCompletion uses task completion when tasks exist', () {
      final phases = [
        TimelinePhaseEntity(
          id: 'phase-1',
          name: 'Phase 1',
          startDate: DateTime(2026, 1, 1),
          endDate: DateTime(2026, 1, 10),
          tasks: const [
            TimelineTaskEntity(id: 'task-1', title: 'A', status: TaskStatus.done),
            TimelineTaskEntity(id: 'task-2', title: 'B', status: TaskStatus.pending),
          ],
        ),
      ];

      expect(TimelineRepository.deriveProjectCompletion(phases), 50);
    });

    test('normalizePhases rolls phase status up from task completion', () {
      final phases = [
        TimelinePhaseEntity(
          id: 'phase-1',
          name: 'Execution',
          startDate: DateTime(2026, 1, 1),
          endDate: DateTime(2026, 1, 10),
          status: PhaseStatus.pending,
          tasks: const [
            TimelineTaskEntity(id: 'task-1', title: 'A', status: TaskStatus.done),
            TimelineTaskEntity(id: 'task-2', title: 'B', status: TaskStatus.pending),
          ],
        ),
      ];

      final normalized = TimelineRepository.normalizePhases(phases);

      expect(normalized.single.status, PhaseStatus.inProgress);
    });

    test('normalizePhases completes checklist-driven tasks automatically', () {
      final phases = [
        TimelinePhaseEntity(
          id: 'phase-1',
          name: 'Handover',
          startDate: DateTime(2026, 1, 1),
          endDate: DateTime(2026, 1, 10),
          tasks: const [
            TimelineTaskEntity(
              id: 'task-1',
              title: 'Snag fixes',
              checklistItems: [
                TaskChecklistItem(id: '1', label: 'Paint touch up', isDone: true),
                TaskChecklistItem(id: '2', label: 'Clean room', isDone: true),
              ],
            ),
          ],
        ),
      ];

      final normalized = TimelineRepository.normalizePhases(phases);

      expect(normalized.single.tasks.single.status, TaskStatus.done);
      expect(normalized.single.status, PhaseStatus.completed);
    });
  });
}
