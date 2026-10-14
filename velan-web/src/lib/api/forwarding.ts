/**
 * Client IP forwarding to the API so its rate limits apply per end user, not per
 * web container. Used by the BFF, the auth route handlers and server-side
 * `apiFetch` (SSR) alike.
 *
 * Deployment contract (deploy/DEPLOYMENT.md §7):
 *   client → reverse proxy (REQUIRED; it OVERWRITES X-Forwarded-For with the single
 *   client IP) → this web app (passes the incoming value through unchanged and never
 *   appends to it) → API running with TRUST_PROXY_HOPS=1.
 *
 * TRUST_PROXY_HOPS must stay 1 on the API: a higher value would let a spoofed
 * X-Forwarded-For entry be trusted and bypass login rate limits.
 */

const MAX_LENGTH = 512;
const IP_LIST = /^[0-9A-Fa-f.:, ]+$/;

/** The incoming X-Forwarded-For (or X-Real-IP) value, unchanged, if it looks like an IP list. */
export function forwardedFor(headers: Headers): string | null {
  const candidates = [headers.get("x-forwarded-for"), headers.get("x-real-ip")];
  for (const raw of candidates) {
    if (!raw) continue;
    const value = raw.trim();
    if (value.length === 0 || value.length > MAX_LENGTH) return null;
    if (!IP_LIST.test(value)) return null;
    return value;
  }
  return null;
}
