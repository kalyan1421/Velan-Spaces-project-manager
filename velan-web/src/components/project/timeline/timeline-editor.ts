/**
 * Client-side timeline editor (head/manager). The whole plan is edited locally
 * and saved with ONE `PUT /projects/:id/timeline` (atomic on the server). Pure
 * reducer + selectors so the editing rules are unit-tested without a DOM.
 *
 * - `key` is the React/list identity: the server id for existing rows, a
 *   client-generated key for new ones (new rows are sent without `id`).
 * - Dates are kept as given (server ISO strings stay byte-identical, so an
 *   untouched phase is not "dirty"); <input type="date"> edits store `YYYY-MM-DD`.
 * - Progress fields (status stamps, comments, photo proofs) round-trip untouched.
 */

import {
  TIMELINE_LIMITS,
  type ChecklistItem,
  type PhaseInput,
  type PhaseStatus,
  type ReplaceTimelineBody,
  type TaskComment,
  type TaskInput,
  type TaskPriority,
  type TaskStatus,
  type TimelinePhase,
  type TimelineTask,
} from "@/lib/api/project-ops";
import { isoToDateKey, normalizePhaseStatus, normalizePriority, normalizeTaskStatus } from "./timeline-model";

export type DraftTask = {
  key: string;
  id?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  /** "" = not set. */
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  /** "" = unassigned / no room. */
  assignedWorkerId: string;
  roomId: string;
  checklistItems: ChecklistItem[];
  comments: TaskComment[];
  photoProofUrls: string[];
  createdAt: string | null;
};

export type DraftPhase = {
  key: string;
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
  status: PhaseStatus;
  notes: string;
  createdAt: string | null;
  tasks: DraftTask[];
};

export type EditorState = {
  phases: DraftPhase[];
  /** Serialized payload of the last saved/loaded timeline; `isDirty` compares against it. */
  baseline: string;
};

export type PhaseFields = Partial<Pick<DraftPhase, "name" | "startDate" | "endDate" | "notes">>;
export type TaskFields = Partial<
  Pick<
    DraftTask,
    "title" | "description" | "status" | "priority" | "plannedStart" | "plannedEnd" | "assignedWorkerId" | "roomId"
  >
>;

export type EditorAction =
  | { type: "reset"; phases: TimelinePhase[] }
  | { type: "replaceDraft"; phases: DraftPhase[] }
  | { type: "addPhase"; key: string; name?: string; startDate?: string; endDate?: string }
  | { type: "updatePhase"; phaseKey: string; patch: PhaseFields }
  | { type: "removePhase"; phaseKey: string }
  | { type: "movePhase"; phaseKey: string; offset: -1 | 1 }
  | { type: "addTask"; phaseKey: string; key: string; title?: string }
  | { type: "updateTask"; phaseKey: string; taskKey: string; patch: TaskFields }
  | { type: "removeTask"; phaseKey: string; taskKey: string }
  | { type: "moveTask"; phaseKey: string; taskKey: string; offset: -1 | 1 }
  | { type: "moveTaskToPhase"; phaseKey: string; taskKey: string; toPhaseKey: string }
  | { type: "addChecklistItem"; phaseKey: string; taskKey: string; itemId: string; label: string }
  | {
      type: "updateChecklistItem";
      phaseKey: string;
      taskKey: string;
      itemId: string;
      patch: Partial<Pick<ChecklistItem, "label" | "isDone">>;
    }
  | { type: "removeChecklistItem"; phaseKey: string; taskKey: string; itemId: string };

// ------------------------------------------------------------------ server -> draft

function draftTask(t: TimelineTask): DraftTask {
  return {
    key: t.id,
    id: t.id,
    title: t.title ?? "",
    description: t.description ?? "",
    status: normalizeTaskStatus(t.status),
    priority: normalizePriority(t.priority),
    plannedStart: t.plannedStart ?? "",
    plannedEnd: t.plannedEnd ?? "",
    actualStart: t.actualStart ?? null,
    actualEnd: t.actualEnd ?? null,
    assignedWorkerId: t.assignedWorkerId ?? "",
    roomId: t.roomId ?? "",
    checklistItems: (t.checklistItems ?? []).map((i) => ({ id: i.id, label: i.label, isDone: Boolean(i.isDone) })),
    comments: t.comments ?? [],
    photoProofUrls: t.photoProofUrls ?? [],
    createdAt: t.createdAt ?? null,
  };
}

export function draftFromServer(phases: TimelinePhase[]): DraftPhase[] {
  return [...phases]
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    .map((p) => ({
      key: p.id,
      id: p.id,
      name: p.name ?? "",
      startDate: p.startDate ?? "",
      endDate: p.endDate ?? "",
      status: normalizePhaseStatus(p.status),
      notes: p.notes ?? "",
      createdAt: p.createdAt ?? null,
      tasks: [...(p.tasks ?? [])].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)).map(draftTask),
    }));
}

// ------------------------------------------------------------------ draft -> PUT body

const orNull = (value: string) => {
  const v = value.trim();
  return v === "" ? null : v;
};

function serializeTask(t: DraftTask): TaskInput {
  return {
    ...(t.id ? { id: t.id } : {}),
    title: t.title.trim(),
    description: orNull(t.description),
    status: t.status,
    priority: t.priority,
    plannedStart: orNull(t.plannedStart),
    plannedEnd: orNull(t.plannedEnd),
    actualStart: t.actualStart,
    actualEnd: t.actualEnd,
    assignedWorkerId: orNull(t.assignedWorkerId),
    roomId: orNull(t.roomId),
    checklistItems: t.checklistItems.map((i) => ({ id: i.id, label: i.label.trim(), isDone: i.isDone })),
    comments: t.comments,
    photoProofUrls: t.photoProofUrls,
    ...(t.createdAt ? { createdAt: t.createdAt } : {}),
  };
}

function serializePhase(p: DraftPhase): PhaseInput {
  return {
    ...(p.id ? { id: p.id } : {}),
    name: p.name.trim(),
    startDate: p.startDate,
    endDate: p.endDate,
    status: p.status,
    notes: orNull(p.notes),
    ...(p.createdAt ? { createdAt: p.createdAt } : {}),
    tasks: p.tasks.map(serializeTask),
  };
}

/** The `PUT /projects/:id/timeline` body for a draft (phase/task order = array order). */
export function serializeDraft(phases: DraftPhase[]): ReplaceTimelineBody {
  return { phases: phases.map(serializePhase) };
}

const snapshot = (phases: DraftPhase[]) => JSON.stringify(serializeDraft(phases));

export function createEditorState(phases: TimelinePhase[]): EditorState {
  const draft = draftFromServer(phases);
  return { phases: draft, baseline: snapshot(draft) };
}

export function isDirty(state: EditorState): boolean {
  return snapshot(state.phases) !== state.baseline;
}

// ------------------------------------------------------------------ reducer

function move<T>(list: T[], index: number, offset: number): T[] | null {
  const target = index + offset;
  if (index < 0 || target < 0 || target >= list.length) return null;
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

function mapPhase(state: EditorState, phaseKey: string, fn: (p: DraftPhase) => DraftPhase): EditorState {
  return { ...state, phases: state.phases.map((p) => (p.key === phaseKey ? fn(p) : p)) };
}

function mapTask(state: EditorState, phaseKey: string, taskKey: string, fn: (t: DraftTask) => DraftTask): EditorState {
  return mapPhase(state, phaseKey, (p) => ({ ...p, tasks: p.tasks.map((t) => (t.key === taskKey ? fn(t) : t)) }));
}

function newTask(key: string, title = ""): DraftTask {
  return {
    key,
    title,
    description: "",
    status: "pending",
    priority: "medium",
    plannedStart: "",
    plannedEnd: "",
    actualStart: null,
    actualEnd: null,
    assignedWorkerId: "",
    roomId: "",
    checklistItems: [],
    comments: [],
    photoProofUrls: [],
    createdAt: null,
  };
}

export function timelineEditorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "reset":
      return createEditorState(action.phases);
    case "replaceDraft":
      return { ...state, phases: action.phases };
    case "addPhase":
      return {
        ...state,
        phases: [
          ...state.phases,
          {
            key: action.key,
            name: action.name ?? "",
            startDate: action.startDate ?? "",
            endDate: action.endDate ?? "",
            status: "pending",
            notes: "",
            createdAt: null,
            tasks: [],
          },
        ],
      };
    case "updatePhase":
      return mapPhase(state, action.phaseKey, (p) => ({ ...p, ...action.patch }));
    case "removePhase":
      return { ...state, phases: state.phases.filter((p) => p.key !== action.phaseKey) };
    case "movePhase": {
      const index = state.phases.findIndex((p) => p.key === action.phaseKey);
      const phases = move(state.phases, index, action.offset);
      return phases ? { ...state, phases } : state;
    }
    case "addTask":
      return mapPhase(state, action.phaseKey, (p) => ({ ...p, tasks: [...p.tasks, newTask(action.key, action.title)] }));
    case "updateTask":
      return mapTask(state, action.phaseKey, action.taskKey, (t) => ({ ...t, ...action.patch }));
    case "removeTask":
      return mapPhase(state, action.phaseKey, (p) => ({ ...p, tasks: p.tasks.filter((t) => t.key !== action.taskKey) }));
    case "moveTask": {
      const phase = state.phases.find((p) => p.key === action.phaseKey);
      if (!phase) return state;
      const tasks = move(phase.tasks, phase.tasks.findIndex((t) => t.key === action.taskKey), action.offset);
      return tasks ? mapPhase(state, action.phaseKey, (p) => ({ ...p, tasks })) : state;
    }
    case "moveTaskToPhase": {
      if (action.phaseKey === action.toPhaseKey) return state;
      const task = state.phases.find((p) => p.key === action.phaseKey)?.tasks.find((t) => t.key === action.taskKey);
      if (!task || !state.phases.some((p) => p.key === action.toPhaseKey)) return state;
      return {
        ...state,
        phases: state.phases.map((p) => {
          if (p.key === action.phaseKey) return { ...p, tasks: p.tasks.filter((t) => t.key !== action.taskKey) };
          if (p.key === action.toPhaseKey) return { ...p, tasks: [...p.tasks, task] };
          return p;
        }),
      };
    }
    case "addChecklistItem":
      return mapTask(state, action.phaseKey, action.taskKey, (t) => ({
        ...t,
        checklistItems: [...t.checklistItems, { id: action.itemId, label: action.label, isDone: false }],
      }));
    case "updateChecklistItem":
      return mapTask(state, action.phaseKey, action.taskKey, (t) => ({
        ...t,
        checklistItems: t.checklistItems.map((i) => (i.id === action.itemId ? { ...i, ...action.patch } : i)),
      }));
    case "removeChecklistItem":
      return mapTask(state, action.phaseKey, action.taskKey, (t) => ({
        ...t,
        checklistItems: t.checklistItems.filter((i) => i.id !== action.itemId),
      }));
  }
}

// ------------------------------------------------------------------ validation

export type EditorIssue = { fieldId: string; message: string };

export const phaseFieldId = (phaseKey: string, field: "name" | "start" | "end") => `phase-${phaseKey}-${field}`;
export const taskFieldId = (taskKey: string, field: "title" | "assignee" | "room" | "start" | "end" | "description") =>
  `task-${taskKey}-${field}`;
export const checklistFieldId = (taskKey: string, itemId: string) => `task-${taskKey}-checklist-${itemId}`;

/** Everything the API would reject (or silently mangle), in screen order. */
export function validateDraft(
  phases: DraftPhase[],
  ctx: { workerIds: readonly string[]; roomIds: readonly string[] },
): EditorIssue[] {
  const issues: EditorIssue[] = [];
  const workers = new Set(ctx.workerIds);
  const rooms = new Set(ctx.roomIds);
  const L = TIMELINE_LIMITS;

  if (phases.length > L.phases) issues.push({ fieldId: "timeline-phases", message: `Use at most ${L.phases} phases.` });

  phases.forEach((p, index) => {
    const label = p.name.trim() || `Phase ${index + 1}`;
    const name = p.name.trim();
    if (!name) issues.push({ fieldId: phaseFieldId(p.key, "name"), message: `Phase ${index + 1}: enter a name.` });
    else if (name.length > L.phaseName)
      issues.push({ fieldId: phaseFieldId(p.key, "name"), message: `${label}: name is too long.` });

    const start = isoToDateKey(p.startDate);
    const end = isoToDateKey(p.endDate);
    if (!start) issues.push({ fieldId: phaseFieldId(p.key, "start"), message: `${label}: choose a start date.` });
    if (!end) issues.push({ fieldId: phaseFieldId(p.key, "end"), message: `${label}: choose an end date.` });
    else if (start && end < start)
      issues.push({ fieldId: phaseFieldId(p.key, "end"), message: `${label}: the end date is before the start date.` });

    if (p.tasks.length > L.tasksPerPhase)
      issues.push({ fieldId: phaseFieldId(p.key, "name"), message: `${label}: use at most ${L.tasksPerPhase} tasks.` });

    p.tasks.forEach((t, ti) => {
      const title = t.title.trim();
      const tLabel = title || `${label}, task ${ti + 1}`;
      if (!title) issues.push({ fieldId: taskFieldId(t.key, "title"), message: `${label}, task ${ti + 1}: enter a title.` });
      else if (title.length > L.taskTitle)
        issues.push({ fieldId: taskFieldId(t.key, "title"), message: `${tLabel}: title is too long.` });
      if (t.description.trim().length > L.description)
        issues.push({ fieldId: taskFieldId(t.key, "description"), message: `${tLabel}: description is too long.` });
      if (t.assignedWorkerId && !workers.has(t.assignedWorkerId))
        issues.push({
          fieldId: taskFieldId(t.key, "assignee"),
          message: `${tLabel}: the assigned worker is no longer on this project — pick another or leave it unassigned.`,
        });
      if (t.roomId && !rooms.has(t.roomId))
        issues.push({ fieldId: taskFieldId(t.key, "room"), message: `${tLabel}: the room no longer exists — pick another.` });
      const ps = isoToDateKey(t.plannedStart);
      const pe = isoToDateKey(t.plannedEnd);
      if (ps && pe && pe < ps)
        issues.push({ fieldId: taskFieldId(t.key, "end"), message: `${tLabel}: planned end is before planned start.` });
      if (t.checklistItems.length > L.checklistItems)
        issues.push({ fieldId: taskFieldId(t.key, "title"), message: `${tLabel}: use at most ${L.checklistItems} checklist items.` });
      for (const item of t.checklistItems) {
        const itemLabel = item.label.trim();
        if (!itemLabel || itemLabel.length > L.checklistLabel)
          issues.push({
            fieldId: checklistFieldId(t.key, item.id),
            message: itemLabel ? `${tLabel}: a checklist item is too long.` : `${tLabel}: a checklist item is empty.`,
          });
      }
    });
  });
  return issues;
}

// ------------------------------------------------------------------ concurrency

const stripQuery = (url: string) => url.split(/[?#]/, 1)[0];

/**
 * Content fingerprint of a server timeline. Ignores what changes on every read
 * (signed-URL tokens, `updatedAt`) so "did someone else change it?" is reliable.
 */
export function timelineFingerprint(phases: TimelinePhase[]): string {
  const body = serializeDraft(draftFromServer(phases));
  for (const p of body.phases) for (const t of p.tasks) t.photoProofUrls = (t.photoProofUrls ?? []).map(stripQuery);
  return JSON.stringify(body);
}

type Progress = Pick<DraftTask, "status" | "actualStart" | "actualEnd" | "comments" | "photoProofUrls"> & {
  done: Record<string, boolean>;
};

function progressOf(t: DraftTask): Progress {
  return {
    status: t.status,
    actualStart: t.actualStart,
    actualEnd: t.actualEnd,
    comments: t.comments,
    photoProofUrls: t.photoProofUrls.map(stripQuery),
    done: Object.fromEntries(t.checklistItems.map((i) => [i.id, i.isDone])),
  };
}

const sameProgress = (a: Progress, b: Progress) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Before overwriting a timeline that changed on the server, carry over field
 * progress (status, stamps, comments, photos, ticked items) for tasks whose
 * progress the editor did not touch — so a worker's update isn't lost when a
 * manager saves an older plan. Plan fields always come from the draft.
 */
export function rebaseProgress(draft: DraftPhase[], baseline: TimelinePhase[], latest: TimelinePhase[]): DraftPhase[] {
  const index = (phases: DraftPhase[]) => new Map(phases.flatMap((p) => p.tasks).filter((t) => t.id).map((t) => [t.id!, t]));
  const before = index(draftFromServer(baseline));
  const after = index(draftFromServer(latest));

  return draft.map((p) => ({
    ...p,
    tasks: p.tasks.map((t) => {
      const base = t.id ? before.get(t.id) : undefined;
      const server = t.id ? after.get(t.id) : undefined;
      if (!base || !server || !sameProgress(progressOf(t), progressOf(base))) return t;
      const serverDone = new Map(server.checklistItems.map((i) => [i.id, i.isDone]));
      return {
        ...t,
        status: server.status,
        actualStart: server.actualStart,
        actualEnd: server.actualEnd,
        comments: server.comments,
        photoProofUrls: server.photoProofUrls,
        checklistItems: t.checklistItems.map((i) => (serverDone.has(i.id) ? { ...i, isDone: serverDone.get(i.id)! } : i)),
      };
    }),
  }));
}
