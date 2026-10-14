import type { NextRequest } from "next/server";
import { readBody } from "@/lib/api/errors";
import { forwardedFor } from "@/lib/api/forwarding";
import { seeOther } from "@/lib/api/route-helpers";
import { apiUrl, rawApiFetch } from "@/lib/api/server";
import { clearSessionCookies, isTerminalRefreshFailure, refreshAndPersist } from "@/lib/api/session";
import type { User } from "@/lib/api/types";
import { loginUrl, refreshUrl, safeNextPath } from "@/lib/auth/redirects";
import { isRole, postLoginRedirect } from "@/lib/auth/roles";

/**
 * GET /api/auth/refresh?next=/app/... — rotates the session cookies, then
 * returns the user to `next` (or their landing page).
 *
 * Server Components can't set cookies, so the interceptor (missing `vs_at`) and
 * server-side 401s bounce through here. The new token is verified with
 * `/auth/me` before redirecting back, which rules out redirect loops.
 */
export async function GET(request: NextRequest) {
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const xff = forwardedFor(request.headers);

  const outcome = await refreshAndPersist(xff);
  if (!outcome.ok) {
    if (isTerminalRefreshFailure(outcome)) {
      return seeOther(loginUrl(next, outcome.status === 403 ? "suspended" : "expired"));
    }
    return unavailable(next);
  }

  let res: Response;
  try {
    res = await rawApiFetch(apiUrl("auth/me"), { accessToken: outcome.tokens.accessToken, forwardedFor: xff });
  } catch {
    return unavailable(next);
  }

  if (res.status === 401 || res.status === 403) {
    await clearSessionCookies();
    return seeOther(loginUrl(next, res.status === 403 ? "suspended" : "expired"));
  }
  if (!res.ok) return unavailable(next);

  const user = (await readBody(res)) as User | null;
  if (!user || !isRole(user.role)) {
    await clearSessionCookies();
    return seeOther(loginUrl(next, "expired"));
  }
  return seeOther(postLoginRedirect(user.role, next));
}

/**
 * The API is down: keep the cookies and show a tiny retry page instead of
 * redirecting (a redirect to /login would just come straight back here).
 */
function unavailable(next: string | null): Response {
  // Built only from the validated `next`, then HTML-escaped.
  const retry = refreshUrl(next).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Can't reach Velan Spaces</title><meta name="robots" content="noindex"></head><body style="font-family:system-ui,sans-serif;background:#F8F9FC;color:#1A1A2E;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px"><main style="max-width:28rem;text-align:center"><h1 style="font-size:1.25rem">We can't reach the server right now</h1><p style="color:#4B5563">Your work is safe. Please try again in a moment.</p><p><a href="${retry}" style="color:#1A1A2E;font-weight:600">Try again</a></p></main></body></html>`;
  return new Response(html, {
    status: 503,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "10" },
  });
}
