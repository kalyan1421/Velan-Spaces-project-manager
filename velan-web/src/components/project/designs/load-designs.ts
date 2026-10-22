import "server-only";

import { isApiError } from "@/lib/api/errors";
import { contentPath } from "@/lib/api/project-content";
import { apiFetch } from "@/lib/api/server";
import type { Loaded } from "../media/load-content";
import { normalizeApprovalDesigns, type ApprovalDesign } from "./design-api";

/**
 * Server first load for the Designs tab (staff and portal), keeping the
 * approval record that `loadDesigns` in media/load-content drops.
 * 403 → forbidden; other API errors → null data (the client refetches).
 */
export async function loadApprovalDesigns(projectId: string): Promise<Loaded<ApprovalDesign[]>> {
  try {
    return { kind: "ok", data: normalizeApprovalDesigns(await apiFetch<unknown>(contentPath.designs(projectId))) };
  } catch (error) {
    if (!isApiError(error)) throw error;
    if (error.status === 403) return { kind: "forbidden" };
    return { kind: "ok", data: null };
  }
}
