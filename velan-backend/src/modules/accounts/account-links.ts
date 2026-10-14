import { createHash, randomBytes } from 'crypto';

/**
 * One-time account links (client invites, admin-issued password resets).
 * The raw token only ever lives in the link; the database keeps its SHA-256.
 */
export type LinkKind = 'client_invite' | 'password_reset';

export const LINK_TTL_MS: Record<LinkKind, number> = {
  client_invite: 7 * 24 * 60 * 60 * 1000,
  password_reset: 24 * 60 * 60 * 1000,
};

/** 32 random bytes, URL-safe. */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Cheap shape check before touching the database. */
export function looksLikeToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export type LinkStatus = 'valid' | 'used' | 'expired';

export function linkStatus(
  row: { used_at: string | null; expires_at: string },
  now: Date = new Date(),
): LinkStatus {
  if (row.used_at) return 'used';
  if (new Date(row.expires_at).getTime() <= now.getTime()) return 'expired';
  return 'valid';
}

/** Path on the web app where each link kind is opened. */
export function linkUrl(appPublicUrl: string, kind: LinkKind, token: string): string {
  const base = appPublicUrl.replace(/\/+$/, '');
  return kind === 'client_invite' ? `${base}/invite/${token}` : `${base}/reset-password/${token}`;
}

/** Usernames: lower-case, 3–32 chars, start with a letter/digit. Same rule as the DB check. */
export const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizeUsername(raw: string): string | null {
  const u = raw.trim().toLowerCase();
  return USERNAME_RE.test(u) ? u : null;
}

/** Workers have no mailbox; their auth account gets a non-deliverable address. */
export function workerAuthEmail(username: string, domain: string): string {
  return `${username}@${domain}`;
}
