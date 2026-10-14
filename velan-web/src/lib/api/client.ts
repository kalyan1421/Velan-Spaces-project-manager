/**
 * Browser-side API access. Everything goes through the BFF (`/api/bff/...`),
 * which holds the tokens in HttpOnly cookies; this module never sees a token.
 * Use with TanStack Query: `useQuery({ queryKey, queryFn: () => api.get<T>("projects") })`.
 */

import { loginUrl } from "@/lib/auth/redirects";
import { ApiError, apiErrorFromBody, fallbackMessage, readBody } from "./errors";

export type ClientQuery = Record<string, string | number | boolean | null | undefined>;

export type BffOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: ClientQuery;
  /** Plain values are sent as JSON; FormData is sent as multipart. */
  body?: unknown;
  signal?: AbortSignal;
  /**
   * On 401 (session gone even after the BFF tried a refresh), the default is to
   * send the user to `/login?next=<current page>`. Pass `"throw"` for endpoints
   * where 401 is a normal answer (e.g. change-password with a wrong current password).
   */
  on401?: "redirect" | "throw";
};

export function bffUrl(path: string, query?: ClientQuery): string {
  const clean = path.replace(/^\/+/, "");
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return `/api/bff/${clean}${qs ? `?${qs}` : ""}`;
}

let redirecting = false;

function redirectToLogin() {
  if (typeof window === "undefined" || redirecting) return;
  const here = `${window.location.pathname}${window.location.search}`;
  if (window.location.pathname === "/login") return;
  redirecting = true;
  window.location.assign(loginUrl(here, "expired"));
}

/** Low-level JSON fetch to one of our own route handlers. Throws ApiError. */
export async function fetchJson<T>(
  url: string,
  init: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  const hasBody = init.body !== undefined;
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? (hasBody ? "POST" : "GET"),
      headers: {
        Accept: "application/json",
        ...(hasBody && !isForm ? { "Content-Type": "application/json" } : {}),
      },
      body: hasBody ? (isForm ? (init.body as FormData) : JSON.stringify(init.body)) : undefined,
      credentials: "same-origin",
      cache: "no-store",
      signal: init.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, fallbackMessage(0));
  }

  const body = await readBody(res);
  if (!res.ok) throw apiErrorFromBody(res.status, body);
  return (body ?? undefined) as T;
}

/** Calls the API through the BFF. Throws ApiError; redirects to login on 401 by default. */
export async function bff<T>(path: string, options: BffOptions = {}): Promise<T> {
  try {
    return await fetchJson<T>(bffUrl(path, options.query), {
      method: options.method ?? "GET",
      body: options.body,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && (options.on401 ?? "redirect") === "redirect") {
      redirectToLogin();
    }
    throw error;
  }
}

type Opts = Omit<BffOptions, "method" | "body">;

export const api = {
  get: <T>(path: string, options?: Opts) => bff<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Opts) => bff<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: Opts) => bff<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: Opts) => bff<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Opts) => bff<T>(path, { ...options, method: "DELETE" }),
};
