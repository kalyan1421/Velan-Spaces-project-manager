import "server-only";

import { cache } from "react";
import { isApiError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api/server";
import type { PortfolioItem, Project } from "@/lib/api/types";
import { getProjects } from "@/lib/data/projects";

/** What a website page can render with: data, a 403, or "let the client retry". */
export type Loaded<T> = { kind: "ok"; data: T } | { kind: "forbidden" } | { kind: "unavailable" };

async function settle<T>(load: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { kind: "ok", data: await load() };
  } catch (error) {
    if (!isApiError(error)) throw error; // redirects (session refresh / login) must propagate
    if (error.status === 403) return { kind: "forbidden" };
    return { kind: "unavailable" };
  }
}

/** `GET /portfolio` (head only, every status, display order), memoised per request. */
export const loadPortfolioAdmin = cache(() =>
  settle(async () => {
    const list = await apiFetch<PortfolioItem[] | null>("portfolio");
    return Array.isArray(list) ? list : [];
  }),
);

/** Projects for the "linked project" picker (the head sees all). */
export const loadProjectOptions = cache(() =>
  settle(async (): Promise<Pick<Project, "id" | "projectName" | "projectCode">[]> => {
    const projects = await getProjects();
    return projects
      .map((p) => ({ id: p.id, projectName: p.projectName, projectCode: p.projectCode }))
      .sort((a, b) => a.projectName.localeCompare(b.projectName));
  }),
);
