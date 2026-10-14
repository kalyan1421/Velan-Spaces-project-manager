import type { NextRequest } from "next/server";
import { forwardedFor } from "@/lib/api/forwarding";
import { json, rejectCrossSite, seeOther } from "@/lib/api/route-helpers";
import { apiUrl, rawApiFetch } from "@/lib/api/server";
import { clearSessionCookies, readSessionTokens, refreshTokens } from "@/lib/api/session";

/**
 * POST → best-effort `POST /auth/logout` (revokes the session server-side), then
 * always clears the cookies. A plain HTML form post gets a 303 to /login.
 */
export async function POST(request: NextRequest) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  const xff = forwardedFor(request.headers);
  const { accessToken, refreshToken } = await readSessionTokens();

  try {
    let token = accessToken;
    // An expired access cookie shouldn't leave the refresh token alive server-side.
    if (!token && refreshToken) {
      const outcome = await refreshTokens(refreshToken, xff);
      token = outcome.ok ? outcome.tokens.accessToken : null;
    }
    if (token) {
      await rawApiFetch(apiUrl("auth/logout"), { method: "POST", accessToken: token, forwardedFor: xff, timeoutMs: 5_000 });
    }
  } catch {
    // Best effort: the cookies are cleared regardless.
  }

  await clearSessionCookies();

  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
    return seeOther("/login");
  }
  return json({ ok: true });
}
