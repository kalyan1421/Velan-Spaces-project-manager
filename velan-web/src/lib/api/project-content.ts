/**
 * Project content: updates (+ comments), designs, files and rooms.
 *
 * Mirrors the API on `feature/flutter-api-migration` (updates.controller.ts,
 * designs-files.module.ts, rooms-timeline.module.ts). Responses are camelCase
 * (global interceptor) and every stored `sb://` reference arrives as a
 * short-lived signed URL — never persist those; on writes send `sb://` refs.
 *
 * Rows come from Postgres and from the Firestore ETL, so every reader below is
 * defensive (`normalize*`): the UI can rely on arrays/booleans being present.
 */

import type { Role } from "./types";
import { ROLES } from "./types";
import { api } from "./client";

// ------------------------------------------------------------------ types

export type UpdateComment = {
  id: string;
  text: string;
  authorName: string;
  authorId: string | null;
  role: Role | null;
  /** ISO timestamp; legacy comments may have none. */
  createdAt: string | null;
};

/** `GET /projects/:projectId/updates` row (newest first). */
export type ProjectUpdate = {
  id: string;
  projectId: string;
  /** Poster's user id. */
  postedBy: string | null;
  postedByName: string | null;
  /** Poster's role at the time of posting. */
  role: Role | null;
  /** "message" | "photo" | "video" (free text in legacy rows). */
  type: string;
  content: string;
  category: string | null;
  roomId: string | null;
  associatedWorkerIds: string[];
  progressPercentage: number | null;
  /** Signed download URLs (≈50 min). */
  mediaUrls: string[];
  comments: UpdateComment[];
  /** Clients only ever receive `true` rows. */
  isClientViewable: boolean;
  createdAt: string;
};

export type CreateUpdateBody = {
  type?: "message" | "photo" | "video";
  content: string;
  category?: string;
  roomId?: string;
  associatedWorkerIds?: string[];
  progressPercentage?: number;
  /** `sb://update-images/projects/<projectId>/...` refs. */
  mediaUrls?: string[];
  isClientViewable?: boolean;
};

export type CreateCommentBody = { text: string };

/** The API answers `POST .../comments` with the stored comment (raw shape). */
export type RawComment = {
  id: string;
  text: string;
  postedBy: string;
  postedById: string;
  role: string;
  timestamp: string;
};

/** `GET /projects/:projectId/designs` row. */
export type Design = {
  id: string;
  projectId: string;
  title: string | null;
  /** Signed URL of the image / PDF. */
  fileUrl: string | null;
  /** "2D Plan" | "3D Render" | "Quotation" | legacy "2D"/"3D" … */
  type: string;
  postedBy: string | null;
  postedByName: string | null;
  roomName: string | null;
  approvalRequired: boolean;
  approvalApproved: boolean;
  createdAt: string;
};

export type CreateDesignBody = {
  title?: string;
  /** `sb://designs/projects/<projectId>/...` */
  fileUrl: string;
  type?: string;
  roomName?: string;
  approvalRequired?: boolean;
};

export type UpdateDesignBody = {
  title?: string;
  type?: string;
  roomName?: string;
  approvalRequired?: boolean;
};

/** `GET /projects/:projectId/files` row. */
export type ProjectFile = {
  id: string;
  projectId: string;
  name: string | null;
  title: string | null;
  /** Signed URL of the file (column name kept from the legacy model). */
  storagePath: string | null;
  category: string;
  type: string;
  /** Bytes; 0 when unknown. */
  size: number;
  uploadedBy: string | null;
  uploadedByName: string | null;
  version: number;
  approvalStatus: string;
  roomName: string | null;
  uploadedAt: string;
};

export type CreateFileBody = {
  name?: string;
  title?: string;
  /** `sb://project-files/projects/<projectId>/...` */
  storagePath: string;
  category?: string;
  type?: string;
  size?: number;
  roomName?: string;
};

export type Room = { id: string; name: string; assignedWorkerIds: string[] };

/** Minimal person for tagging/labels (from `GET /staff`, head/manager only). */
export type ContentPerson = { id: string; name: string };

// ------------------------------------------------------------------ readers

type Raw = Record<string, unknown>;

const asObject = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === "boolean" ? v : fallback);
const int = (v: unknown, fallback: number): number => {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

/** "MANAGER" (role snapshot on rows) → "manager". */
export function roleFromApi(value: unknown): Role | null {
  if (typeof value !== "string") return null;
  const lower = value.toLowerCase();
  return (ROLES as readonly string[]).includes(lower) ? (lower as Role) : null;
}

function timestampOf(v: unknown): string | null {
  if (typeof v === "string" && v.trim() !== "") return v;
  if (typeof v === "number" && Number.isFinite(v)) return new Date(v).toISOString();
  // Firestore export shape `{ seconds, nanoseconds }` / `{ _seconds }`.
  const o = asObject(v);
  const seconds = typeof o.seconds === "number" ? o.seconds : typeof o._seconds === "number" ? o._seconds : null;
  return seconds === null ? null : new Date(seconds * 1000).toISOString();
}

export function normalizeComment(raw: unknown, index: number): UpdateComment {
  const o = asObject(raw);
  return {
    id: str(o.id) ?? `legacy-${index}`,
    text: typeof o.text === "string" ? o.text : "",
    authorName: str(o.postedBy) ?? str(o.authorName) ?? "Team member",
    authorId: str(o.postedById),
    role: roleFromApi(o.role),
    createdAt: timestampOf(o.timestamp ?? o.createdAt),
  };
}

export function normalizeUpdate(raw: unknown): ProjectUpdate {
  const o = asObject(raw);
  const progress = int(o.progressPercentage, NaN);
  return {
    id: String(o.id ?? ""),
    projectId: String(o.projectId ?? ""),
    postedBy: str(o.postedBy),
    postedByName: str(o.postedByName),
    role: roleFromApi(o.role),
    type: str(o.type) ?? "message",
    content: typeof o.content === "string" ? o.content : "",
    category: str(o.category),
    roomId: str(o.roomId),
    associatedWorkerIds: strings(o.associatedWorkerIds),
    progressPercentage: Number.isFinite(progress) ? progress : null,
    mediaUrls: strings(o.mediaUrls),
    comments: Array.isArray(o.comments) ? o.comments.map(normalizeComment) : [],
    isClientViewable: bool(o.isClientViewable, true),
    createdAt: timestampOf(o.createdAt) ?? "",
  };
}

export function normalizeDesign(raw: unknown): Design {
  const o = asObject(raw);
  return {
    id: String(o.id ?? ""),
    projectId: String(o.projectId ?? ""),
    title: str(o.title),
    fileUrl: str(o.fileUrl),
    type: str(o.type) ?? "2D",
    postedBy: str(o.postedBy),
    postedByName: str(o.postedByName),
    roomName: str(o.roomName),
    approvalRequired: bool(o.approvalRequired, false),
    approvalApproved: bool(o.approvalApproved, false),
    createdAt: timestampOf(o.createdAt) ?? "",
  };
}

export function normalizeFile(raw: unknown): ProjectFile {
  const o = asObject(raw);
  return {
    id: String(o.id ?? ""),
    projectId: String(o.projectId ?? ""),
    name: str(o.name),
    title: str(o.title),
    storagePath: str(o.storagePath),
    category: str(o.category) ?? "other",
    type: str(o.type) ?? "unknown",
    size: Math.max(0, int(o.size, 0)),
    uploadedBy: str(o.uploadedBy),
    uploadedByName: str(o.uploadedByName),
    version: Math.max(1, int(o.version, 1)),
    approvalStatus: str(o.approvalStatus) ?? "pending",
    roomName: str(o.roomName),
    uploadedAt: timestampOf(o.uploadedAt) ?? "",
  };
}

export function normalizeRoom(raw: unknown): Room {
  const o = asObject(raw);
  return { id: String(o.id ?? ""), name: str(o.name) ?? "Room", assignedWorkerIds: strings(o.assignedWorkerIds) };
}

const list = <T>(raw: unknown, fn: (r: unknown) => T): T[] => (Array.isArray(raw) ? raw.map(fn) : []);

export const normalizeUpdates = (raw: unknown) => list(raw, normalizeUpdate);
export const normalizeDesigns = (raw: unknown) => list(raw, normalizeDesign);
export const normalizeFiles = (raw: unknown) => list(raw, normalizeFile);
export const normalizeRooms = (raw: unknown) => list(raw, normalizeRoom);

/** `GET /staff` rows → people with a display name. */
export function normalizePeople(raw: unknown): ContentPerson[] {
  return list(raw, (r) => {
    const o = asObject(r);
    const email = str(o.email);
    return {
      id: String(o.id ?? ""),
      name: str(o.displayName) ?? str(o.username) ?? (email ? email.split("@")[0] : "Team member"),
    };
  }).filter((p) => p.id !== "");
}

// ------------------------------------------------------------------ pagination

/** Page size for the updates feed (API default 50, max 100). */
export const UPDATES_PAGE_SIZE = 20;

export function nextUpdatesOffset(lastPage: ProjectUpdate[], pages: ProjectUpdate[][]): number | undefined {
  if (lastPage.length < UPDATES_PAGE_SIZE) return undefined;
  return pages.reduce((n, p) => n + p.length, 0);
}

/** Offset pages shift when someone posts meanwhile; keep the first copy of each id. */
export function flattenUpdatePages(pages: ProjectUpdate[][]): ProjectUpdate[] {
  const seen = new Set<string>();
  const out: ProjectUpdate[] = [];
  for (const page of pages) {
    for (const u of page) {
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      out.push(u);
    }
  }
  return out;
}

// ------------------------------------------------------------------ permissions

export type ContentCapabilities = {
  postUpdate: boolean;
  deleteUpdate: boolean;
  commentOnUpdate: boolean;
  /** Staff may post staff-only updates (`isClientViewable: false`). */
  setUpdateVisibility: boolean;
  uploadDesign: boolean;
  editDesign: boolean;
  deleteDesign: boolean;
  uploadFile: boolean;
  deleteFile: boolean;
};

/**
 * What the UI offers per role. Mirrors the API's `@Roles` guards and storage
 * policy (designs bucket: head/manager; update-images: field staff). The API
 * still enforces all of it — this only hides controls that would 403.
 * Clients are read-only, as in the mobile app ("Comments are read-only for clients").
 */
export function contentCapabilities(role: Role): ContentCapabilities {
  const staff = role === "head" || role === "manager";
  const field = staff || role === "worker";
  return {
    postUpdate: field,
    deleteUpdate: staff,
    commentOnUpdate: field,
    setUpdateVisibility: field,
    uploadDesign: staff,
    editDesign: staff,
    deleteDesign: staff,
    uploadFile: staff,
    deleteFile: staff,
  };
}

// ------------------------------------------------------------------ paths & keys

const base = (projectId: string) => `projects/${encodeURIComponent(projectId)}`;
const seg = (id: string) => encodeURIComponent(id);

export const contentPath = {
  updates: (projectId: string) => `${base(projectId)}/updates`,
  update: (projectId: string, id: string) => `${base(projectId)}/updates/${seg(id)}`,
  comments: (projectId: string, id: string) => `${base(projectId)}/updates/${seg(id)}/comments`,
  designs: (projectId: string) => `${base(projectId)}/designs`,
  design: (projectId: string, id: string) => `${base(projectId)}/designs/${seg(id)}`,
  files: (projectId: string) => `${base(projectId)}/files`,
  file: (projectId: string, id: string) => `${base(projectId)}/files/${seg(id)}`,
  rooms: (projectId: string) => `${base(projectId)}/rooms`,
  workers: () => "staff",
};

export const contentKeys = {
  updates: (projectId: string) => ["project-content", projectId, "updates"] as const,
  designs: (projectId: string) => ["project-content", projectId, "designs"] as const,
  files: (projectId: string) => ["project-content", projectId, "files"] as const,
  rooms: (projectId: string) => ["project-content", projectId, "rooms"] as const,
};

/**
 * Signed media URLs live ≈50 minutes; refetch well before that so a page left
 * open keeps working images and downloads.
 */
export const SIGNED_URL_REFRESH_MS = 30 * 60_000;

// ------------------------------------------------------------------ browser fetchers (BFF)

type Signal = { signal?: AbortSignal };

export const contentApi = {
  updatesPage: async (projectId: string, offset: number, { signal }: Signal = {}) =>
    normalizeUpdates(
      await api.get<unknown>(contentPath.updates(projectId), {
        query: { limit: UPDATES_PAGE_SIZE, offset },
        signal,
      }),
    ),
  createUpdate: async (projectId: string, body: CreateUpdateBody) =>
    normalizeUpdate(await api.post<unknown>(contentPath.updates(projectId), body)),
  deleteUpdate: (projectId: string, id: string) => api.delete<unknown>(contentPath.update(projectId, id)),
  addComment: async (projectId: string, updateId: string, body: CreateCommentBody) =>
    normalizeComment(await api.post<unknown>(contentPath.comments(projectId, updateId), body), 0),

  designs: async (projectId: string, { signal }: Signal = {}) =>
    normalizeDesigns(await api.get<unknown>(contentPath.designs(projectId), { signal })),
  createDesign: async (projectId: string, body: CreateDesignBody) =>
    normalizeDesign(await api.post<unknown>(contentPath.designs(projectId), body)),
  updateDesign: async (projectId: string, id: string, body: UpdateDesignBody) =>
    normalizeDesign(await api.patch<unknown>(contentPath.design(projectId, id), body)),
  deleteDesign: (projectId: string, id: string) => api.delete<unknown>(contentPath.design(projectId, id)),

  files: async (projectId: string, { signal }: Signal = {}) =>
    normalizeFiles(await api.get<unknown>(contentPath.files(projectId), { signal })),
  createFile: async (projectId: string, body: CreateFileBody) =>
    normalizeFile(await api.post<unknown>(contentPath.files(projectId), body)),
  deleteFile: (projectId: string, id: string) => api.delete<unknown>(contentPath.file(projectId, id)),

  rooms: async (projectId: string, { signal }: Signal = {}) =>
    normalizeRooms(await api.get<unknown>(contentPath.rooms(projectId), { signal })),
};
