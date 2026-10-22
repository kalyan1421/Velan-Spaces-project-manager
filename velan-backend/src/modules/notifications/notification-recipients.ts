/**
 * Pure rules for who gets a notification and what it says. Kept free of
 * Nest/Supabase so they are unit-tested directly (notification-recipients.spec.ts).
 */
import type { AppRole } from '../../common/types/authenticated-user';
import type { NotifyPayload, ProjectAudience } from './notification-types';

export type MemberRole = 'manager' | 'worker' | 'client';

export interface ProjectMemberRef {
  userId: string;
  memberRole: MemberRole;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Order-preserving de-duplication that drops empty ids and excluded ones. */
export function uniqueRecipients(
  ids: (string | null | undefined)[],
  exclude: (string | null | undefined)[] = [],
): string[] {
  const skip = new Set(exclude.filter((x): x is string => !!x));
  const out: string[] = [];
  for (const id of ids) {
    if (!id || skip.has(id) || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

/**
 * Recipients of a project-scoped notification: the members whose role is in
 * the audience, plus every head when `heads` is set — minus excluded users.
 */
export function selectProjectRecipients(
  members: ProjectMemberRef[],
  headIds: string[],
  audience: ProjectAudience,
  exclude: (string | null | undefined)[] = [],
): string[] {
  const wanted = new Set<MemberRole>();
  if (audience.clients) wanted.add('client');
  if (audience.managers) wanted.add('manager');
  if (audience.workers) wanted.add('worker');
  const fromMembers = members.filter((m) => wanted.has(m.memberRole)).map((m) => m.userId);
  return uniqueRecipients([...fromMembers, ...(audience.heads ? headIds : [])], exclude);
}

/** Project staff = the project's managers + all heads (same as notifyProjectStaff). */
export const STAFF_AUDIENCE: ProjectAudience = { managers: true, heads: true };
export const CLIENT_AUDIENCE: ProjectAudience = { clients: true };

/** A client-visible update goes to the client(s) and the project staff. */
export const UPDATE_AUDIENCE: ProjectAudience = { clients: true, managers: true, heads: true };

/** Chat is client <-> staff: a client's message alerts staff; staff/worker messages alert the client(s). */
export function chatAudience(senderRole: AppRole): ProjectAudience {
  return senderRole === 'client' ? STAFF_AUDIENCE : CLIENT_AUDIENCE;
}

/** Complaint status changes go to the project's client(s) and whoever raised it. */
export function complaintStatusRecipients(
  members: ProjectMemberRef[],
  createdBy: string | null | undefined,
  actorId: string,
): string[] {
  const clients = members.filter((m) => m.memberRole === 'client').map((m) => m.userId);
  return uniqueRecipients([...clients, createdBy], [actorId]);
}

// ------------------------------------------------------------ text helpers

/** Collapse whitespace and cut to `max` chars with an ellipsis (push bodies are short). */
export function preview(text: string | null | undefined, max = 140): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  inProgress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

export function complaintStatusLabel(status: string): string {
  return COMPLAINT_STATUS_LABELS[status] ?? status;
}

export function updateNotification(input: {
  content: string | null | undefined;
  posterName: string | null | undefined;
  updateId: string;
  projectId: string;
  senderId: string;
}): NotifyPayload {
  const who = input.posterName?.trim() || 'The team';
  return {
    title: 'New project update',
    body: preview(input.content) || `${who} posted an update`,
    type: 'update',
    projectId: input.projectId,
    entityId: input.updateId,
    senderId: input.senderId,
    senderName: input.posterName ?? undefined,
  };
}

export function chatNotification(input: {
  content: string | null | undefined;
  messageType?: string | null;
  senderName: string | null | undefined;
  messageId: string;
  projectId: string;
  senderId: string;
}): NotifyPayload {
  const who = input.senderName?.trim() || 'Someone';
  const text = preview(input.content);
  const body = text || (input.messageType && input.messageType !== 'text' ? 'Sent an attachment' : 'Sent a message');
  return {
    title: `New message from ${who}`,
    body,
    type: 'chat',
    projectId: input.projectId,
    entityId: input.messageId,
    senderId: input.senderId,
    senderName: input.senderName ?? undefined,
  };
}

export function complaintStatusNotification(input: {
  complaintTitle: string | null | undefined;
  status: string;
  resolutionNote?: string | null;
  complaintId: string;
  projectId: string;
  senderId: string;
  senderName?: string | null;
}): NotifyPayload {
  const label = complaintStatusLabel(input.status);
  const subject = input.complaintTitle?.trim() || 'Your complaint';
  const note = preview(input.resolutionNote, 100);
  return {
    title: `Complaint ${label.toLowerCase()}`,
    body: note ? `${preview(subject, 80)} · ${note}` : `${preview(subject, 120)} is now ${label.toLowerCase()}`,
    type: 'complaint',
    projectId: input.projectId,
    entityId: input.complaintId,
    senderId: input.senderId,
    senderName: input.senderName ?? undefined,
  };
}

// ------------------------------------------------------------ task assignment

export interface TaskRef {
  id: string;
  title: string | null;
  assignedWorkerId: string | null;
}

export interface AssignedTask {
  taskId: string;
  title: string;
}

const taskKey = (title: string | null, worker: string) => `${(title ?? '').trim().toLowerCase()}\u0000${worker}`;

/**
 * Worker -> tasks newly assigned to them by a save. A task counts when it now
 * has a worker and either is new or had a different (or no) worker before.
 * The actor is never notified about assigning themselves.
 *
 * A task whose id is unknown but whose title + worker match a previous task is
 * treated as the same task (guards against a client that re-creates ids on
 * every whole-timeline save, which would otherwise re-notify everyone).
 *
 * @param before previous tasks of the project (id, title, assigned worker)
 */
export function newTaskAssignments(
  before: TaskRef[],
  after: TaskRef[],
  actorId: string,
): Map<string, AssignedTask[]> {
  const byId = new Map(before.map((t) => [t.id, t.assignedWorkerId]));
  const unmatched = new Map<string, number>();
  const afterIds = new Set(after.map((t) => t.id));
  for (const t of before) {
    if (!t.assignedWorkerId || afterIds.has(t.id)) continue;
    const k = taskKey(t.title, t.assignedWorkerId);
    unmatched.set(k, (unmatched.get(k) ?? 0) + 1);
  }

  const out = new Map<string, AssignedTask[]>();
  for (const t of after) {
    const worker = t.assignedWorkerId;
    if (!worker) continue;
    if (byId.has(t.id)) {
      if (byId.get(t.id) === worker) continue;
    } else {
      const k = taskKey(t.title, worker);
      const left = unmatched.get(k) ?? 0;
      if (left > 0) {
        unmatched.set(k, left - 1);
        continue;
      }
    }
    if (worker === actorId) continue;
    const list = out.get(worker) ?? [];
    list.push({ taskId: t.id, title: t.title?.trim() || 'Untitled task' });
    out.set(worker, list);
  }
  return out;
}

/** One notification per worker, however many tasks a single save gave them. */
export function taskAssignmentNotification(
  tasks: AssignedTask[],
  projectId: string,
  senderId: string,
  senderName?: string | null,
): NotifyPayload {
  const base = {
    type: 'task' as const,
    projectId,
    senderId,
    senderName: senderName ?? undefined,
  };
  if (tasks.length === 1) {
    return {
      ...base,
      title: 'New task assigned to you',
      body: preview(tasks[0].title, 120),
      entityId: tasks[0].taskId,
    };
  }
  const shown = tasks.slice(0, 3).map((t) => preview(t.title, 40));
  const more = tasks.length - shown.length;
  return {
    ...base,
    title: `${tasks.length} tasks assigned to you`,
    body: more > 0 ? `${shown.join(', ')} and ${more} more` : shown.join(', '),
  };
}

// ------------------------------------------------------------ push data

/** FCM `data` must be string -> string; only the routing keys that are set. */
export function pushData(payload: NotifyPayload): Record<string, string> | undefined {
  const data: Record<string, string> = {};
  if (payload.type) data.type = payload.type;
  if (payload.projectId) data.projectId = payload.projectId;
  if (payload.leadId) data.leadId = payload.leadId;
  if (payload.entityId) data.entityId = payload.entityId;
  return Object.keys(data).length > 0 ? data : undefined;
}

/** The `notifications` insert row for one recipient. */
export function notificationRow(recipientId: string, payload: NotifyPayload) {
  return {
    recipient_id: recipientId,
    title: payload.title,
    body: payload.body,
    type: payload.type ?? null,
    project_id: payload.projectId ?? null,
    project_name: payload.projectName ?? null,
    lead_id: isUuid(payload.leadId) ? payload.leadId : null,
    entity_id: payload.entityId ?? null,
    sender_id: isUuid(payload.senderId) ? payload.senderId : null,
    sender_name: payload.senderName ?? null,
  };
}
