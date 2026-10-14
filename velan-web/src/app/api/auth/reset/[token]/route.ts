import type { NextRequest } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/errors";
import { forwardedFor } from "@/lib/api/forwarding";
import { json, jsonError, readJsonBody, rejectCrossSite, upstreamMessage } from "@/lib/api/route-helpers";
import { apiUrl, networkError, rawApiFetch } from "@/lib/api/server";
import { PASSWORD_MAX, PASSWORD_MIN, isValidLinkToken, linkProblemFrom } from "@/lib/auth/links";

type Ctx = RouteContext<"/api/auth/reset/[token]">;

const schema = z.object({
  newPassword: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
    .max(PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`),
});

const INVALID = "This reset link is invalid or has expired. Ask your administrator for a new one.";

/** POST {newPassword} → API `/auth/password-reset/:token` → {ok: true}. */
export async function POST(request: NextRequest, ctx: Ctx) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  const { token } = await ctx.params;
  if (!isValidLinkToken(token)) return jsonError(404, INVALID, { problem: "invalid" });

  const parsed = await readJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;

  let res: Response;
  try {
    res = await rawApiFetch(apiUrl(`auth/password-reset/${encodeURIComponent(token)}`), {
      method: "POST",
      body: JSON.stringify({ newPassword: parsed.data.newPassword }),
      contentType: "application/json",
      forwardedFor: forwardedFor(request.headers),
    });
  } catch (error) {
    const err = networkError(error);
    return jsonError(err.status, err.message);
  }

  if (res.ok) return json({ ok: true });

  const body = await readBody(res);
  const message = upstreamMessage(body);
  if (res.status === 429) return jsonError(429, "Too many attempts. Please wait a minute and try again.");
  // A 400 with a validation message is about the password itself; show it.
  if (res.status === 400 && message && !/token/i.test(message)) return jsonError(400, message);

  const problem = linkProblemFrom(res.status, message);
  if (problem === "unavailable") {
    return jsonError(503, "Password reset isn't available online yet. Ask your administrator.", { problem });
  }
  if (problem === "error") return jsonError(502, "We couldn't reset your password. Please try again.", { problem });
  return jsonError(res.status === 410 ? 410 : 400, INVALID, { problem });
}
