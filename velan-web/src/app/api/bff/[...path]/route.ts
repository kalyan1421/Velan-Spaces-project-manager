import type { NextRequest } from "next/server";
import { proxyToApi } from "@/lib/api/bff";

/**
 * BFF proxy: `/api/bff/<path>` → `${API_URL}/<path>` with the session's bearer
 * token from HttpOnly cookies. See src/lib/api/bff.ts and WEB_APP_PLAN §2.
 */
type Ctx = RouteContext<"/api/bff/[...path]">;

async function handle(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return proxyToApi(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
