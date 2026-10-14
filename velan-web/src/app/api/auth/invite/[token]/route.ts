import type { NextRequest } from "next/server";
import { z } from "zod";
import { NAME_MAX, accountLinkOutcome, isLinkToken, passwordSchema } from "@/lib/api/accounts";
import { readBody } from "@/lib/api/errors";
import { forwardedFor } from "@/lib/api/forwarding";
import { jsonError, readJsonBody, rejectCrossSite, upstreamMessage } from "@/lib/api/route-helpers";
import { apiUrl, networkError, rawApiFetch } from "@/lib/api/server";
import { completeSignIn } from "@/lib/auth/handlers";

type Ctx = RouteContext<"/api/auth/invite/[token]">;

/**
 * Error copy for the accept form. `error` carries the state so the browser can switch
 * to the right screen (it becomes `ApiError.code`). Tokens are never echoed or logged.
 */
const PROBLEMS = {
  invalid: { status: 404, message: "This invite link isn't valid. Ask us to send a new one." },
  expired: { status: 410, message: "This invite link has expired. Ask us to send a new one." },
  used: { status: 410, message: "This invite link has already been used." },
  "account-exists": { status: 409, message: "You already have an account — sign in." },
  "rate-limited": { status: 429, message: "Too many attempts. Please wait a minute and try again." },
  error: { status: 502, message: "We couldn't create your account. Please try again in a moment." },
} as const;

const acceptSchema = z.object({
  password: passwordSchema,
  displayName: z.string().trim().min(1, "Enter your name.").max(NAME_MAX, "That name is too long.").optional(),
});

/**
 * POST {password, displayName?} → `POST /auth/invites/:token/accept`.
 * 200 → session cookies set (same as login) and `{user, redirectTo: "/portal"}`.
 * 404 invalid · 410 used/expired · 409 the email already has an account.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  const { token } = await ctx.params;
  if (!isLinkToken(token)) return jsonError(PROBLEMS.invalid.status, PROBLEMS.invalid.message, { error: "invalid" });

  const parsed = await readJsonBody(request, acceptSchema);
  if (!parsed.ok) return parsed.response;

  let res: Response;
  try {
    res = await rawApiFetch(apiUrl(`auth/invites/${token}/accept`), {
      method: "POST",
      body: JSON.stringify(parsed.data),
      contentType: "application/json",
      forwardedFor: forwardedFor(request.headers),
    });
  } catch (error) {
    const err = networkError(error);
    return jsonError(err.status, err.message, { error: "error" });
  }

  if (res.ok) return completeSignIn(res, { kind: "invite", next: "/portal" });

  const message = upstreamMessage(await readBody(res));
  const outcome = accountLinkOutcome(res.status, message);
  if (outcome === "validation") {
    // class-validator messages are about the password/name the person typed.
    return jsonError(400, message ?? "Please check the details and try again.", { error: "validation" });
  }
  const problem = outcome === "ok" ? PROBLEMS.error : PROBLEMS[outcome];
  return jsonError(problem.status, problem.message, { error: outcome === "ok" ? "error" : outcome });
}
