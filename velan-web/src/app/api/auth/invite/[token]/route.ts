import type { NextRequest } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/errors";
import { forwardedFor } from "@/lib/api/forwarding";
import { json, jsonError, readJsonBody, rejectCrossSite, upstreamMessage } from "@/lib/api/route-helpers";
import { apiUrl, networkError, rawApiFetch } from "@/lib/api/server";
import { completeSignIn } from "@/lib/auth/handlers";
import { PASSWORD_MAX, PASSWORD_MIN, isValidLinkToken, linkProblemFrom } from "@/lib/auth/links";

type Ctx = RouteContext<"/api/auth/invite/[token]">;

const PROBLEM_MESSAGES = {
  invalid: "This invite link is invalid or has already been used.",
  expired: "This invite link has expired.",
  unavailable: "Invites can't be accepted online yet.",
  error: "We couldn't load this invite. Please try again.",
} as const;

function inviteUrl(token: string, suffix = "") {
  return apiUrl(`auth/invites/${encodeURIComponent(token)}${suffix}`);
}

/** GET → invite details `{email, displayName, projectName, expiresAt, accountExists}`. */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  if (!isValidLinkToken(token)) return jsonError(404, PROBLEM_MESSAGES.invalid, { problem: "invalid" });

  let res: Response;
  try {
    res = await rawApiFetch(inviteUrl(token), { forwardedFor: forwardedFor(request.headers) });
  } catch (error) {
    const err = networkError(error);
    return jsonError(err.status, err.message, { problem: "error" });
  }

  const body = await readBody(res);
  if (res.ok) return json(body);
  const problem = linkProblemFrom(res.status, upstreamMessage(body));
  return jsonError(res.status >= 500 ? 502 : res.status, PROBLEM_MESSAGES[problem], { problem });
}

const acceptSchema = z.object({
  password: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
    .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`)
    .optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
});

/**
 * POST {password?, displayName?} → API accept. A new account comes back as a
 * session (cookies set, `{user, redirectTo}`); an existing account as
 * `{accountExists: true, redirectTo: "/login"}`.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  const { token } = await ctx.params;
  if (!isValidLinkToken(token)) return jsonError(404, PROBLEM_MESSAGES.invalid, { problem: "invalid" });

  const parsed = await readJsonBody(request, acceptSchema);
  if (!parsed.ok) return parsed.response;

  let res: Response;
  try {
    res = await rawApiFetch(inviteUrl(token, "/accept"), {
      method: "POST",
      body: JSON.stringify(parsed.data),
      contentType: "application/json",
      forwardedFor: forwardedFor(request.headers),
    });
  } catch (error) {
    const err = networkError(error);
    return jsonError(err.status, err.message);
  }

  if (res.ok) {
    const peek = (await res.clone().json().catch(() => null)) as { accountExists?: unknown } | null;
    if (peek && peek.accountExists === true && !("accessToken" in peek)) {
      return json({ accountExists: true, redirectTo: "/login" });
    }
  }
  return completeSignIn(res, { kind: "invite" });
}
