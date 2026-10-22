"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { isApiError } from "@/lib/api/errors";
import { salesApi, salesKeys } from "@/lib/api/sales";
import type { Lead, LeadInput, LeadPatch, Quote, QuoteInput } from "@/lib/api/sales-types";

export function isForbidden(error: unknown): boolean {
  return isApiError(error) && error.status === 403;
}

/** Server-rendered data counts as fresh as of first client render. */
function useHydratedAt() {
  const [at] = useState(() => Date.now());
  return at;
}

// ------------------------------------------------------------------ queries

export function useLeads(initial: Lead[]) {
  const at = useHydratedAt();
  return useQuery({
    queryKey: salesKeys.leads(),
    queryFn: ({ signal }) => salesApi.listLeads({ signal }),
    initialData: initial,
    initialDataUpdatedAt: at,
  });
}

export function useLead(id: string, initial: Lead) {
  const at = useHydratedAt();
  return useQuery({
    queryKey: salesKeys.lead(id),
    queryFn: ({ signal }) => salesApi.getLead(id, { signal }),
    initialData: initial,
    initialDataUpdatedAt: at,
  });
}

export function useLeadQuotes(leadId: string, initial: Quote[]) {
  const at = useHydratedAt();
  return useQuery({
    queryKey: salesKeys.leadQuotes(leadId),
    queryFn: ({ signal }) => salesApi.listQuotes(leadId, { signal }),
    initialData: initial,
    initialDataUpdatedAt: at,
  });
}

/** Rate card, templates and settings for dialogs that open on demand. */
export function useCatalog(enabled = true) {
  return useQuery({
    queryKey: salesKeys.catalog(),
    queryFn: ({ signal }) => salesApi.listCatalog({ signal }),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useTemplates(enabled = true) {
  return useQuery({
    queryKey: salesKeys.templates(),
    queryFn: ({ signal }) => salesApi.listTemplates({ signal }),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useQuotationSettings(enabled = true) {
  return useQuery({
    queryKey: salesKeys.settings(),
    queryFn: ({ signal }) => salesApi.getSettings({ signal }),
    enabled,
    staleTime: 5 * 60_000,
  });
}

// ------------------------------------------------------------------ lead mutations

export function useCreateLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LeadInput) => salesApi.createLead(body),
    onSuccess: (created) => {
      if (created.id) qc.setQueryData<Lead[]>(salesKeys.leads(), (old) => [created, ...(old ?? []).filter((l) => l.id !== created.id)]);
      void qc.invalidateQueries({ queryKey: salesKeys.leads(), exact: true });
    },
  });
}

/** Optimistic: the pipeline and the detail page show the change immediately. */
export function useUpdateLead(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: LeadPatch) => salesApi.updateLead(id, patch),
    onMutate: async (patch) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: salesKeys.lead(id), exact: true }),
        qc.cancelQueries({ queryKey: salesKeys.leads(), exact: true }),
      ]);
      const prevLead = qc.getQueryData<Lead>(salesKeys.lead(id));
      const prevList = qc.getQueryData<Lead[]>(salesKeys.leads());
      const apply = (l: Lead): Lead => ({ ...l, ...(patch as Partial<Lead>) });
      if (prevLead) qc.setQueryData<Lead>(salesKeys.lead(id), apply(prevLead));
      if (prevList) qc.setQueryData<Lead[]>(salesKeys.leads(), prevList.map((l) => (l.id === id ? apply(l) : l)));
      return { prevLead, prevList };
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.prevLead) qc.setQueryData(salesKeys.lead(id), ctx.prevLead);
      if (ctx?.prevList) qc.setQueryData(salesKeys.leads(), ctx.prevList);
    },
    onSuccess: (updated) => {
      // Some endpoints answer with a partial row; merge rather than replace.
      if (updated?.id) {
        qc.setQueryData<Lead>(salesKeys.lead(id), (old) => (old ? { ...old, ...stripEmpty(updated) } : updated));
      }
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: salesKeys.lead(id), exact: true });
      void qc.invalidateQueries({ queryKey: salesKeys.leads(), exact: true });
    },
  });
}

/** Drops keys the normalizer filled with blanks because the response omitted them. */
function stripEmpty(lead: Lead): Partial<Lead> {
  return Object.fromEntries(Object.entries(lead).filter(([, v]) => v !== "" && v !== undefined)) as Partial<Lead>;
}

export function useDeleteLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => salesApi.deleteLead(id),
    onSuccess: (_r, id) => {
      qc.setQueryData<Lead[]>(salesKeys.leads(), (old) => (old ?? []).filter((l) => l.id !== id));
      qc.removeQueries({ queryKey: salesKeys.lead(id) });
      void qc.invalidateQueries({ queryKey: salesKeys.all });
    },
  });
}

// ------------------------------------------------------------------ quote mutations

function useQuoteListsRefresh() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: salesKeys.quotes() });
}

export function useCreateQuote() {
  const refresh = useQuoteListsRefresh();
  return useMutation({
    mutationFn: (body: QuoteInput) => salesApi.createQuote(body),
    onSuccess: () => void refresh(),
  });
}

export function useDuplicateQuote() {
  const refresh = useQuoteListsRefresh();
  return useMutation({
    mutationFn: (id: string) => salesApi.duplicateQuote(id),
    onSuccess: () => void refresh(),
  });
}

export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => salesApi.deleteQuote(id),
    onSuccess: (_r, id) => {
      for (const [key, data] of qc.getQueriesData<Quote[]>({ queryKey: salesKeys.quotes() })) {
        if (Array.isArray(data)) qc.setQueryData(key, data.filter((q) => q.id !== id));
      }
      qc.removeQueries({ queryKey: salesKeys.quote(id) });
      void qc.invalidateQueries({ queryKey: salesKeys.quotes() });
    },
  });
}

export function useSaveQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: QuoteInput) => salesApi.updateQuote(id, body),
    onSuccess: (saved) => {
      if (saved?.id) qc.setQueryData(salesKeys.quote(id), saved);
      void qc.invalidateQueries({ queryKey: salesKeys.quotes() });
    },
  });
}
