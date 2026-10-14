import "server-only";

import { cookies } from "next/headers";
import { getEnv } from "@/lib/env";
import { isTokenSet } from "./auth";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_MAX_AGE,
  accessCookieMaxAge,
  sessionCookieOptions,
  shouldUseSecureCookies,
} from "./cookies";
import type { TokenSet } from "./types";

export { ACCESS_COOKIE, REFRESH_COOKIE };

export type SessionTokens = { accessToken: string | null; refreshToken: string | null };

/** Reads the session cookies. Works in Server Components and Route Handlers. */
export async function readSessionTokens(): Promise<SessionTokens> {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_COOKIE)?.value || null,
    refreshToken: store.get(REFRESH_COOKIE)?.value || null,
  };
}

/**
 * Writes `vs_at` (maxAge from `expiresAt`) and `vs_rt` (30 days).
 * Route Handlers / Server Functions only — Server Components cannot set cookies.
 */
export async function setSessionCookies(tokens: TokenSet): Promise<void> {
  const store = await cookies();
  const secure = shouldUseSecureCookies();
  const accessMaxAge = accessCookieMaxAge(tokens.expiresAt);
  store.set(ACCESS_COOKIE, accessMaxAge > 0 ? tokens.accessToken : "", sessionCookieOptions(accessMaxAge, secure));
  store.set(REFRESH_COOKIE, tokens.refreshToken, sessionCookieOptions(REFRESH_MAX_AGE, secure));
}

/** Expires both session cookies. Route Handlers / Server Functions only. */
export async function clearSessionCookies(): Promise<void> {
  const store = await cookies();
  const secure = shouldUseSecureCookies();
  store.set(ACCESS_COOKIE, "", sessionCookieOptions(0, secure));
  store.set(REFRESH_COOKIE, "", sessionCookieOptions(0, secure));
}

// ------------------------------------------------------------------ refresh

export type RefreshOutcome =
  | { ok: true; tokens: TokenSet }
  /** status 0 = API unreachable. 401/403/400 are terminal (session is gone). */
  | { ok: false; status: number; message?: string };

/** True when the refresh token is definitely unusable and the cookies should go. */
export function isTerminalRefreshFailure(outcome: RefreshOutcome): boolean {
  return !outcome.ok && outcome.status >= 400 && outcome.status < 500 && outcome.status !== 429;
}

type Flight = { promise: Promise<RefreshOutcome>; settledAt: number | null };

// Supabase rotates refresh tokens and treats reuse as theft, so concurrent requests
// carrying the same `vs_rt` must share one refresh. Settled results are reused
// briefly for requests that were already in flight with the old cookie.
// Kept on globalThis so every route bundle in the process shares one map.
const FLIGHTS_KEY = Symbol.for("velan.web.refreshFlights");
const globalStore = globalThis as typeof globalThis & { [FLIGHTS_KEY]?: Map<string, Flight> };
const flights: Map<string, Flight> = (globalStore[FLIGHTS_KEY] ??= new Map<string, Flight>());
const REUSE_WINDOW_MS = 10_000;
const REFRESH_TIMEOUT_MS = 10_000;

function prune(now: number) {
  for (const [key, flight] of flights) {
    if (flight.settledAt !== null && now - flight.settledAt > REUSE_WINDOW_MS) flights.delete(key);
  }
}

async function callRefresh(refreshToken: string, forwardedFor: string | null): Promise<RefreshOutcome> {
  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (forwardedFor) headers["X-Forwarded-For"] = forwardedFor;
  try {
    const res = await fetch(`${getEnv().API_URL}/auth/refresh`, {
      method: "POST",
      headers,
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: unknown } | null;
      const message = typeof body?.message === "string" ? body.message : undefined;
      return { ok: false, status: res.status, message };
    }
    const body: unknown = await res.json().catch(() => null);
    if (!isTokenSet(body)) return { ok: false, status: 502 };
    return {
      ok: true,
      tokens: { accessToken: body.accessToken, refreshToken: body.refreshToken, expiresAt: body.expiresAt },
    };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Single-flight token refresh (per refresh token, per process). Does not touch cookies. */
export function refreshTokens(refreshToken: string, forwardedFor: string | null = null): Promise<RefreshOutcome> {
  const now = Date.now();
  prune(now);
  const existing = flights.get(refreshToken);
  if (existing) return existing.promise;

  const flight: Flight = { promise: Promise.resolve({ ok: false, status: 0 }), settledAt: null };
  flight.promise = callRefresh(refreshToken, forwardedFor).then((outcome) => {
    flight.settledAt = Date.now();
    // Don't pin transient failures; the next request should try again.
    if (!outcome.ok && !isTerminalRefreshFailure(outcome)) flights.delete(refreshToken);
    return outcome;
  });
  flights.set(refreshToken, flight);
  return flight.promise;
}

/**
 * Refreshes with the `vs_rt` cookie and persists the result: new cookies on
 * success, cleared cookies on a terminal failure, untouched on a transient one.
 * Route Handlers only.
 */
export async function refreshAndPersist(forwardedFor: string | null = null): Promise<RefreshOutcome> {
  const { refreshToken } = await readSessionTokens();
  if (!refreshToken) return { ok: false, status: 401 };
  const outcome = await refreshTokens(refreshToken, forwardedFor);
  if (outcome.ok) await setSessionCookies(outcome.tokens);
  else if (isTerminalRefreshFailure(outcome)) await clearSessionCookies();
  return outcome;
}
