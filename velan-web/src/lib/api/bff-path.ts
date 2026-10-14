/**
 * Validation for the BFF catch-all (`/api/bff/[...path]`). Next has already
 * percent-decoded each segment, so anything that could change the upstream
 * path's meaning (slashes, dots, `%`, `?`, `#`, `:`) is rejected outright.
 */

export type BffPathResult =
  | { ok: true; path: string }
  | { ok: false; status: 400 | 404; reason: string };

const SEGMENT = /^[A-Za-z0-9_~-][A-Za-z0-9._~-]*$/;
const MAX_SEGMENTS = 12;
const MAX_SEGMENT_LENGTH = 200;

/**
 * Endpoints that return or revoke tokens. They have dedicated route handlers that
 * keep tokens in HttpOnly cookies, so the generic proxy must never reach them.
 */
const BLOCKED: readonly (readonly string[])[] = [
  ["auth", "login"],
  ["auth", "refresh"],
  ["auth", "google"],
  ["auth", "logout"],
  ["auth", "invites"],
  ["auth", "password-reset"],
];

export function isBlockedBffPath(segments: readonly string[]): boolean {
  const lower = segments.map((s) => s.toLowerCase());
  return BLOCKED.some((prefix) => prefix.every((part, i) => lower[i] === part));
}

export function validateBffPath(segments: readonly string[] | undefined): BffPathResult {
  if (!segments || segments.length === 0) return { ok: false, status: 404, reason: "empty path" };
  if (segments.length > MAX_SEGMENTS) return { ok: false, status: 400, reason: "path too deep" };

  for (const seg of segments) {
    if (seg.length === 0) return { ok: false, status: 400, reason: "empty segment" };
    if (seg.length > MAX_SEGMENT_LENGTH) return { ok: false, status: 400, reason: "segment too long" };
    if (seg === "." || seg === "..") return { ok: false, status: 400, reason: "dot segment" };
    if (!SEGMENT.test(seg)) return { ok: false, status: 400, reason: "invalid characters" };
  }

  if (isBlockedBffPath(segments)) return { ok: false, status: 404, reason: "blocked endpoint" };

  return { ok: true, path: segments.map(encodeURIComponent).join("/") };
}
