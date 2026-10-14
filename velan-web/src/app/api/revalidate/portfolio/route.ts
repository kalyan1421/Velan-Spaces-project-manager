import { revalidateTag } from "next/cache";
import { PORTFOLIO_CACHE_TAG } from "@/components/marketing/portfolio-data";
import { checkRevalidateOrigin, checkRevalidateUser } from "@/lib/api/portfolio-admin";
import { isApiError } from "@/lib/api/errors";
import { json, jsonError } from "@/lib/api/route-helpers";
import { readSessionTokens } from "@/lib/api/session";
import type { User } from "@/lib/api/types";
import { getSession } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";

/**
 * POST /api/revalidate/portfolio — called by the website admin after every
 * portfolio change. Expires the public site's `'use cache'` entries tagged
 * `public-portfolio` (list, detail pages, sitemap) so the next visitor gets
 * fresh data instead of waiting for the 5-minute background revalidation.
 *
 * Same-origin only (CSRF), and only for a signed-in head.
 */
export async function POST(request: Request): Promise<Response> {
  const crossSite = checkRevalidateOrigin(
    { origin: request.headers.get("origin"), referer: request.headers.get("referer") },
    getEnv().APP_URL,
  );
  if (crossSite) return jsonError(crossSite.status, crossSite.message);

  // getSession() would redirect through /api/auth/refresh without an access
  // token; a fetch() caller wants a plain 401 instead.
  const { accessToken } = await readSessionTokens();
  let user: User | null = null;
  if (accessToken) {
    try {
      user = await getSession();
    } catch (error) {
      if (!isApiError(error)) throw error;
      return jsonError(503, "We couldn't verify your session. Please try again.");
    }
  }

  const denied = checkRevalidateUser(user);
  if (denied) return jsonError(denied.status, denied.message);

  // `expire: 0`: the next request blocks on fresh data rather than being served
  // stale content — a hidden item must disappear for the very next visitor.
  revalidateTag(PORTFOLIO_CACHE_TAG, { expire: 0 });
  return json({ revalidated: true });
}
