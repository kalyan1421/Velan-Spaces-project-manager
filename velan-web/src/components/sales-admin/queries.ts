"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { isApiError } from "@/lib/api/errors";
import { salesKeys } from "@/lib/api/sales";
import { salesAdminApi, salesAdminKeys } from "@/lib/api/sales-admin";
import type {
  CatalogItem,
  CatalogItemInput,
  QuotationSettings,
  QuotationSettingsInput,
  QuoteTemplate,
  QuoteTemplateInput,
} from "@/lib/api/sales-types";

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (isApiError(error)) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function upsert<T extends { id: string }>(client: QueryClient, key: readonly unknown[], row: T) {
  client.setQueryData<T[]>(key, (old) => {
    if (!old) return old;
    return old.some((r) => r.id === row.id) ? old.map((r) => (r.id === row.id ? row : r)) : [...old, row];
  });
}

function removeRow<T extends { id: string }>(client: QueryClient, key: readonly unknown[], id: string) {
  client.setQueryData<T[]>(key, (old) => old?.filter((r) => r.id !== id));
}

// ---------------------------------------------------------------- catalog

export function useCatalogAdmin(initialData?: CatalogItem[]) {
  return useQuery({
    queryKey: salesAdminKeys.catalog(),
    queryFn: ({ signal }) => salesAdminApi.listCatalog(signal),
    initialData,
  });
}

/** The quote builder's (active-only) catalog list goes stale with any rate card write. */
function touchBuilderCatalog(client: QueryClient) {
  void client.invalidateQueries({ queryKey: salesKeys.catalog(), exact: true });
}

export function useSaveCatalogItem() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: CatalogItemInput }) =>
      id ? salesAdminApi.updateCatalogItem(id, body) : salesAdminApi.createCatalogItem(body),
    onSuccess: (item) => {
      if (item.id) upsert(client, salesAdminKeys.catalog(), item);
      else void client.invalidateQueries({ queryKey: salesAdminKeys.catalog() });
      touchBuilderCatalog(client);
    },
  });
}

export function useSetCatalogItemActive() {
  const client = useQueryClient();
  return useMutation({
    // DELETE is the API's soft delete (active=false); PATCH active=true restores.
    mutationFn: ({ item, active }: { item: CatalogItem; active: boolean }) =>
      active ? salesAdminApi.updateCatalogItem(item.id, { active: true }) : salesAdminApi.deactivateCatalogItem(item.id),
    onSuccess: (updated, { item, active }) => {
      upsert(client, salesAdminKeys.catalog(), updated.id ? updated : { ...item, active });
      touchBuilderCatalog(client);
      toast.success(active ? `“${item.name}” is active again.` : `“${item.name}” is deactivated.`);
    },
    onError: (error, { item }) => toast.error(`Couldn't update “${item.name}”: ${errorMessage(error)}`),
  });
}

// ---------------------------------------------------------------- templates

export function useTemplates(initialData?: QuoteTemplate[], enabled = true) {
  return useQuery({
    queryKey: salesAdminKeys.templates(),
    queryFn: ({ signal }) => salesAdminApi.listTemplates(signal),
    initialData,
    enabled,
  });
}

export function useSaveTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string | null; body: QuoteTemplateInput }) =>
      id ? salesAdminApi.updateTemplate(id, body) : salesAdminApi.createTemplate(body),
    onSuccess: (template) => {
      if (template.id) upsert(client, salesAdminKeys.templates(), template);
      else void client.invalidateQueries({ queryKey: salesAdminKeys.templates() });
    },
  });
}

export function useDeleteTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (template: QuoteTemplate) => salesAdminApi.deleteTemplate(template.id),
    onSuccess: (_res, template) => {
      removeRow(client, salesAdminKeys.templates(), template.id);
      toast.success(`Deleted “${template.name}”.`);
    },
    onError: (error, template) => {
      if (isApiError(error) && error.status === 404) {
        removeRow(client, salesAdminKeys.templates(), template.id);
        toast.info(`“${template.name}” was already deleted.`);
        return;
      }
      toast.error(`Couldn't delete “${template.name}”: ${errorMessage(error)}`);
    },
  });
}

export function useDuplicateTemplate() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ template, name }: { template: QuoteTemplate; name: string }) =>
      salesAdminApi.createTemplate({ name, sections: template.sections }),
    onSuccess: (created) => {
      if (created.id) upsert(client, salesAdminKeys.templates(), created);
      else void client.invalidateQueries({ queryKey: salesAdminKeys.templates() });
      toast.success(`Created “${created.name}”.`);
    },
    onError: (error, { template }) => toast.error(`Couldn't duplicate “${template.name}”: ${errorMessage(error)}`),
  });
}

// ---------------------------------------------------------------- settings

export function useQuotationSettings(initialData?: QuotationSettings) {
  return useQuery({
    queryKey: salesAdminKeys.settings(),
    queryFn: ({ signal }) => salesAdminApi.getSettings(signal),
    initialData,
  });
}

export function useSaveSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: QuotationSettingsInput) => salesAdminApi.putSettings(body),
    onSuccess: (settings) => client.setQueryData(salesAdminKeys.settings(), settings),
  });
}
