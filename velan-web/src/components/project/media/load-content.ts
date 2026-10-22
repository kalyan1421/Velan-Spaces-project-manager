import "server-only";

import { isApiError } from "@/lib/api/errors";
import {
  UPDATES_PAGE_SIZE,
  contentPath,
  normalizeDesigns,
  normalizeFiles,
  normalizePeople,
  normalizeRooms,
  normalizeUpdates,
  type ContentPerson,
  type Design,
  type ProjectFile,
  type ProjectUpdate,
  type Room,
} from "@/lib/api/project-content";
import {
  normalizeProjectMembers,
  projectMembersPath,
  toContentPeople,
  type ProjectMember,
} from "@/lib/api/project-members";
import { apiFetch } from "@/lib/api/server";
import type { Role } from "@/lib/api/types";

/**
 * Server-side first loads for the project content tabs. The client components
 * take these as TanStack Query `initialData` and refresh from the BFF.
 *
 * - 403 → `forbidden` (render ForbiddenState; never rely on hiding alone).
 * - other API errors → `null` data: the client refetches and shows retry.
 * - redirects (expired session) propagate.
 */
export type Loaded<T> = { kind: "forbidden" } | { kind: "ok"; data: T | null };

async function load<T>(path: string, map: (raw: unknown) => T, query?: Record<string, string | number>): Promise<Loaded<T>> {
  try {
    return { kind: "ok", data: map(await apiFetch<unknown>(path, { query })) };
  } catch (error) {
    if (!isApiError(error)) throw error;
    if (error.status === 403) return { kind: "forbidden" };
    return { kind: "ok", data: null };
  }
}

/** Best-effort extras (names, rooms): any API error → fallback. */
async function optional<T>(path: string, map: (raw: unknown) => T, fallback: T, query?: Record<string, string>): Promise<T> {
  try {
    return map(await apiFetch<unknown>(path, { query }));
  } catch (error) {
    if (!isApiError(error)) throw error;
    return fallback;
  }
}

export const loadUpdatesPage = (projectId: string): Promise<Loaded<ProjectUpdate[]>> =>
  load(contentPath.updates(projectId), normalizeUpdates, { limit: UPDATES_PAGE_SIZE, offset: 0 });

export const loadDesigns = (projectId: string): Promise<Loaded<Design[]>> =>
  load(contentPath.designs(projectId), normalizeDesigns);

export const loadFiles = (projectId: string): Promise<Loaded<ProjectFile[]>> =>
  load(contentPath.files(projectId), normalizeFiles);

export const loadRooms = (projectId: string): Promise<Room[]> =>
  optional(contentPath.rooms(projectId), normalizeRooms, []);

/**
 * `GET /projects/:id/members` — names of the people on the project, for any
 * member (workers and clients included). Best effort: an API error → [].
 */
export const loadProjectMembers = (projectId: string): Promise<ProjectMember[]> =>
  optional(projectMembersPath(projectId), normalizeProjectMembers, []);

/**
 * Worker names for tagging/labels.
 * - head/manager: the staff directory (`GET /staff`), so workers who have since
 *   left the project still resolve on old updates.
 * - worker/client: the project's own members (`GET /projects/:id/members`) when
 *   `projectId` is given — they can't list staff. Without it they get an empty
 *   directory and the UI falls back to counts.
 */
export async function loadWorkerDirectory(role: Role, projectId?: string): Promise<ContentPerson[]> {
  if (role === "head" || role === "manager") {
    return optional(contentPath.workers(), normalizePeople, [], { role: "worker" });
  }
  if (!projectId) return [];
  return toContentPeople(await loadProjectMembers(projectId), "worker");
}
