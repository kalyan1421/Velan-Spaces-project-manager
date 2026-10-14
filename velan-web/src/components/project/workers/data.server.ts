import "server-only";

import { cache } from "react";
import { isApiError } from "@/lib/api/errors";
import { projectOpsPaths, type StaffMember } from "@/lib/api/project-ops";
import { apiFetch } from "@/lib/api/server";

/**
 * `GET /staff` (head: managers + workers, manager: workers only), memoised per
 * request. A 403 (e.g. a role that can't list staff) yields an empty list so
 * pages degrade to ids instead of failing.
 */
export const loadStaff = cache(async (): Promise<StaffMember[]> => {
  try {
    const list = await apiFetch<StaffMember[] | null>(projectOpsPaths.staff());
    return Array.isArray(list) ? list : [];
  } catch (error) {
    if (isApiError(error) && error.status === 403) return [];
    throw error;
  }
});
