/**
 * `next` / return-URL handling. Only same-origin, rooted paths are allowed so a
 * crafted link can never bounce a user to another site after login (open redirect).
 */

/**
 * Request header the interceptor (src/proxy.ts) sets to the current path + query,
 * so Server Components can build `?next=` return URLs. Always overwritten there.
 */
export const PATHNAME_HEADER = "x-vs-pathname";

const MAX_NEXT_LENGTH = 2048;
// Paths we never send people "back" to: auth screens and API routes.
const BLOCKED_PREFIXES = ["/login", "/invite", "/reset-password", "/api"];

export function safeNextPath(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  if (raw.length === 0 || raw.length > MAX_NEXT_LENGTH) return null;

  // Must be rooted, and not "//host" or "/\host" (browsers treat both as protocol-relative).
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return null;

  // Control characters and whitespace can be stripped by browsers into "//host".
  if (/[\u0000-\u001F\u007F\s\\]/.test(raw)) return null;

  // Encoded slashes/backslashes can be decoded by an intermediary into the same trick.
  if (/%(2f|5c)/i.test(raw)) return null;

  // Parse against a dummy origin: anything that escapes it is not a relative path.
  let url: URL;
  try {
    url = new URL(raw, "http://n.invalid");
  } catch {
    return null;
  }
  if (url.origin !== "http://n.invalid") return null;

  const pathname = url.pathname;
  if (BLOCKED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return `${pathname}${url.search}${url.hash}`;
}

/** `/login?next=…&reason=…`, dropping an unsafe `next`. */
export function loginUrl(next: unknown, reason?: string): string {
  const params = new URLSearchParams();
  const safe = safeNextPath(next);
  if (safe) params.set("next", safe);
  if (reason) params.set("reason", reason);
  const qs = params.toString();
  return qs ? `/login?${qs}` : "/login";
}

/** `/api/auth/refresh?next=…` — the route handler that can rotate cookies. */
export function refreshUrl(next: unknown): string {
  const safe = safeNextPath(next);
  return safe ? `/api/auth/refresh?next=${encodeURIComponent(safe)}` : "/api/auth/refresh";
}
