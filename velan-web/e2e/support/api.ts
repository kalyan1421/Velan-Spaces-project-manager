/**
 * Minimal fetch client for the NestJS API (setup/teardown and flow helpers).
 * Spec files assert with Playwright's `request` fixture instead.
 */
import { API_URL } from "./env";

export type ApiResult<T = unknown> = { status: number; body: T };

export async function apiCall<T = unknown>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(`${API_URL}/${path.replace(/^\//, "")}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON (e.g. a PDF) */
  }
  return { status: res.status, body: parsed as T };
}

/** Like apiCall but throws unless the status is 2xx. */
export async function apiOk<T = unknown>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await apiCall<T>(token, method, path, body);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
  }
  return res.body;
}
