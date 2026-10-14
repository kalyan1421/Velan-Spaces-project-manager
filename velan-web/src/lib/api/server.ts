import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getEnv } from "@/lib/env";
import { PATHNAME_HEADER, loginUrl, refreshUrl } from "@/lib/auth/redirects";
import { ApiError, apiErrorFromBody, readBody } from "./errors";
import { forwardedFor as forwardedForFrom } from "./forwarding";
import { isTerminalRefreshFailure, readSessionTokens, refreshAndPersist } from "./session";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type QueryValue = string | number | boolean | null | undefined;

const DEFAULT_TIMEOUT_MS = 15_000;

/** `${API_URL}/<path>?<query>`. `path` is relative to the API base (no leading slash needed). */
export function apiUrl(path: string, query?: Record<string, QueryValue>): string {
  const clean = path.replace(/^\/+/, "");
  const url = `${getEnv().API_URL}/${clean}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
}

export type RawApiInit = {
  method?: string;
  accessToken?: string | null;
  /** Pre-encoded body + its content type (JSON string, multipart bytes…). */
  body?: BodyInit | null;
  contentType?: string | null;
  forwardedFor?: string | null;
  timeoutMs?: number;
  signal?: AbortSignal;
};

/**
 * Low-level call to the API. Never forwards browser cookies; adds the bearer
 * token and client IP when given. Throws only on network failure / timeout.
 */
export async function rawApiFetch(url: string, init: RawApiInit = {}): Promise<Response> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (init.accessToken) h.Authorization = `Bearer ${init.accessToken}`;
  if (init.contentType) h["Content-Type"] = init.contentType;
  if (init.forwardedFor) h["X-Forwarded-For"] = init.forwardedFor;

  const timeout = AbortSignal.timeout(init.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout;

  return fetch(url, {
    method: init.method ?? "GET",
    headers: h,
    body: init.body ?? undefined,
    cache: "no-store",
    redirect: "manual",
    signal,
  });
}

/** Maps a thrown fetch error to an ApiError (504 on timeout, 502 otherwise). */
export function networkError(error: unknown): ApiError {
  const timedOut = error instanceof DOMException && error.name === "TimeoutError";
  return new ApiError(
    timedOut ? 504 : 502,
    timedOut
      ? "The server took too long to respond. Please try again."
      : "We couldn't reach the server. Please try again.",
  );
}

export type ApiFetchOptions = {
  method?: HttpMethod;
  /** Serialised as JSON. */
  body?: unknown;
  query?: Record<string, QueryValue>;
  /** Attach the session bearer token (default true). */
  auth?: boolean;
  timeoutMs?: number;
  /**
   * What to do when the API answers 401:
   * - `"redirect"` (default, Server Components): bounce through `/api/auth/refresh`,
   *   which can rotate the cookies, then come back to the current page.
   * - `"refresh"` (Route Handlers): refresh in place, persist cookies, retry once.
   * - `"throw"`: throw the ApiError.
   */
  onUnauthorized?: "redirect" | "refresh" | "throw";
};

async function currentPath(): Promise<string | null> {
  return (await headers()).get(PATHNAME_HEADER);
}

/** Server Components can't set cookies, so token refresh happens in a route handler. */
export async function redirectToRefresh(): Promise<never> {
  redirect(refreshUrl(await currentPath()));
}

export async function redirectToLogin(reason?: string): Promise<never> {
  redirect(loginUrl(await currentPath(), reason));
}

/**
 * Typed API call for Server Components and Route Handlers.
 *
 * Note: with the default `onUnauthorized: "redirect"` this may throw Next's
 * redirect signal. When wrapping it in try/catch, rethrow anything that is not
 * an `ApiError` (`if (!isApiError(e)) throw e`).
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const auth = options.auth ?? true;
  const mode = options.onUnauthorized ?? "redirect";
  const url = apiUrl(path, options.query);
  const xff = forwardedForFrom(await headers());
  const hasBody = options.body !== undefined;

  const send = async (accessToken: string | null) => {
    try {
      return await rawApiFetch(url, {
        method: options.method ?? "GET",
        accessToken,
        body: hasBody ? JSON.stringify(options.body) : null,
        contentType: hasBody ? "application/json" : null,
        forwardedFor: xff,
        timeoutMs: options.timeoutMs,
      });
    } catch (error) {
      throw networkError(error);
    }
  };

  let accessToken: string | null = null;
  let refreshed = false;

  if (auth) {
    const tokens = await readSessionTokens();
    accessToken = tokens.accessToken;
    if (!accessToken) {
      if (!tokens.refreshToken) {
        if (mode === "redirect") await redirectToLogin();
        throw new ApiError(401, "");
      }
      if (mode === "redirect") await redirectToRefresh();
      if (mode === "refresh") {
        const outcome = await refreshAndPersist(xff);
        if (!outcome.ok) throw new ApiError(isTerminalRefreshFailure(outcome) ? 401 : 503, "");
        accessToken = outcome.tokens.accessToken;
        refreshed = true;
      } else {
        throw new ApiError(401, "");
      }
    }
  }

  let res = await send(accessToken);

  if (res.status === 401 && auth) {
    if (mode === "redirect") await redirectToRefresh();
    if (mode === "refresh" && !refreshed) {
      const outcome = await refreshAndPersist(xff);
      if (outcome.ok) res = await send(outcome.tokens.accessToken);
      else if (!isTerminalRefreshFailure(outcome)) throw new ApiError(503, "");
    }
  }

  if (!res.ok) throw apiErrorFromBody(res.status, await readBody(res));
  if (res.status === 204) return undefined as T;
  const body = await readBody(res);
  return (body ?? undefined) as T;
}
