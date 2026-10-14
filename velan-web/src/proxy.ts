import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/api/cookies";
import { PATHNAME_HEADER, loginUrl, refreshUrl } from "@/lib/auth/redirects";

/**
 * Request interceptor (Next 16 renamed `middleware` → `proxy`).
 * Cheap cookie-presence check only — no API calls. Real authorization is the
 * API's job; layouts call `requireRole()` for role routing.
 *
 * - no session cookies          → /login?next=<path>
 * - refresh cookie only         → /api/auth/refresh?next=<path> (route handler rotates cookies)
 * - otherwise                   → continue, exposing the path to Server Components
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const here = `${pathname}${search}`;
  const hasAccess = request.cookies.has(ACCESS_COOKIE);
  const hasRefresh = request.cookies.has(REFRESH_COOKIE);

  if (!hasAccess && !hasRefresh) {
    return NextResponse.redirect(new URL(loginUrl(here), request.url));
  }
  if (!hasAccess) {
    return NextResponse.redirect(new URL(refreshUrl(here), request.url));
  }
  if (pathname === "/app" || pathname === "/app/") {
    return NextResponse.redirect(new URL("/app/projects", request.url));
  }

  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, here);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/app", "/app/:path*", "/portal", "/portal/:path*"],
};
