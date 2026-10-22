import "server-only";

import { isApiError } from "@/lib/api/errors";
import { contentPath } from "@/lib/api/project-content";
import { apiFetch } from "@/lib/api/server";
import type { Loaded } from "../media/load-content";
import { normalizeSharedFiles, type SharedFile } from "./file-api";

/**
 * Server first load for project files, keeping `clientVisible` (which
 * `loadFiles` in media/load-content drops). For a client the API only
 * returns files shared with them.
 */
export async function loadSharedFiles(projectId: string): Promise<Loaded<SharedFile[]>> {
  try {
    return { kind: "ok", data: normalizeSharedFiles(await apiFetch<unknown>(contentPath.files(projectId))) };
  } catch (error) {
    if (!isApiError(error)) throw error;
    if (error.status === 403) return { kind: "forbidden" };
    return { kind: "ok", data: null };
  }
}
