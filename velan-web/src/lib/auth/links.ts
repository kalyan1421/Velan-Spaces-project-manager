/**
 * Invite / password-reset link helpers (pure). The token format is decided by the
 * API (📝 proposed contract), so validation here is deliberately permissive: it only
 * keeps garbage and path tricks out of the upstream URL.
 */

const TOKEN = /^[A-Za-z0-9_-][A-Za-z0-9._~-]{7,511}$/;

export function isValidLinkToken(token: unknown): token is string {
  return typeof token === "string" && TOKEN.test(token);
}

export type LinkProblem = "invalid" | "expired" | "unavailable" | "error";

/**
 * Classifies a failed invite/reset call. A Nest "Cannot GET …" 404 or a 501 means
 * the endpoint itself isn't deployed yet, which deserves a different message than
 * a bad token.
 */
export function linkProblemFrom(status: number, message: string | null): LinkProblem {
  if (status === 501) return "unavailable";
  if (status === 404) return message && /^Cannot (GET|POST|PUT|PATCH|DELETE) /.test(message) ? "unavailable" : "invalid";
  if (status === 410) return "expired";
  if (status === 400 || status === 422) return "invalid";
  return "error";
}

export function isExpired(expiresAt: string | null | undefined, now: Date): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  return Number.isFinite(t) && t <= now.getTime();
}

export const SUPPORT_EMAIL = "support@velanspaces.com";

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
