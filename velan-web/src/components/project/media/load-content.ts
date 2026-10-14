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
 * Worker names for tagging/labels. Only head and managers may list staff
 * (`GET /staff`); everyone else gets an empty directory and sees counts.
 */
export async function loadWorkerDirectory(role: Role): Promise<ContentPerson[]> {
  if (role !== "head" && role !== "manager") return [];
  return optional(contentPath.workers(), normalizePeople, [], { role: "worker" });
}
