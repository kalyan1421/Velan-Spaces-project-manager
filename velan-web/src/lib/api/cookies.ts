/**
 * Session cookie names and options. Kept free of `next/headers` and `server-only`
 * so the request interceptor (src/proxy.ts) can import the names.
 */

export const ACCESS_COOKIE = "vs_at";
export const REFRESH_COOKIE = "vs_rt";
/** Non-sensitive UI preference (sidebar collapsed); readable by JS. */
export const SIDEBAR_COOKIE = "vs_sidebar";

/** 30 days, matching the API's refresh-token lifetime. */
export const REFRESH_MAX_AGE = 60 * 60 * 24 * 30;
/** Expire the access cookie this many seconds before the token itself. */
const ACCESS_SKEW_SECONDS = 60;

/** maxAge for `vs_at` from the token's `expiresAt` (unix seconds). 0 = don't set it. */
export function accessCookieMaxAge(expiresAt: number, nowSeconds = Math.floor(Date.now() / 1000)): number {
  if (!Number.isFinite(expiresAt)) return 0;
  const remaining = Math.floor(expiresAt - nowSeconds - ACCESS_SKEW_SECONDS);
  if (remaining <= 0) return 0;
  return Math.min(remaining, REFRESH_MAX_AGE);
}

export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  secure: boolean;
  maxAge: number;
};

export function sessionCookieOptions(maxAge: number, secure: boolean): SessionCookieOptions {
  return { httpOnly: true, sameSite: "lax", path: "/", secure, maxAge };
}

/** Secure everywhere except local development (browsers allow Secure on localhost too). */
export function shouldUseSecureCookies(): boolean {
  return process.env.NODE_ENV === "production";
}
