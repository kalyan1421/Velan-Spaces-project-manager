/**
 * Timeline status rules — a port of the app's TimelineRepository.normalizePhases
 * / deriveProjectCompletion (lib/data/repositories/timeline_repository.dart) so
 * the server computes the same statuses and project completion the app shows.
 */
export const PHASE_STATUSES = ['pending', 'inProgress', 'completed'] as const;
export const TASK_STATUSES = ['pending', 'inProgress', 'blocked', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const;

export type PhaseStatus = (typeof PHASE_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface ChecklistItem {
  id: string;
  label: string;
  isDone: boolean;
}

export interface TaskState {
  status: TaskStatus;
  checklistItems: ChecklistItem[];
  actualStart: string | null;
  actualEnd: string | null;
}

export interface PhaseState<T extends TaskState = TaskState> {
  status: PhaseStatus;
  tasks: T[];
}

const started = (s: TaskStatus) => s === 'inProgress' || s === 'blocked' || s === 'done';

/** Checklist drives "done"; start/end stamps follow the status. */
export function normalizeTask<T extends TaskState>(task: T, nowIso: string): T {
  const hasChecklist = task.checklistItems.length > 0;
  const allDone = hasChecklist && task.checklistItems.every((i) => i.isDone);
  const status: TaskStatus = allDone
    ? 'done'
    : task.status === 'done' && hasChecklist
      ? 'inProgress'
      : task.status;
  return {
    ...task,
    status,
    actualStart: started(task.status) ? (task.actualStart ?? nowIso) : task.actualStart,
    actualEnd: status === 'done' ? (task.actualEnd ?? nowIso) : null,
  };
}

export function derivePhaseStatus(tasks: TaskState[], current: PhaseStatus): PhaseStatus {
  if (tasks.length === 0) return current;
  const done = tasks.filter((t) => t.status === 'done').length;
  if (done === 0) return 'pending';
  if (done === tasks.length) return 'completed';
  return 'inProgress';
}

export function normalizePhase<T extends TaskState>(phase: PhaseState<T>, nowIso: string): PhaseState<T> {
  const tasks = phase.tasks.map((t) => normalizeTask(t, nowIso));
  return { ...phase, tasks, status: derivePhaseStatus(tasks, phase.status) };
}

/** Project completion % and "complete" flag, as the app derives them. */
export function projectProgress(phases: PhaseState[]): { completionPercentage: number; isComplete: boolean } {
  if (phases.length === 0) return { completionPercentage: 0, isComplete: false };
  const tasks = phases.flatMap((p) => p.tasks);
  const completionPercentage =
    tasks.length > 0
      ? Math.round((tasks.filter((t) => t.status === 'done').length / tasks.length) * 100)
      : Math.round((phases.filter((p) => p.status === 'completed').length / phases.length) * 100);
  return { completionPercentage, isComplete: phases.every((p) => p.status === 'completed') };
}
