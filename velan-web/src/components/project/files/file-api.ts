/**
 * Project files with client visibility (spec R-E1 / R-E3).
 *
 * Files are staff-only unless a head/manager shares them: the API returns
 * `clientVisible` on every row and only shared rows to a client.
 * `normalizeFile` in `@/lib/api/project-content` predates the flag, so this
 * module extends it. `clientVisible` is null when the row came from a loader
 * that dropped it (the UI then waits for the refetch).
 *
 *  - `GET   /projects/:projectId/files`       → rows (+ `clientVisible`)
 *  - `POST  /projects/:projectId/files`       → body may include `clientVisible`
 *  - `PATCH /projects/:projectId/files/:id`   → `{ clientVisible }` (head/manager)
 */

import { api } from "@/lib/api/client";
import {
  contentPath,
  normalizeFile,
  type CreateFileBody,
  type ProjectFile,
} from "@/lib/api/project-content";

export type SharedFile = ProjectFile & {
  /** Shared with the project's client; null = not known yet. */
  clientVisible: boolean | null;
};

export type CreateSharedFileBody = CreateFileBody & { clientVisible?: boolean };

export function normalizeSharedFile(raw: unknown): SharedFile {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return { ...normalizeFile(raw), clientVisible: typeof o.clientVisible === "boolean" ? o.clientVisible : null };
}

export const normalizeSharedFiles = (raw: unknown): SharedFile[] =>
  Array.isArray(raw) ? raw.map(normalizeSharedFile) : [];

/** Rows from the older loader (no flag) → `clientVisible: null`. */
export function ensureSharedFiles(list: readonly (ProjectFile | SharedFile)[]): SharedFile[] {
  return list.map((f) => ("clientVisible" in f ? f : { ...f, clientVisible: null }));
}

type Signal = { signal?: AbortSignal };

/** Browser fetchers (BFF). Share the `contentKeys.files` cache key. */
export const fileApi = {
  list: async (projectId: string, { signal }: Signal = {}) =>
    normalizeSharedFiles(await api.get<unknown>(contentPath.files(projectId), { signal })),
  create: async (projectId: string, body: CreateSharedFileBody) =>
    normalizeSharedFile(await api.post<unknown>(contentPath.files(projectId), body)),
  setClientVisible: async (projectId: string, id: string, clientVisible: boolean) =>
    normalizeSharedFile(await api.patch<unknown>(contentPath.file(projectId, id), { clientVisible })),
};
