/**
 * Pure timeline helpers shared by the staff timeline, the worker view and the
 * client portal: status normalisation (legacy rows carry Firestore-era values),
 * IST date keys for <input type="date">, permissions and schedule-bar maths.
 * Completion % is NOT computed here — the API owns it (project.completionPercentage).
 */

import {
  PHASE_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type ChecklistItem,
  type PhaseStatus,
  type TaskPriority,
  type TaskStatus,
  type TimelinePhase,
  type TimelineTask,
} from "@/lib/api/project-ops";
import type { Role } from "@/lib/api/types";
import { TIME_ZONE } from "@/lib/format";

// ------------------------------------------------------------------ statuses

const TASK_ALIASES: Record<string, TaskStatus> = { notStarted: "pending", completed: "done", todo: "pending" };
const PHASE_ALIASES: Record<string, PhaseStatus> = { notStarted: "pending", done: "completed" };

export function normalizeTaskStatus(value: string | null | undefined): TaskStatus {
  if (value && (TASK_STATUSES as readonly string[]).includes(value)) return value as TaskStatus;
  return (value && TASK_ALIASES[value]) || "pending";
}

export function normalizePhaseStatus(value: string | null | undefined): PhaseStatus {
  if (value && (PHASE_STATUSES as readonly string[]).includes(value)) return value as PhaseStatus;
  return (value && PHASE_ALIASES[value]) || "pending";
}

export function normalizePriority(value: string | null | undefined): TaskPriority {
  const v = (value ?? "").toLowerCase();
  return (TASK_PRIORITIES as readonly string[]).includes(v) ? (v as TaskPriority) : "medium";
}

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "Not started",
  inProgress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

export const PHASE_STATUS_LABEL: Record<PhaseStatus, string> = {
  pending: "Not started",
  inProgress: "In progress",
  completed: "Completed",
};

export const PRIORITY_LABEL: Record<TaskPriority, string> = { low: "Low", medium: "Medium", high: "High" };

// ------------------------------------------------------------------ dates

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const istKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** `YYYY-MM-DD` on the Indian calendar (what <input type="date"> shows), or "" when unknown. */
export function isoToDateKey(value: string | null | undefined): string {
  if (!value) return "";
  if (DATE_KEY.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : istKey.format(d);
}

/** Today's date key in IST. */
export function todayDateKey(now: Date = new Date()): string {
  return istKey.format(now);
}

/** Calendar arithmetic on date keys (UTC maths, so no DST/time-zone drift). */
export function addDaysToDateKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

/** Default dates for a new phase: the day after the latest phase ends, else project start, else today; 2 weeks long. */
export function nextPhaseDates(
  phaseEndDates: (string | null | undefined)[],
  { today, projectStart }: { today: string; projectStart?: string | null },
): { startDate: string; endDate: string } {
  const ends = phaseEndDates.map(isoToDateKey).filter(Boolean).sort();
  const lastEnd = ends.at(-1);
  const start = lastEnd ? addDaysToDateKey(lastEnd, 1) : isoToDateKey(projectStart) || today;
  return { startDate: start, endDate: addDaysToDateKey(start, 14) };
}

// ------------------------------------------------------------------ progress & permissions

export function phaseProgress(phase: Pick<TimelinePhase, "tasks">): { done: number; total: number } {
  const total = phase.tasks.length;
  const done = phase.tasks.filter((t) => normalizeTaskStatus(t.status) === "done").length;
  return { done, total };
}

export function timelineCounts(phases: TimelinePhase[]): { phases: number; tasks: number; done: number } {
  let tasks = 0;
  let done = 0;
  for (const p of phases) {
    const progress = phaseProgress(p);
    tasks += progress.total;
    done += progress.done;
  }
  return { phases: phases.length, tasks, done };
}

export type Viewer = { id: string; role: Role };

/** Only head and managers may replace the plan (PUT /timeline). */
export function canUpdateTimelinePlan(role: Role): boolean {
  return role === "head" || role === "manager";
}

/** PATCH /timeline/tasks/:id — staff on any task, workers on their own tasks, clients never. */
export function canProgressTask(viewer: Viewer, task: Pick<TimelineTask, "assignedWorkerId">): boolean {
  if (viewer.role === "head" || viewer.role === "manager") return true;
  return viewer.role === "worker" && task.assignedWorkerId === viewer.id;
}

/** Phases containing the worker's tasks, with only those tasks. */
export function tasksAssignedTo(phases: TimelinePhase[], workerId: string): TimelinePhase[] {
  return phases
    .map((p) => ({ ...p, tasks: p.tasks.filter((t) => t.assignedWorkerId === workerId) }))
    .filter((p) => p.tasks.length > 0);
}

/** Whole checklist with one item set — an idempotent PATCH body (safe to retry, unlike a toggle). */
export function checklistToggled(items: ChecklistItem[], itemId: string, isDone: boolean): ChecklistItem[] {
  return items.map((i) => (i.id === itemId ? { ...i, isDone } : i));
}

// ------------------------------------------------------------------ schedule (Gantt-lite)

export type ScheduleBar = { id: string; name: string; start: string; end: string; offset: number; width: number };

/** Phase bars as % of the overall span (inclusive days). Phases without both dates are skipped. */
export function scheduleBars(phases: Pick<TimelinePhase, "id" | "name" | "startDate" | "endDate">[]): {
  range: { start: string; end: string } | null;
  items: ScheduleBar[];
} {
  const dated = phases
    .map((p) => {
      const start = isoToDateKey(p.startDate);
      const end = isoToDateKey(p.endDate);
      if (!start || !end) return null;
      return { id: p.id, name: p.name, start, end: end < start ? start : end };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
  if (dated.length === 0) return { range: null, items: [] };

  const first = dated.reduce((min, p) => (p.start < min ? p.start : min), dated[0].start);
  const last = dated.reduce((max, p) => (p.end > max ? p.end : max), dated[0].end);
  const span = dayNumber(last) - dayNumber(first) + 1;
  const pct = (days: number) => Math.round((days / span) * 10_000) / 100;

  return {
    range: { start: first, end: last },
    items: dated.map((p) => ({
      ...p,
      offset: pct(dayNumber(p.start) - dayNumber(first)),
      width: pct(dayNumber(p.end) - dayNumber(p.start) + 1),
    })),
  };
}
