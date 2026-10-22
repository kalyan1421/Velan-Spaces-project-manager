import "server-only";

import { cache } from "react";
import { isApiError } from "@/lib/api/errors";
import {
  CATALOG_ADMIN_QUERY,
  normalizeCatalogAdminList,
  normalizeTemplateAdminList,
  salesAdminPaths,
} from "@/lib/api/sales-admin";
import {
  normalizeSettings,
  normalizeTemplate,
  type CatalogItem,
  type QuotationSettings,
  type QuoteTemplate,
} from "@/lib/api/sales-types";
import { apiFetch } from "@/lib/api/server";

/** What a page can render with: data, a 403/404, or "let the client fetch again and show its own retry". */
export type Loaded<T> = { kind: "ok"; data: T } | { kind: "forbidden" } | { kind: "missing" } | { kind: "unavailable" };

async function settle<T>(load: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { kind: "ok", data: await load() };
  } catch (error) {
    if (!isApiError(error)) throw error; // redirects (session refresh / login) must propagate
    if (error.status === 403) return { kind: "forbidden" };
    if (error.status === 404) return { kind: "missing" };
    return { kind: "unavailable" };
  }
}

export const TEMPLATES_FORBIDDEN = "Only the admin can manage quote templates.";
export const SETTINGS_FORBIDDEN = "Only the admin can change quotation settings.";

export const initialOf = <T,>(loaded: Loaded<T>): T | undefined => (loaded.kind === "ok" ? loaded.data : undefined);

/** Every rate card item, inactive ones included. */
export const loadCatalogAdmin = cache(() =>
  settle(async (): Promise<CatalogItem[]> =>
    normalizeCatalogAdminList(await apiFetch<unknown>(salesAdminPaths.catalog, { query: CATALOG_ADMIN_QUERY })),
  ),
);

export const loadTemplates = cache(() =>
  settle(async (): Promise<QuoteTemplate[]> =>
    normalizeTemplateAdminList(await apiFetch<unknown>(salesAdminPaths.templates)),
  ),
);

export const loadTemplate = cache((id: string) =>
  settle(async (): Promise<QuoteTemplate> => normalizeTemplate(await apiFetch<unknown>(salesAdminPaths.template(id)))),
);

export const loadQuotationSettings = cache(() =>
  settle(async (): Promise<QuotationSettings> => normalizeSettings(await apiFetch<unknown>(salesAdminPaths.settings))),
);
