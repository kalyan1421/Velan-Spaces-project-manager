import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { isApiError } from "@/lib/api/errors";
import { apiFetch, redirectToLogin, redirectToRefresh } from "@/lib/api/server";
import { readSessionTokens } from "@/lib/api/session";
import type { Role, User } from "@/lib/api/types";
import { isRole, landingFor } from "./roles";

export { landingFor };

export type SessionState =
  | { status: "signed-in"; user: User }
  | { status: "signed-out" }
  | { status: "suspended" };

/**
 * The current user via `GET /auth/me`, memoised per request.
 * May redirect through `/api/auth/refresh` when the access token is missing
 * or rejected but a refresh token exists (Server Components can't set cookies).
 */
export const getSessionState = cache(async (): Promise<SessionState> => {
  const { accessToken, refreshToken } = await readSessionTokens();
  if (!accessToken && !refreshToken) return { status: "signed-out" };
  if (!accessToken) await redirectToRefresh();

  try {
    const user = await apiFetch<User>("auth/me");
    if (!user || !isRole(user.role)) return { status: "signed-out" };
    if (user.isSuspended) return { status: "suspended" };
    return { status: "signed-in", user };
  } catch (error) {
    if (isApiError(error) && error.status === 403) return { status: "suspended" };
    throw error;
  }
});

export async function getSession(): Promise<User | null> {
  const state = await getSessionState();
  return state.status === "signed-in" ? state.user : null;
}

/**
 * Gate for layouts/pages: signed-out → `/login?next=<current path>`,
 * wrong role → that role's landing page. Returns the user otherwise.
 */
export async function requireRole(roles: readonly Role[]): Promise<User> {
  const state = await getSessionState();
  if (state.status === "suspended") await redirectToLogin("suspended");
  if (state.status !== "signed-in") await redirectToLogin();
  const user = (state as { status: "signed-in"; user: User }).user;
  if (!roles.includes(user.role)) redirect(landingFor(user.role));
  return user;
}
