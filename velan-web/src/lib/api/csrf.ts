/**
 * CSRF defence for cookie-authenticated, state-changing route handlers.
 * SameSite=Lax already blocks most cross-site POSTs; this check closes the rest
 * (same-site subdomains, older browsers) by requiring the request to come from
 * the app's own host. Pure so it can be unit tested.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

function hostOf(value: string | null | undefined): string | null {
  if (!value || value === "null") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True when `Origin` (or, if absent, `Referer`) names the same host as `appUrl`.
 * The scheme is not compared: behind a TLS-terminating proxy the app may be
 * configured with http:// while browsers send https:// origins.
 */
export function isSameOriginRequest(
  headers: { origin?: string | null; referer?: string | null },
  appUrl: string,
): boolean {
  const expected = hostOf(appUrl);
  if (!expected) return false;

  if (headers.origin != null) return hostOf(headers.origin) === expected;
  return hostOf(headers.referer) === expected;
}
