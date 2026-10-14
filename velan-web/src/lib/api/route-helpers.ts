import "server-only";

import type { z } from "zod";
import { getEnv } from "@/lib/env";
import { isSafeMethod, isSameOriginRequest } from "./csrf";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_JSON_BYTES = 64 * 1024;

export function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

/** Error responses use the API's own envelope so the browser parses one shape. */
export function jsonError(status: number, message: string, extra: Record<string, unknown> = {}): Response {
  return json({ statusCode: status, message, ...extra }, status);
}

/** 303 to a same-origin relative path; cookies set via `cookies()` are merged by Next. */
export function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { ...NO_STORE, Location: location } });
}

/** CSRF gate for state-changing requests. Returns a 403 response, or null when allowed. */
export function rejectCrossSite(request: Request): Response | null {
  if (isSafeMethod(request.method)) return null;
  const ok = isSameOriginRequest(
    { origin: request.headers.get("origin"), referer: request.headers.get("referer") },
    getEnv().APP_URL,
  );
  return ok ? null : jsonError(403, "Cross-site request blocked.");
}

/** Reads and validates a small JSON body. Returns the data or a ready-made error response. */
export async function readJsonBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: Response }> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_JSON_BYTES) return { ok: false, response: jsonError(413, "Request is too large.") };

  let raw: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_JSON_BYTES) return { ok: false, response: jsonError(413, "Request is too large.") };
    raw = text ? JSON.parse(text) : {};
  } catch {
    return { ok: false, response: jsonError(400, "The request body must be JSON.") };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => i.message);
    return { ok: false, response: json({ statusCode: 400, message: messages }, 400) };
  }
  return { ok: true, data: parsed.data };
}

/** Message from an API error body (`message` may be string or string[]). */
export function upstreamMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return typeof body === "string" && body ? body : null;
  const m = (body as { message?: unknown }).message;
  if (typeof m === "string" && m.trim()) return m.trim();
  if (Array.isArray(m)) {
    const parts = m.filter((x): x is string => typeof x === "string" && x.trim() !== "");
    return parts.length ? parts.join("; ") : null;
  }
  return null;
}
