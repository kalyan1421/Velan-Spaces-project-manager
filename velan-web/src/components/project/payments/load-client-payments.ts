import "server-only";

import { isApiError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api/server";
import type { Loaded } from "../media/load-content";
import { normalizeClientPayments, type ClientPayments } from "./client-payments";

/** Budget vs payments received, for the client portal overview (best effort). */
export async function loadClientPayments(projectId: string): Promise<Loaded<ClientPayments>> {
  try {
    const raw = await apiFetch<unknown>(`/projects/${encodeURIComponent(projectId)}/client-payments`);
    return { kind: "ok", data: normalizeClientPayments(raw) };
  } catch (error) {
    if (!isApiError(error)) throw error;
    if (error.status === 403) return { kind: "forbidden" };
    return { kind: "ok", data: null };
  }
}
