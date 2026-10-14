// Self-contained, server-side fetcher for the public website endpoints.
// Deliberately independent of src/lib (see WEB_APP_PLAN.md §3) and free of
// Next.js imports so it can be unit-tested with a mocked fetch.
//
// Every function here resolves — it never throws — so a missing or failing API
// can never break a build or a page render. Callers decide what to show.

import {
  isPortfolioCategory,
  isValidSlug,
  type PortfolioCategory,
  type PublicPortfolioItem,
} from "./portfolio-types";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const API_TIMEOUT_MS = 8_000;

export function apiBaseUrl(env: Record<string, string | undefined> = process.env): string {
  const raw = env.API_URL?.trim() || "http://localhost:3000/api/v1";
  return raw.replace(/\/+$/, "");
}

export type PortfolioListResult =
  | { ok: true; items: PublicPortfolioItem[] }
  | { ok: false; items: [] };

export type PortfolioItemResult =
  | { status: "found"; item: PublicPortfolioItem }
  | { status: "not-found" }
  | { status: "error" };

/* -------------------------------------------------------------------------- */
/* Normalisation — never trust the wire format blindly                         */
/* -------------------------------------------------------------------------- */

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function httpUrl(value: unknown): string | null {
  const s = str(value);
  if (!s) return null;
  try {
    const url = new URL(s);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** Returns a clean item, or null if the payload is not usable. */
export function normalizePortfolioItem(raw: unknown): PublicPortfolioItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const slug = str(r.slug);
  const title = str(r.title);
  if (!slug || !isValidSlug(slug) || !title) return null;

  const category: PortfolioCategory = isPortfolioCategory(r.category) ? r.category : "other";
  const imageUrls = Array.isArray(r.imageUrls)
    ? r.imageUrls.map(httpUrl).filter((url): url is string => url !== null)
    : [];
  const year = num(r.completionYear);

  return {
    id: str(r.id) ?? slug,
    slug,
    title,
    description: str(r.description),
    category,
    location: str(r.location),
    completionYear: year !== null && year >= 1900 && year <= 2200 ? Math.trunc(year) : null,
    coverImageUrl: httpUrl(r.coverImageUrl),
    imageUrls,
    sortOrder: num(r.sortOrder) ?? 0,
    createdAt: str(r.createdAt) ?? "",
    updatedAt: str(r.updatedAt) ?? "",
  };
}

/* -------------------------------------------------------------------------- */
/* Requests                                                                    */
/* -------------------------------------------------------------------------- */

async function getJson(
  url: string,
  fetchImpl: FetchLike,
): Promise<{ status: number; body: unknown } | null> {
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });
    let body: unknown = null;
    if (res.ok) {
      body = await res.json();
    }
    return { status: res.status, body };
  } catch {
    // Network error, timeout, or invalid JSON.
    return null;
  }
}

/**
 * GET /public/portfolio?category= — published items in sortOrder.
 * Resolves `{ ok: false }` on any failure.
 */
export async function fetchPortfolioList(
  category?: PortfolioCategory | null,
  fetchImpl: FetchLike = fetch,
  baseUrl: string = apiBaseUrl(),
): Promise<PortfolioListResult> {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  const res = await getJson(`${baseUrl}/public/portfolio${query}`, fetchImpl);
  if (!res || res.status !== 200 || !Array.isArray(res.body)) return { ok: false, items: [] };

  const seen = new Set<string>();
  const items: PublicPortfolioItem[] = [];
  for (const raw of res.body) {
    const item = normalizePortfolioItem(raw);
    if (item && !seen.has(item.slug)) {
      seen.add(item.slug);
      items.push(item);
    }
  }
  items.sort((a, b) => a.sortOrder - b.sortOrder);
  return { ok: true, items };
}

/**
 * GET /public/portfolio/:slug — a single published item.
 * 404 (or an invalid slug) → "not-found"; anything else unexpected → "error".
 */
export async function fetchPortfolioItem(
  slug: string,
  fetchImpl: FetchLike = fetch,
  baseUrl: string = apiBaseUrl(),
): Promise<PortfolioItemResult> {
  if (!isValidSlug(slug)) return { status: "not-found" };

  const res = await getJson(`${baseUrl}/public/portfolio/${encodeURIComponent(slug)}`, fetchImpl);
  if (!res) return { status: "error" };
  if (res.status === 404) return { status: "not-found" };
  if (res.status !== 200) return { status: "error" };

  const item = normalizePortfolioItem(res.body);
  return item ? { status: "found", item } : { status: "error" };
}
