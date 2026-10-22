import "server-only";

import { sanitizeStaffList } from "@/lib/api/accounts";
import { isApiError } from "@/lib/api/errors";
import { salesPaths } from "@/lib/api/sales";
import {
  normalizeCatalogItem,
  normalizeLead,
  normalizeList,
  normalizeQuote,
  normalizeSettings,
  normalizeTemplate,
  type CatalogItem,
  type Lead,
  type QuotationSettings,
  type Quote,
  type QuoteTemplate,
} from "@/lib/api/sales-types";
import { apiFetch } from "@/lib/api/server";
import type { Role, User } from "@/lib/api/types";
import type { Person } from "./lead-model";

export type SalesLoad<T> = { kind: "ok"; data: T } | { kind: "forbidden" } | { kind: "missing" } | { kind: "error" };

/** Head and managers run sales; the API enforces the same rule. */
export function canUseSales(role: Role | undefined): boolean {
  return role === "head" || role === "manager";
}

/**
 * Settles the required calls together: any 403 → forbidden, 400/404 → missing,
 * other API failures → error. Non-API rejections (Next's redirect/refresh
 * signals) are rethrown untouched.
 */
async function settle<T extends unknown[]>(calls: { [K in keyof T]: Promise<T[K]> }): Promise<SalesLoad<T>> {
  const results = await Promise.allSettled(calls);
  const failures = results.flatMap((r) => (r.status === "rejected" ? [r.reason as unknown] : []));
  const foreign = failures.find((e) => !isApiError(e));
  if (foreign !== undefined) throw foreign;
  if (failures.some((e) => isApiError(e) && e.status === 403)) return { kind: "forbidden" };
  if (failures.some((e) => isApiError(e) && (e.status === 404 || e.status === 400))) return { kind: "missing" };
  if (failures.length > 0) return { kind: "error" };
  return { kind: "ok", data: results.map((r) => (r as PromiseFulfilledResult<unknown>).value) as T };
}

/** A nice-to-have call: API failures become the fallback, redirects still propagate. */
async function optional<T>(call: Promise<T>, fallback: T): Promise<T> {
  try {
    return await call;
  } catch (error) {
    if (!isApiError(error)) throw error;
    return fallback;
  }
}

export function personName(user: Pick<User, "displayName" | "username" | "email">): string {
  return user.displayName?.trim() || user.username || user.email?.split("@")[0] || "You";
}

/**
 * People a lead can be assigned to. The head sees managers via `GET /staff`;
 * managers only get workers from it, so they see just themselves.
 */
async function loadAssignees(user: User): Promise<Person[]> {
  const me: Person = { id: user.id, name: `${personName(user)} (you)` };
  if (user.role !== "head") return [me];
  const staff = await optional(apiFetch<unknown>("staff").then(sanitizeStaffList), []);
  const managers = staff
    .filter((m) => m.role === "manager" && !m.isSuspended)
    .map((m) => ({ id: m.id, name: m.displayName?.trim() || m.email || "Manager" }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [me, ...managers];
}

const leads = () => apiFetch<unknown>(salesPaths.leads()).then((r) => normalizeList(r, normalizeLead));
const lead = (id: string) => apiFetch<unknown>(salesPaths.lead(id)).then(normalizeLead);
const quotesFor = (leadId: string) =>
  apiFetch<unknown>(salesPaths.quotes(), { query: { leadId } }).then((r) =>
    // Older APIs ignore `?leadId=`; never show another lead's quotes.
    normalizeList(r, normalizeQuote).filter((q) => q.leadId === leadId),
  );
const quote = (id: string) => apiFetch<unknown>(salesPaths.quote(id)).then(normalizeQuote);
const catalog = () => apiFetch<unknown>(salesPaths.catalogItems()).then((r) => normalizeList(r, normalizeCatalogItem));
const templates = () => apiFetch<unknown>(salesPaths.templates()).then((r) => normalizeList(r, normalizeTemplate));
const settings = () => apiFetch<unknown>(salesPaths.settings()).then(normalizeSettings);

export async function loadPipeline(user: User): Promise<SalesLoad<{ leads: Lead[]; people: Person[] }>> {
  const [result, people] = await Promise.all([settle<[Lead[]]>([leads()]), loadAssignees(user)]);
  if (result.kind !== "ok") return result;
  return { kind: "ok", data: { leads: result.data[0], people } };
}

export async function loadLeadPage(
  user: User,
  leadId: string,
): Promise<SalesLoad<{ lead: Lead; quotes: Quote[]; people: Person[] }>> {
  const [result, people] = await Promise.all([settle<[Lead, Quote[]]>([lead(leadId), quotesFor(leadId)]), loadAssignees(user)]);
  if (result.kind !== "ok") return result;
  const [l, q] = result.data;
  if (!l.id) return { kind: "missing" };
  return { kind: "ok", data: { lead: l, quotes: q, people } };
}

export type QuotePageData = {
  quote: Quote;
  catalog: CatalogItem[];
  templates: QuoteTemplate[];
  settings: QuotationSettings;
  lead: Lead | null;
};

export async function loadQuotePage(quoteId: string): Promise<SalesLoad<QuotePageData>> {
  const [result, [t, s]] = await Promise.all([
    settle<[Quote, CatalogItem[]]>([quote(quoteId), catalog()]),
    Promise.all([optional(templates(), [] as QuoteTemplate[]), optional(settings(), normalizeSettings(null))]),
  ]);
  if (result.kind !== "ok") return result;
  const [q, c] = result.data;
  if (!q.id) return { kind: "missing" };
  const l = q.leadId ? await optional(lead(q.leadId), null) : null;
  return { kind: "ok", data: { quote: q, catalog: c, templates: t, settings: s, lead: l?.id ? l : null } };
}

/** Every quotation, newest first, with the lead names to show when a quote has no typed name. */
export async function loadAllQuotes(): Promise<SalesLoad<{ quotes: Quote[] }>> {
  const result = await settle<[Quote[]]>([
    apiFetch<unknown>(salesPaths.quotes()).then((r) => normalizeList(r, normalizeQuote)),
  ]);
  if (result.kind !== "ok") return result;
  return { kind: "ok", data: { quotes: result.data[0] } };
}
