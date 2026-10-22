/**
 * Sales API: paths, React Query keys and browser calls (via the BFF).
 * Server Components call the same paths through `apiFetch` (see `salesPaths`).
 * Types and row normalizers live in `./sales-types`.
 */

import { api } from "./client";
import {
  normalizeCatalogItem,
  normalizeLead,
  normalizeList,
  normalizeQuote,
  normalizeSettings,
  normalizeTemplate,
  type CatalogItem,
  type Lead,
  type LeadInput,
  type LeadPatch,
  type QuotationSettings,
  type Quote,
  type QuoteInput,
  type QuoteTemplate,
} from "./sales-types";

const seg = (id: string) => encodeURIComponent(id);

/** API paths relative to the API base / the BFF. */
export const salesPaths = {
  leads: () => "leads",
  lead: (id: string) => `leads/${seg(id)}`,
  quotes: () => "quotes",
  quote: (id: string) => `quotes/${seg(id)}`,
  duplicateQuote: (id: string) => `quotes/${seg(id)}/duplicate`,
  quotePdf: (id: string) => `quotes/${seg(id)}/pdf`,
  catalogItems: () => "catalog-items",
  templates: () => "quote-templates",
  settings: () => "quotation-settings",
} as const;

/** Same-origin route handler that streams the server-generated PDF (binary-safe). */
export function serverPdfUrl(quoteId: string, download = true): string {
  return `/api/quotes/${seg(quoteId)}/pdf${download ? "?download=1" : ""}`;
}

/** React Query keys. Invalidate `salesKeys.all` after any sales write that affects lists. */
export const salesKeys = {
  all: ["sales"] as const,
  leads: () => ["sales", "leads"] as const,
  lead: (id: string) => ["sales", "leads", id] as const,
  quotes: () => ["sales", "quotes"] as const,
  leadQuotes: (leadId: string) => ["sales", "quotes", { leadId }] as const,
  quote: (id: string) => ["sales", "quote", id] as const,
  catalog: () => ["sales", "catalog"] as const,
  templates: () => ["sales", "templates"] as const,
  settings: () => ["sales", "settings"] as const,
} as const;

type Signal = { signal?: AbortSignal };

export const salesApi = {
  listLeads: async ({ signal }: Signal = {}): Promise<Lead[]> =>
    normalizeList(await api.get<unknown>(salesPaths.leads(), { signal }), normalizeLead),
  getLead: async (id: string, { signal }: Signal = {}): Promise<Lead> =>
    normalizeLead(await api.get<unknown>(salesPaths.lead(id), { signal })),
  createLead: async (body: LeadInput): Promise<Lead> => normalizeLead(await api.post<unknown>(salesPaths.leads(), body)),
  updateLead: async (id: string, body: LeadPatch): Promise<Lead> =>
    normalizeLead(await api.patch<unknown>(salesPaths.lead(id), body)),
  deleteLead: (id: string) => api.delete<unknown>(salesPaths.lead(id)),

  listQuotes: async (leadId?: string, { signal }: Signal = {}): Promise<Quote[]> =>
    normalizeList(await api.get<unknown>(salesPaths.quotes(), { signal, query: { leadId } }), normalizeQuote),
  getQuote: async (id: string, { signal }: Signal = {}): Promise<Quote> =>
    normalizeQuote(await api.get<unknown>(salesPaths.quote(id), { signal })),
  createQuote: async (body: QuoteInput): Promise<Quote> => normalizeQuote(await api.post<unknown>(salesPaths.quotes(), body)),
  updateQuote: async (id: string, body: QuoteInput): Promise<Quote> =>
    normalizeQuote(await api.patch<unknown>(salesPaths.quote(id), body)),
  duplicateQuote: async (id: string): Promise<Quote> =>
    normalizeQuote(await api.post<unknown>(salesPaths.duplicateQuote(id))),
  deleteQuote: (id: string) => api.delete<unknown>(salesPaths.quote(id)),

  listCatalog: async ({ signal }: Signal = {}): Promise<CatalogItem[]> =>
    normalizeList(await api.get<unknown>(salesPaths.catalogItems(), { signal }), normalizeCatalogItem),
  listTemplates: async ({ signal }: Signal = {}): Promise<QuoteTemplate[]> =>
    normalizeList(await api.get<unknown>(salesPaths.templates(), { signal }), normalizeTemplate),
  getSettings: async ({ signal }: Signal = {}): Promise<QuotationSettings> =>
    normalizeSettings(await api.get<unknown>(salesPaths.settings(), { signal })),
};
