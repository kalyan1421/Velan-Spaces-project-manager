import type { NextRequest } from "next/server";
import { z } from "zod";
import { loginRequest } from "@/lib/api/auth";
import { forwardedFor } from "@/lib/api/forwarding";
import { jsonError, readJsonBody, rejectCrossSite } from "@/lib/api/route-helpers";
import { apiUrl, networkError, rawApiFetch } from "@/lib/api/server";
import { completeSignIn } from "@/lib/auth/handlers";

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or username.").max(254, "That email or username is too long."),
  password: z.string().min(1, "Enter your password.").max(128, "That password is too long."),
  next: z.string().max(2048).optional(),
});

/** POST {identifier, password, next?} → sets session cookies → {user, redirectTo}. */
export async function POST(request: NextRequest) {
  const blocked = rejectCrossSite(request);
  if (blocked) return blocked;

  const parsed = await readJsonBody(request, schema);
  if (!parsed.ok) return parsed.response;
  const { identifier, password, next } = parsed.data;

  const body = loginRequest(identifier, password);
  let res: Response;
  try {
    res = await rawApiFetch(apiUrl("auth/login"), {
      method: "POST",
      body: JSON.stringify(body),
      contentType: "application/json",
      forwardedFor: forwardedFor(request.headers),
    });
  } catch (error) {
    const err = networkError(error);
    return jsonError(err.status, err.message);
  }

  return completeSignIn(res, { kind: "password", next, usernameLogin: !("email" in body) });
}
