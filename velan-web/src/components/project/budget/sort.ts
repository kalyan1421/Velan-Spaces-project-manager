/** Single-column sort persisted in the URL as `?sort=<column>.<asc|desc>`. */

import type { ParamsLike } from "./date-range";

export type SortSpec = { id: string; desc: boolean };

export function parseSort(params: ParamsLike, allowed: readonly string[], fallback: SortSpec): SortSpec {
  const raw = params.get("sort");
  if (!raw) return fallback;
  const [id, dir] = raw.split(".", 2);
  if (!allowed.includes(id)) return fallback;
  return { id, desc: dir === "desc" };
}

/** `null` when the sort is the default (keeps URLs clean). */
export function sortParam(sort: SortSpec, fallback: SortSpec): string | null {
  if (sort.id === fallback.id && sort.desc === fallback.desc) return null;
  return `${sort.id}.${sort.desc ? "desc" : "asc"}`;
}

/** Applies `null`-means-delete updates to a query string; returns `?…` or "". */
export function mergeSearch(current: string, updates: Record<string, string | null>): string {
  const params = new URLSearchParams(current);
  for (const [k, v] of Object.entries(updates)) {
    if (v === null || v === "") params.delete(k);
    else params.set(k, v);
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
