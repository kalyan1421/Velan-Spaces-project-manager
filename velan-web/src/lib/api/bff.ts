import "server-only";

import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { splitSessionPayload } from "./auth";
import { validateBffPath } from "./bff-path";
import { forwardedFor } from "./forwarding";
import { jsonError, rejectCrossSite } from "./route-helpers";
import { networkError, rawApiFetch } from "./server";
import { isTerminalRefreshFailure, readSessionTokens, refreshAndPersist, setSessionCookies } from "./session";

/** Uploads go straight to Storage via signed URLs, so BFF bodies stay small. */
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 30_000;

/** Upstream response headers worth passing to the browser. Never Set-Cookie. */
const PASS_HEADERS = [
  "content-type",
  "content-disposition",
  "retry-after",
  "x-total-count",
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
];

const EXPIRED = "Your session has expired. Please sign in again.";
const UNAVAILABLE = "We couldn't reach the server. Please try again.";

async function relay(res: Response): Promise<Response> {
  const headers = new Headers({ "Cache-Control": "no-store" });
  for (const name of PASS_HEADERS) {
    const value = res.headers.get(name);
    if (value) headers.set(name, value);
  }

  if (res.status >= 300 && res.status < 400) return jsonError(502, "Unexpected response from the server.");
  if (res.status === 204 || res.status === 304) return new Response(null, { status: res.status, headers });

  const type = res.headers.get("content-type") ?? "";
  if (type.includes("json")) {
    const text = await res.text();
    // Defence in depth: tokens must never reach browser JS. If an endpoint ever
    // returns a session, move it into cookies and strip it from the body.
    if (text.includes('"accessToken"') || text.includes('"refreshToken"')) {
      try {
        const { tokens, rest } = splitSessionPayload(JSON.parse(text));
        if (tokens) await setSessionCookies(tokens);
        return new Response(JSON.stringify(rest), { status: res.status, headers });
      } catch {
        return jsonError(502, "Unexpected response from the server.");
      }
    }
    return new Response(text || null, { status: res.status, headers });
  }

  return new Response(res.body, { status: res.status, headers });
}

/**
 * Forwards `/api/bff/<path>` to `${API_URL}/<path>` with the session's bearer token.
 * See WEB_APP_PLAN §2 for the contract.
 */
export async function proxyToApi(request: NextRequest, segments: string[] | undefined): Promise<Response> {
  const method = request.method.toUpperCase();

  const crossSite = rejectCrossSite(request);
  if (crossSite) return crossSite;

  const target = validateBffPath(segments);
  if (!target.ok) return jsonError(target.status, target.status === 404 ? "Not found." : "Invalid request path.");

  const url = `${getEnv().API_URL}/${target.path}${request.nextUrl.search}`;

  let body: ArrayBuffer | null = null;
  const contentType = request.headers.get("content-type");
  if (method !== "GET" && method !== "HEAD") {
    if (Number(request.headers.get("content-length") ?? "0") > MAX_BODY_BYTES) {
      return jsonError(413, "Request is too large.");
    }
    const buffer = await request.arrayBuffer();
    if (buffer.byteLength > MAX_BODY_BYTES) return jsonError(413, "Request is too large.");
    if (buffer.byteLength > 0) {
      const type = (contentType ?? "").toLowerCase();
      if (!type.startsWith("application/json") && !type.startsWith("multipart/form-data")) {
        return jsonError(415, "Send JSON or multipart form data.");
      }
      body = buffer;
    }
  }

  const xff = forwardedFor(request.headers);
  const send = (accessToken: string) =>
    rawApiFetch(url, {
      method,
      accessToken,
      body,
      contentType: body ? contentType : null,
      forwardedFor: xff,
      timeoutMs: TIMEOUT_MS,
      signal: request.signal,
    });

  const tokens = await readSessionTokens();
  const refreshToken = tokens.refreshToken;
  let accessToken = tokens.accessToken;
  let refreshed = false;

  if (!accessToken) {
    if (!refreshToken) return jsonError(401, EXPIRED);
    const outcome = await refreshAndPersist(xff);
    if (!outcome.ok) {
      return isTerminalRefreshFailure(outcome) ? jsonError(401, EXPIRED) : jsonError(503, UNAVAILABLE);
    }
    accessToken = outcome.tokens.accessToken;
    refreshed = true;
  }

  try {
    let res = await send(accessToken);
    if (res.status === 401 && !refreshed && refreshToken) {
      const outcome = await refreshAndPersist(xff);
      if (outcome.ok) {
        res = await send(outcome.tokens.accessToken);
      } else if (isTerminalRefreshFailure(outcome)) {
        return jsonError(401, EXPIRED);
      } else {
        return jsonError(503, UNAVAILABLE);
      }
    }
    return await relay(res);
  } catch (error) {
    const err = networkError(error);
    return jsonError(err.status, err.message);
  }
}
