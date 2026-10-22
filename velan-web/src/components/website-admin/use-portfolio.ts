"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { isApiError } from "@/lib/api/errors";
import {
  PORTFOLIO_ADMIN_QUERY_KEY,
  portfolioAdminApi,
  revalidatePublicPortfolio,
} from "@/lib/api/portfolio-admin";
import type { PortfolioItem, PortfolioStatus } from "@/lib/api/types";
import { applyOrder, coverOf, STATUS_LABELS } from "./portfolio-rules";

export type ProjectOption = { id: string; projectName: string; projectCode: string };

const KEY = PORTFOLIO_ADMIN_QUERY_KEY;

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

// ---------------------------------------------------------------- public site sync

let revalidateTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Tells the public site to drop its cached portfolio. Debounced so a burst of
 * reorder clicks costs one call; a failure only means the site catches up
 * within ~5 minutes, so it's a warning, not an error.
 */
export function syncPublicSite() {
  if (revalidateTimer) clearTimeout(revalidateTimer);
  revalidateTimer = setTimeout(async () => {
    revalidateTimer = null;
    const ok = await revalidatePublicPortfolio();
    if (!ok) {
      toast.warning("Saved. The public website may take up to 5 minutes to show this change.", {
        id: "portfolio-revalidate",
      });
    }
  }, 400);
}

// ---------------------------------------------------------------- cache helpers

export function upsertItem(client: QueryClient, item: PortfolioItem) {
  client.setQueryData<PortfolioItem[]>(KEY, (old) => {
    if (!old) return old;
    const found = old.some((i) => i.id === item.id);
    return found ? old.map((i) => (i.id === item.id ? item : i)) : [item, ...old];
  });
}

// ---------------------------------------------------------------- queries

export function usePortfolioList(initialItems?: PortfolioItem[]) {
  return useQuery({
    queryKey: KEY,
    queryFn: ({ signal }) => portfolioAdminApi.list(signal),
    initialData: initialItems,
  });
}

// ---------------------------------------------------------------- mutations

export function useSetStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ item, status }: { item: PortfolioItem; status: PortfolioStatus }) =>
      portfolioAdminApi.update(item.id, { status }),
    onSuccess: (updated, { item, status }) => {
      upsertItem(client, updated);
      syncPublicSite();
      if (status === "published" && !coverOf(updated)) {
        toast.warning(`“${item.title}” is published without photos. The website shows a placeholder until you add some.`);
      } else {
        const verb = status === "published" ? "is now on the website" : status === "hidden" ? "is hidden from the website" : "moved to drafts";
        toast.success(`“${item.title}” ${verb}.`);
      }
    },
    onError: (error, { item, status }) => {
      toast.error(`Couldn't change “${item.title}” to ${STATUS_LABELS[status].toLowerCase()}: ${errorMessage(error)}`);
    },
  });
}

export function useDeleteItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (item: PortfolioItem) => portfolioAdminApi.remove(item.id),
    onSuccess: (_res, item) => {
      client.setQueryData<PortfolioItem[]>(KEY, (old) => old?.filter((i) => i.id !== item.id));
      syncPublicSite();
      toast.success(`Deleted “${item.title}”.`);
    },
    onError: (error, item) => {
      if (isApiError(error) && error.status === 404) {
        client.setQueryData<PortfolioItem[]>(KEY, (old) => old?.filter((i) => i.id !== item.id));
        toast.info(`“${item.title}” was already deleted.`);
        return;
      }
      toast.error(`Couldn't delete “${item.title}”: ${errorMessage(error)}`);
    },
  });
}

/**
 * Optimistic reorder: `save(ids)` updates the list at once and sends
 * `PUT /portfolio/order`. Calls run one at a time (mutation scope) and only the
 * latest server answer is applied, so fast up/down clicks never flicker back.
 */
export function useReorder() {
  const client = useQueryClient();
  const latest = useRef(0);
  const { mutate, isPending } = useMutation({
    scope: { id: "portfolio-order" },
    mutationFn: ({ ids }: { ids: string[]; seq: number }) => portfolioAdminApi.reorder(ids),
    onMutate: async ({ ids }) => {
      await client.cancelQueries({ queryKey: KEY });
      client.setQueryData<PortfolioItem[]>(KEY, (old) => (old ? applyOrder(old, ids) : old));
    },
    onSuccess: (list, { seq }) => {
      if (seq === latest.current && Array.isArray(list)) client.setQueryData(KEY, list);
      syncPublicSite();
    },
    onError: (error) => {
      toast.error(`Couldn't save the new order: ${errorMessage(error)}`);
      void client.invalidateQueries({ queryKey: KEY });
    },
  });

  const save = useCallback(
    (ids: string[]) => {
      latest.current += 1;
      mutate({ ids, seq: latest.current });
    },
    [mutate],
  );

  return { save, isPending };
}
