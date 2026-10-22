import { JWTPayload } from 'jose';

/** Google's ID-token issuers (both forms appear in the wild). */
export const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

export function parseClientIds(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Pulls the verified email out of an already signature-checked Google ID
 * token payload. Returns null when the token must not be trusted for login
 * (no email, or Google has not verified the address).
 */
export function verifiedGoogleEmail(payload: JWTPayload): string | null {
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  // Google sends a boolean; some libraries historically surfaced "true".
  const verified = payload.email_verified === true || payload.email_verified === 'true';
  if (!email || !verified) return null;
  return email.toLowerCase();
}

/** Escapes LIKE/ILIKE wildcards so an email matches literally ("_" is common). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
