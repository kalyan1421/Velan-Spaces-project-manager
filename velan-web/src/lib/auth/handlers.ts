import "server-only";

import { isSessionPayload } from "@/lib/api/auth";
import { readBody } from "@/lib/api/errors";
import { json, jsonError, upstreamMessage } from "@/lib/api/route-helpers";
import { setSessionCookies } from "@/lib/api/session";
import type { User } from "@/lib/api/types";
import { postLoginRedirect } from "./roles";

export const SUSPENDED_MESSAGE = "Your account is suspended. Please contact the administrator.";
const RATE_LIMITED = "Too many sign-in attempts. Please wait a minute and try again.";
const UNAVAILABLE = "We couldn't sign you in right now. Please try again in a moment.";

export type SignInKind = "password" | "google" | "invite";

/** The user fields the browser may see after sign-in (never tokens). */
function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    username: user.username ?? null,
    role: user.role,
    displayName: user.displayName,
  };
}

function isMissingRoute(message: string | null): boolean {
  return !!message && /^Cannot (GET|POST|PUT|PATCH|DELETE) /.test(message);
}

/**
 * Turns an API sign-in response (login / google / invite accept) into the
 * browser response: cookies + `{ user, redirectTo }` on success, a friendly
 * message otherwise. Upstream wording for 401s is replaced so we never reveal
 * whether an account exists.
 */
export async function completeSignIn(
  res: Response,
  options: { kind: SignInKind; next?: unknown; usernameLogin?: boolean },
): Promise<Response> {
  const body = await readBody(res);

  if (res.ok) {
    if (!isSessionPayload(body)) return jsonError(502, UNAVAILABLE);
    if (body.user.isSuspended) return jsonError(403, SUSPENDED_MESSAGE);
    await setSessionCookies(body);
    return json({ user: publicUser(body.user), redirectTo: postLoginRedirect(body.user.role, options.next) });
  }

  const message = upstreamMessage(body);
  switch (res.status) {
    case 400:
    case 401:
      if (options.kind === "google") {
        return jsonError(401, "This Google account isn't linked to Velan Spaces. Sign in with your email or username.");
      }
      if (res.status === 400 && options.usernameLogin) {
        // The API may not accept usernames yet (📝 `identifier` login is proposed).
        return jsonError(400, "Username sign-in isn't available yet. Please use your email address.");
      }
      if (options.kind === "invite" && res.status === 400) {
        return jsonError(400, message ?? "Please check the details and try again.");
      }
      return jsonError(401, "Incorrect email/username or password.");
    case 403:
      return jsonError(403, message ?? SUSPENDED_MESSAGE);
    case 404:
    case 501:
      if (isMissingRoute(message) || res.status === 501) {
        return jsonError(503, options.kind === "google" ? "Google sign-in isn't available yet." : UNAVAILABLE);
      }
      return jsonError(404, options.kind === "invite" ? "This invite link is invalid or has expired." : UNAVAILABLE);
    case 410:
      return jsonError(410, "This invite link has expired. Ask us for a new one.");
    case 429:
      return jsonError(429, RATE_LIMITED);
    default:
      return jsonError(502, UNAVAILABLE);
  }
}
