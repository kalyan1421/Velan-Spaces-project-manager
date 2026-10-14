import { derivePhaseStatus, normalizePhase, normalizeTask, projectProgress, TaskState } from './timeline-logic';

const NOW = '2026-10-14T10:00:00.000Z';
const task = (over: Partial<TaskState> = {}): TaskState => ({
  status: 'pending',
  checklistItems: [],
  actualStart: null,
  actualEnd: null,
  ...over,
});
const item = (isDone: boolean) => ({ id: String(Math.random()), label: 'x', isDone });

describe('normalizeTask', () => {
  it('marks a task done when its whole checklist is ticked', () => {
    const t = normalizeTask(task({ status: 'inProgress', checklistItems: [item(true), item(true)] }), NOW);
    expect(t.status).toBe('done');
    expect(t.actualStart).toBe(NOW);
    expect(t.actualEnd).toBe(NOW);
  });

  it('reopens a done task whose checklist is not complete', () => {
    const t = normalizeTask(task({ status: 'done', checklistItems: [item(true), item(false)], actualEnd: NOW }), NOW);
    expect(t.status).toBe('inProgress');
    expect(t.actualEnd).toBeNull();
  });

  it('keeps manual status without a checklist and preserves existing stamps', () => {
    const t = normalizeTask(task({ status: 'done', actualStart: '2026-01-01T00:00:00Z' }), NOW);
    expect(t.status).toBe('done');
    expect(t.actualStart).toBe('2026-01-01T00:00:00Z');
    expect(normalizeTask(task(), NOW).actualStart).toBeNull();
  });
});

describe('derivePhaseStatus', () => {
  it('follows task completion, keeping manual status for empty phases', () => {
    expect(derivePhaseStatus([], 'completed')).toBe('completed');
    expect(derivePhaseStatus([task(), task()], 'completed')).toBe('pending');
    expect(derivePhaseStatus([task({ status: 'done' }), task()], 'pending')).toBe('inProgress');
    expect(derivePhaseStatus([task({ status: 'done' })], 'pending')).toBe('completed');
  });
});

describe('normalizePhase + projectProgress', () => {
  it('computes completion from tasks across phases', () => {
    const phases = [
      normalizePhase({ status: 'pending', tasks: [task({ status: 'done' }), task()] }, NOW),
      normalizePhase({ status: 'pending', tasks: [task({ status: 'done' })] }, NOW),
    ];
    expect(phases.map((p) => p.status)).toEqual(['inProgress', 'completed']);
    expect(projectProgress(phases)).toEqual({ completionPercentage: 67, isComplete: false });
  });

  it('falls back to phase status when there are no tasks', () => {
    expect(
      projectProgress([
        { status: 'completed', tasks: [] },
        { status: 'pending', tasks: [] },
      ]),
    ).toEqual({ completionPercentage: 50, isComplete: false });
    expect(projectProgress([])).toEqual({ completionPercentage: 0, isComplete: false });
    expect(projectProgress([{ status: 'completed', tasks: [] }]).isComplete).toBe(true);
  });
});
