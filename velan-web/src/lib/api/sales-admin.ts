/**
 * Sales admin (head): rate card, quote templates and quotation settings —
 * browser calls through the BFF, paths and query keys. Types and the row
 * normalisers are shared with the quote builder (`./sales-types`); the query
 * keys extend `salesKeys` so a save here refreshes the builder's caches too.
 *
 * Endpoints (API `modules/sales`):
 *   GET    /catalog-items[?includeInactive=true]   POST /catalog-items
 *   PATCH  /catalog-items/:id                      DELETE /catalog-items/:id (soft: sets active=false)
 *   GET    /quote-templates                        POST /quote-templates
 *   PATCH  /quote-templates/:id                    DELETE /quote-templates/:id
 *   GET    /quotation-settings                     PUT /quotation-settings (head only)
 *
 * Server Components call the same paths through `apiFetch` (see `salesAdminPaths`).
 */

import { api } from "./client";
import { salesKeys } from "./sales";
import {
  normalizeCatalogItem,
  normalizeList,
  normalizeSettings,
  normalizeTemplate,
  type CatalogItem,
  type CatalogItemInput,
  type QuotationSettings,
  type QuotationSettingsInput,
  type QuoteTemplate,
  type QuoteTemplateInput,
} from "./sales-types";

const seg = (id: string) => encodeURIComponent(id);

export const salesAdminPaths = {
  catalog: "catalog-items",
  catalogItem: (id: string) => `catalog-items/${seg(id)}`,
  templates: "quote-templates",
  template: (id: string) => `quote-templates/${seg(id)}`,
  settings: "quotation-settings",
} as const;

/** The head's rate card includes deactivated items; quote builders only see active ones. */
export const CATALOG_ADMIN_QUERY = { includeInactive: true } as const;

export const salesAdminKeys = {
  /** Under `salesKeys.catalog()`, so invalidating the builder's catalog also refreshes this. */
  catalog: () => [...salesKeys.catalog(), "admin"] as const,
  templates: () => salesKeys.templates(),
  settings: () => salesKeys.settings(),
} as const;

/** Rows without an id can't be edited or deleted: drop them. */
const withId = <T extends { id: string }>(rows: T[]): T[] => rows.filter((r) => r.id !== "");

export const normalizeCatalogAdminList = (raw: unknown): CatalogItem[] =>
  withId(normalizeList(raw, normalizeCatalogItem));
export const normalizeTemplateAdminList = (raw: unknown): QuoteTemplate[] =>
  withId(normalizeList(raw, normalizeTemplate));

export const salesAdminApi = {
  listCatalog: async (signal?: AbortSignal): Promise<CatalogItem[]> =>
    normalizeCatalogAdminList(await api.get<unknown>(salesAdminPaths.catalog, { query: CATALOG_ADMIN_QUERY, signal })),
  createCatalogItem: async (body: CatalogItemInput): Promise<CatalogItem> =>
    normalizeCatalogItem(await api.post<unknown>(salesAdminPaths.catalog, body)),
  updateCatalogItem: async (id: string, body: Partial<CatalogItemInput>): Promise<CatalogItem> =>
    normalizeCatalogItem(await api.patch<unknown>(salesAdminPaths.catalogItem(id), body)),
  /** Soft delete (the API sets active=false; quotes keep referencing the row). Same as `updateCatalogItem(id, {active:false})`. */
  deactivateCatalogItem: async (id: string): Promise<CatalogItem> =>
    normalizeCatalogItem(await api.delete<unknown>(salesAdminPaths.catalogItem(id))),

  listTemplates: async (signal?: AbortSignal): Promise<QuoteTemplate[]> =>
    normalizeTemplateAdminList(await api.get<unknown>(salesAdminPaths.templates, { signal })),
  createTemplate: async (body: QuoteTemplateInput): Promise<QuoteTemplate> =>
    normalizeTemplate(await api.post<unknown>(salesAdminPaths.templates, body)),
  updateTemplate: async (id: string, body: Partial<QuoteTemplateInput>): Promise<QuoteTemplate> =>
    normalizeTemplate(await api.patch<unknown>(salesAdminPaths.template(id), body)),
  deleteTemplate: (id: string) => api.delete<unknown>(salesAdminPaths.template(id)),

  getSettings: async (signal?: AbortSignal): Promise<QuotationSettings> =>
    normalizeSettings(await api.get<unknown>(salesAdminPaths.settings, { signal })),
  putSettings: async (body: QuotationSettingsInput): Promise<QuotationSettings> =>
    normalizeSettings(await api.put<unknown>(salesAdminPaths.settings, body)),
};
