/**
 * Types + browser calls for the project "operations" endpoints the web app uses
 * for timeline, workers, rooms, support (chat + complaints) and the project form.
 * Mirrors `feature/flutter-api-migration` (camelCase responses, `sb://` refs on write,
 * signed URLs in responses — never persist a URL you read from a response).
 *
 * Server Components call the same paths through `apiFetch` (see `projectOpsPaths`).
 */

import { api } from "./client";
import type { Money, Project, Role } from "./types";

// ------------------------------------------------------------------ timeline

export const PHASE_STATUSES = ["pending", "inProgress", "completed"] as const;
export const TASK_STATUSES = ["pending", "inProgress", "blocked", "done"] as const;
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;

export type PhaseStatus = (typeof PHASE_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export type ChecklistItem = { id: string; label: string; isDone: boolean };

export type TaskComment = {
  id: string;
  text: string;
  postedBy?: string;
  postedById?: string;
  createdAt?: string | null;
};

/** A task row as `GET /projects/:id/timeline` returns it (legacy rows may carry other status strings). */
export type TimelineTask = {
  id: string;
  phaseId: string;
  projectId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus | string;
  priority: TaskPriority | string;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  assignedWorkerId: string | null;
  roomId: string | null;
  checklistItems: ChecklistItem[] | null;
  comments: TaskComment[] | null;
  /** Signed download URLs (short-lived). */
  photoProofUrls: string[] | null;
  orderIndex?: number;
  createdAt: string;
  updatedAt?: string;
};

export type TimelinePhase = {
  id: string;
  projectId: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: PhaseStatus | string;
  orderIndex: number;
  notes: string | null;
  createdAt: string;
  updatedAt?: string;
  tasks: TimelineTask[];
};

export type TaskInput = {
  id?: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority?: TaskPriority;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  assignedWorkerId?: string | null;
  roomId?: string | null;
  checklistItems?: ChecklistItem[];
  comments?: TaskComment[];
  photoProofUrls?: string[];
  createdAt?: string | null;
};

export type PhaseInput = {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
  status?: PhaseStatus;
  notes?: string | null;
  createdAt?: string | null;
  tasks: TaskInput[];
};

/** `PUT /projects/:id/timeline` — replaces the whole timeline atomically (head/manager). */
export type ReplaceTimelineBody = { phases: PhaseInput[] };

/** `PATCH /projects/:id/timeline/tasks/:taskId` — progress (workers: own tasks only). */
export type TaskPatchBody = {
  status?: TaskStatus;
  checklistItems?: ChecklistItem[];
  toggleChecklistItemId?: string;
  addComment?: { text: string };
  addPhotoProofUrl?: string;
};

/** API limits (class-validator on the DTOs). */
export const TIMELINE_LIMITS = {
  phases: 200,
  tasksPerPhase: 500,
  checklistItems: 100,
  phaseName: 200,
  taskTitle: 300,
  description: 5000,
  checklistLabel: 300,
} as const;

// ------------------------------------------------------------------ rooms

export type Room = {
  id: string;
  projectId: string;
  name: string;
  assignedWorkerIds: string[] | null;
  createdAt: string;
};

export type RoomInput = { name: string; assignedWorkerIds?: string[] };
export type RoomPatch = Partial<RoomInput>;
export const ROOM_NAME_MAX = 120;

// ------------------------------------------------------------------ staff

/** `GET /staff` row. Managers calling it only receive workers. */
export type StaffMember = {
  id: string;
  email: string | null;
  username?: string | null;
  role: Extract<Role, "manager" | "worker">;
  displayName: string | null;
  phone: string | null;
  trade: string | null;
  isSuspended: boolean;
  assignedProjects?: string[];
};

/** Best label for a staff member (workers may have no email). */
export function staffName(member: Pick<StaffMember, "displayName" | "email" | "username"> | undefined | null): string {
  if (!member) return "Unknown";
  const name = member.displayName?.trim();
  if (name) return name;
  if (member.username) return member.username;
  if (member.email) return member.email.split("@")[0];
  return "Unnamed";
}

// ------------------------------------------------------------------ support

export const MESSAGE_TYPES = ["text", "image", "file"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];

export type ChatMessage = {
  id: string;
  projectId: string;
  senderId: string | null;
  senderName: string | null;
  /** Upper-case role ("HEAD", "CLIENT", …) as the app stores it. */
  senderRole: string | null;
  content: string | null;
  messageType: MessageType | string;
  attachmentUrls: string[] | null;
  createdAt: string;
};

export type ChatMessageInput = { content: string; messageType?: MessageType; attachmentUrls?: string[] };
export const CHAT_PAGE_SIZE = 50;
export const CHAT_MESSAGE_MAX = 5000;
export const ATTACHMENTS_MAX = 10;

export const COMPLAINT_STATUSES = ["open", "inProgress", "resolved", "closed"] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export type Complaint = {
  id: string;
  projectId: string;
  title: string | null;
  description: string | null;
  createdBy: string | null;
  createdByName: string | null;
  status: ComplaintStatus | string;
  attachments: string[] | null;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type ComplaintInput = { title: string; description?: string; attachments?: string[] };
export type ComplaintPatch = { status?: ComplaintStatus; resolutionNote?: string };
export const COMPLAINT_TITLE_MAX = 300;
export const COMPLAINT_DESCRIPTION_MAX = 5000;
export const RESOLUTION_NOTE_MAX = 2000;

// ------------------------------------------------------------------ projects

/** `POST /projects` / `PATCH /projects/:id`. A provided member list REPLACES that role's members. */
export type ProjectInput = {
  projectCode?: string;
  projectName?: string;
  clientName?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  location?: string | null;
  budget?: number;
  estimatedCost?: number;
  startDate?: string | null;
  targetEndDate?: string | null;
  managerIds?: string[];
  workerIds?: string[];
  clientIds?: string[];
  budgetAccessManagerIds?: string[];
};

export type { Money, Project };

// ------------------------------------------------------------------ paths

const seg = (id: string) => encodeURIComponent(id);

/** API paths (relative to the API base / the BFF). Shared by server loaders and browser calls. */
export const projectOpsPaths = {
  project: (projectId: string) => `projects/${seg(projectId)}`,
  projects: () => "projects",
  timeline: (projectId: string) => `projects/${seg(projectId)}/timeline`,
  timelineTask: (projectId: string, taskId: string) => `projects/${seg(projectId)}/timeline/tasks/${seg(taskId)}`,
  rooms: (projectId: string) => `projects/${seg(projectId)}/rooms`,
  room: (projectId: string, roomId: string) => `projects/${seg(projectId)}/rooms/${seg(roomId)}`,
  staff: () => "staff",
  chat: (projectId: string) => `projects/${seg(projectId)}/chat`,
  complaints: (projectId: string) => `projects/${seg(projectId)}/complaints`,
  complaint: (projectId: string, complaintId: string) => `projects/${seg(projectId)}/complaints/${seg(complaintId)}`,
} as const;

/** React Query keys, so every component invalidates the same entries. */
export const projectOpsKeys = {
  project: (projectId: string) => ["project", projectId] as const,
  timeline: (projectId: string) => ["project", projectId, "timeline"] as const,
  rooms: (projectId: string) => ["project", projectId, "rooms"] as const,
  staff: (role?: string) => ["staff", role ?? "all"] as const,
  chat: (projectId: string) => ["project", projectId, "chat"] as const,
  complaints: (projectId: string) => ["project", projectId, "complaints"] as const,
} as const;

const asArray = <T>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

// ------------------------------------------------------------------ browser calls (via the BFF)

export const projectOps = {
  getProject: (projectId: string) => api.get<Project>(projectOpsPaths.project(projectId)),
  createProject: (body: ProjectInput) => api.post<Project>(projectOpsPaths.projects(), body),
  updateProject: (projectId: string, body: ProjectInput) => api.patch<Project>(projectOpsPaths.project(projectId), body),
  deleteProject: (projectId: string) => api.delete<{ deleted: boolean }>(projectOpsPaths.project(projectId)),

  getTimeline: async (projectId: string) =>
    asArray(await api.get<TimelinePhase[] | null>(projectOpsPaths.timeline(projectId))),
  replaceTimeline: async (projectId: string, body: ReplaceTimelineBody) =>
    asArray(await api.put<TimelinePhase[] | null>(projectOpsPaths.timeline(projectId), body)),
  patchTask: (projectId: string, taskId: string, body: TaskPatchBody) =>
    api.patch<TimelineTask>(projectOpsPaths.timelineTask(projectId, taskId), body),

  listRooms: async (projectId: string) => asArray(await api.get<Room[] | null>(projectOpsPaths.rooms(projectId))),
  createRoom: (projectId: string, body: RoomInput) => api.post<Room>(projectOpsPaths.rooms(projectId), body),
  updateRoom: (projectId: string, roomId: string, body: RoomPatch) =>
    api.patch<Room>(projectOpsPaths.room(projectId, roomId), body),
  deleteRoom: (projectId: string, roomId: string) =>
    api.delete<{ deleted: boolean }>(projectOpsPaths.room(projectId, roomId)),

  listStaff: async (role?: "manager" | "worker") =>
    asArray(await api.get<StaffMember[] | null>(projectOpsPaths.staff(), { query: { role } })),

  listChat: async (projectId: string, page: { limit?: number; offset?: number } = {}, signal?: AbortSignal) =>
    asArray(
      await api.get<ChatMessage[] | null>(projectOpsPaths.chat(projectId), {
        query: { limit: page.limit ?? CHAT_PAGE_SIZE, offset: page.offset ?? 0 },
        signal,
      }),
    ),
  sendChat: (projectId: string, body: ChatMessageInput) => api.post<ChatMessage>(projectOpsPaths.chat(projectId), body),

  listComplaints: async (projectId: string) =>
    asArray(await api.get<Complaint[] | null>(projectOpsPaths.complaints(projectId))),
  createComplaint: (projectId: string, body: ComplaintInput) =>
    api.post<Complaint>(projectOpsPaths.complaints(projectId), body),
  updateComplaint: (projectId: string, complaintId: string, body: ComplaintPatch) =>
    api.patch<Complaint>(projectOpsPaths.complaint(projectId, complaintId), body),
};
