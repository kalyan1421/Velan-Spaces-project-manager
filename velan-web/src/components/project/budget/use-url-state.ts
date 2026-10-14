"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { ParamsLike } from "./date-range";
import { mergeSearch } from "./sort";

/**
 * Table view state (filters, sort) read from and written to the query string,
 * so a view can be shared by copying the URL. Writes use `history.replaceState`
 * (Next keeps `useSearchParams` in sync) — no server round trip per change.
 */
export function useUrlState<T>(parse: (params: ParamsLike) => T) {
  const searchParams = useSearchParams();
  const value = useMemo(() => parse(searchParams), [parse, searchParams]);

  const update = useCallback((updates: Record<string, string | null>) => {
    const { pathname, search, hash } = window.location;
    window.history.replaceState(null, "", `${pathname}${mergeSearch(search, updates)}${hash}`);
  }, []);

  return [value, update] as const;
}
