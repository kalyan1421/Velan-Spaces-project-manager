import "server-only";

import { cache } from "react";
import { apiFetch } from "@/lib/api/server";
import type { Project } from "@/lib/api/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

/** `GET /projects` (role-sanitised by the API), memoised per request. */
export const getProjects = cache(async (): Promise<Project[]> => {
  const list = await apiFetch<Project[] | null>("projects");
  return Array.isArray(list) ? list : [];
});

/**
 * `GET /projects/:id`, memoised per request so a layout and its page share one call.
 * Returns null for ids that can't exist (the API would 400); callers `notFound()`.
 * Throws ApiError for 403/404 from the API.
 */
export const getProject = cache(async (id: string): Promise<Project | null> => {
  if (!isUuid(id)) return null;
  return apiFetch<Project>(`projects/${id}`);
});
