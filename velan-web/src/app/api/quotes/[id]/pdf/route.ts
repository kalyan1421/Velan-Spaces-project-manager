import type { NextRequest } from "next/server";
import { apiErrorFromBody, readBody } from "@/lib/api/errors";
import { forwardedFor } from "@/lib/api/forwarding";
import { jsonError } from "@/lib/api/route-helpers";
import { salesPaths } from "@/lib/api/sales";
import { apiUrl, networkError } from "@/lib/api/server";
import { isTerminalRefreshFailure, readSessionTokens, refreshAndPersist } from "@/lib/api/session";
import { pdfDisposition } from "./disposition";

/**
 * GET /api/quotes/:id/pdf[?download=1] — the API's server-rendered quotation
 * PDF (`GET /quotes/:id/pdf`, pdfkit), streamed to the browser with the
 * session's bearer token. Same auth + refresh rules as the BFF (src/lib/api/bff.ts),
 * but binary-safe: the bytes are passed through untouched.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** PDFs with a cover image take a while to render. */
const TIMEOUT_MS = 60_000;
const EXPIRED = "Your session has expired. Please sign in again.";
const UNAVAILABLE = "We couldn't reach the server. Please try again.";

type Ctx = RouteContext<"/api/quotes/[id]/pdf">;

export async function GET(request: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return jsonError(404, "Not found.");

  const url = apiUrl(salesPaths.quotePdf(id));
  const xff = forwardedFor(request.headers);
  const send = (accessToken: string) =>
    fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/pdf, application/json;q=0.5",
        ...(xff ? { "X-Forwarded-For": xff } : {}),
      },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)]),
    });

  const tokens = await readSessionTokens();
  let accessToken = tokens.accessToken;
  let refreshed = false;

  if (!accessToken) {
    if (!tokens.refreshToken) return jsonError(401, EXPIRED);
    const outcome = await refreshAndPersist(xff);
    if (!outcome.ok) return isTerminalRefreshFailure(outcome) ? jsonError(401, EXPIRED) : jsonError(503, UNAVAILABLE);
    accessToken = outcome.tokens.accessToken;
    refreshed = true;
  }

  let res: Response;
  try {
    res = await send(accessToken);
    if (res.status === 401 && !refreshed && tokens.refreshToken) {
      const outcome = await refreshAndPersist(xff);
      if (outcome.ok) res = await send(outcome.tokens.accessToken);
      else return isTerminalRefreshFailure(outcome) ? jsonError(401, EXPIRED) : jsonError(503, UNAVAILABLE);
    }
  } catch (error) {
    const err = networkError(error);
    return jsonError(err.status, err.message);
  }

  if (res.status === 401) return jsonError(401, EXPIRED);
  if (!res.ok) {
    const err = apiErrorFromBody(res.status, await readBody(res));
    return jsonError(res.status >= 500 ? 502 : res.status, err.message);
  }

  const type = res.headers.get("content-type") ?? "";
  if (!type.toLowerCase().includes("application/pdf") || !res.body) {
    await res.body?.cancel().catch(() => undefined);
    return jsonError(502, "The server didn't return a PDF.");
  }

  const headers = new Headers({
    "Content-Type": "application/pdf",
    "Content-Disposition": pdfDisposition(
      res.headers.get("content-disposition"),
      request.nextUrl.searchParams.get("download") === "1",
    ),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  const length = res.headers.get("content-length");
  if (length && /^\d+$/.test(length)) headers.set("Content-Length", length);
  return new Response(res.body, { status: 200, headers });
}
