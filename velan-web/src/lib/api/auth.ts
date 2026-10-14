import { isRole } from "@/lib/auth/roles";
import type { LoginBody, Session, TokenSet } from "./types";

/**
 * Login adapter (WEB_APP_PLAN §4). The API currently accepts `{email, password}`;
 * `{identifier, password}` (email or username) is the proposed contract.
 * Everything that builds a login body goes through here, so switching is one edit.
 */
export function loginRequest(identifier: string, password: string): LoginBody {
  const id = identifier.trim();
  if (id.includes("@")) return { email: id.toLowerCase(), password };
  return { identifier: id, password };
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

export function isTokenSet(value: unknown): value is TokenSet {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    isNonEmptyString(v.accessToken) &&
    isNonEmptyString(v.refreshToken) &&
    typeof v.expiresAt === "number" &&
    Number.isFinite(v.expiresAt)
  );
}

export function isSessionPayload(value: unknown): value is Session {
  if (!isTokenSet(value)) return false;
  const user = (value as unknown as Record<string, unknown>).user;
  if (!user || typeof user !== "object") return false;
  const u = user as Record<string, unknown>;
  return isNonEmptyString(u.id) && isRole(u.role);
}

const TOKEN_KEYS = ["accessToken", "refreshToken", "expiresAt"] as const;

/**
 * Removes token fields from a JSON body before it reaches the browser.
 * Returns the token set when the body carried a complete one, so callers can
 * move it into HttpOnly cookies instead.
 */
export function splitSessionPayload(body: unknown): { tokens: TokenSet | null; rest: unknown } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { tokens: null, rest: body };
  const tokens = isTokenSet(body)
    ? {
        accessToken: (body as TokenSet).accessToken,
        refreshToken: (body as TokenSet).refreshToken,
        expiresAt: (body as TokenSet).expiresAt,
      }
    : null;
  const rest: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  for (const key of TOKEN_KEYS) delete rest[key];
  return { tokens, rest };
}
