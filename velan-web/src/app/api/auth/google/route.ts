import type { NextRequest } from "next/server";
import { z } from "zod";
import { forwardedFor } from "@/lib/api/forwarding";
import { jsonError, readJsonBody, rejectCrossSite } from "@/lib/api/route-helpers";
import { apiUrl, networkError, rawApiFetch } from "@/lib/api/server";
import { completeSignIn } from "@/lib/auth/handlers";

const schema = z.object({
  idToken: z.string().min(20, "Google sign-in failed. Please try again.").max(8192),
  next: z.string().max(2048).optional(),
});

/** POST {idToken, next?} → API `/auth/google` (existing accounts only) → cookies → {user, redirectTo}. */
export async function POST(request: NextRequest) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  const parsed = await readJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;

  let res: Response;
  try {
    res = await rawApiFetch(apiUrl("auth/google"), {
      method: "POST",
      body: JSON.stringify({ idToken: parsed.data.idToken }),
      contentType: "application/json",
      forwardedFor: forwardedFor(request.headers),
    });
  } catch (error) {
    const err = networkError(error);
    return jsonError(err.status, err.message);
  }

  return completeSignIn(res, { kind: "google", next: parsed.data.next });
}
