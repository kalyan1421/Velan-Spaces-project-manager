import type { NextRequest } from "next/server";
import { z } from "zod";
import { accountLinkOutcome, isLinkToken, passwordSchema } from "@/lib/api/accounts";
import { readBody } from "@/lib/api/errors";
import { forwardedFor } from "@/lib/api/forwarding";
import { json, jsonError, readJsonBody, rejectCrossSite, upstreamMessage } from "@/lib/api/route-helpers";
import { apiUrl, networkError, rawApiFetch } from "@/lib/api/server";

type Ctx = RouteContext<"/api/auth/reset/[token]">;

const schema = z.object({ newPassword: passwordSchema });

/** `error` carries the state so the form can switch screens (it becomes `ApiError.code`). */
const PROBLEMS = {
  invalid: { status: 404, message: "This reset link isn't valid. Ask your administrator for a new one." },
  expired: { status: 410, message: "This reset link has expired. Ask your administrator for a new one." },
  used: { status: 410, message: "This reset link has already been used. Ask your administrator for a new one." },
  "rate-limited": { status: 429, message: "Too many attempts. Please wait a minute and try again." },
  error: { status: 502, message: "We couldn't reset your password. Please try again in a moment." },
} as const;

/** POST {newPassword} → `POST /auth/password-reset/:token` → `{reset: true}`. Single use. */
export async function POST(request: NextRequest, ctx: Ctx) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  const { token } = await ctx.params;
  if (!isLinkToken(token)) return jsonError(PROBLEMS.invalid.status, PROBLEMS.invalid.message, { error: "invalid" });

  const parsed = await readJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;

  let res: Response;
  try {
    res = await rawApiFetch(apiUrl(`auth/password-reset/${token}`), {
      method: "POST",
      body: JSON.stringify({ newPassword: parsed.data.newPassword }),
      contentType: "application/json",
      forwardedFor: forwardedFor(request.headers),
    });
  } catch (error) {
    const err = networkError(error);
    return jsonError(err.status, err.message, { error: "error" });
  }

  if (res.ok) return json({ reset: true });

  const message = upstreamMessage(await readBody(res));
  const outcome = accountLinkOutcome(res.status, message);
  if (outcome === "validation") {
    return jsonError(400, message ?? "Please choose a different password.", { error: "validation" });
  }
  const problem =
    outcome === "invalid" || outcome === "expired" || outcome === "used" || outcome === "rate-limited"
      ? PROBLEMS[outcome]
      : PROBLEMS.error;
  return jsonError(problem.status, problem.message, { error: problem === PROBLEMS.error ? "error" : outcome });
}
