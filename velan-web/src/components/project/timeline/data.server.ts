import "server-only";

import { cache } from "react";
import { isApiError } from "@/lib/api/errors";
import { projectOpsPaths, type Room, type TimelinePhase } from "@/lib/api/project-ops";
import { apiFetch } from "@/lib/api/server";

export type Loaded<T> = { kind: "ok"; data: T } | { kind: "forbidden" };

/** `GET /projects/:id/timeline` (phases with nested tasks). 403 → forbidden; other errors propagate. */
export const loadTimeline = cache(async (projectId: string): Promise<Loaded<TimelinePhase[]>> => {
  try {
    const phases = await apiFetch<TimelinePhase[] | null>(projectOpsPaths.timeline(projectId));
    return { kind: "ok", data: Array.isArray(phases) ? phases : [] };
  } catch (error) {
    if (isApiError(error) && error.status === 403) return { kind: "forbidden" };
    throw error;
  }
});

/** `GET /projects/:id/rooms` (any member). 403 → forbidden. */
export const loadRooms = cache(async (projectId: string): Promise<Loaded<Room[]>> => {
  try {
    const rooms = await apiFetch<Room[] | null>(projectOpsPaths.rooms(projectId));
    return { kind: "ok", data: Array.isArray(rooms) ? rooms : [] };
  } catch (error) {
    if (isApiError(error) && error.status === 403) return { kind: "forbidden" };
    throw error;
  }
});
