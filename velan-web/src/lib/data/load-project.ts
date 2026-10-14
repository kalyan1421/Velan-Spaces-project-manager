import "server-only";

import { isApiError } from "@/lib/api/errors";
import type { Project } from "@/lib/api/types";
import { getProject } from "./projects";

export type LoadedProject =
  | { kind: "ok"; project: Project }
  | { kind: "missing" }
  | { kind: "forbidden" };

/**
 * `getProject` with 400/404 → missing and 403 → forbidden, so pages can render
 * `notFound()` or the 403 state. Other errors (and redirects) propagate.
 */
export async function loadProject(id: string): Promise<LoadedProject> {
  try {
    const project = await getProject(id);
    return project ? { kind: "ok", project } : { kind: "missing" };
  } catch (error) {
    if (!isApiError(error)) throw error;
    if (error.status === 403) return { kind: "forbidden" };
    if (error.status === 404 || error.status === 400) return { kind: "missing" };
    throw error;
  }
}
