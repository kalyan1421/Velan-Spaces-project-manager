/**
 * Direct Supabase access for the suite (never used by the app under test):
 *  - password-grant tokens for API-level RBAC checks (avoids the API's 8/min login throttle)
 *  - service-role PostgREST reads for fixture discovery, DB-level assertions and cleanup
 */
import { supabaseEnv } from "./env";

export type Session = { accessToken: string; expiresAt: number; userId: string };

export async function passwordGrant(email: string, password: string): Promise<Session> {
  const { url, anonKey } = supabaseEnv();
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_at?: number;
    user?: { id?: string };
    error_description?: string;
    msg?: string;
  };
  if (!res.ok || !body.access_token || !body.user?.id) {
    // Never echo the password; the status + message is enough to debug.
    throw new Error(`Supabase sign-in for ${email} failed: ${res.status} ${body.error_description ?? body.msg ?? ""}`);
  }
  return { accessToken: body.access_token, expiresAt: body.expires_at ?? 0, userId: body.user.id };
}

type Query = Record<string, string>;

async function rest(method: string, table: string, query: Query = {}, body?: unknown, prefer?: string) {
  const { url, serviceKey } = supabaseEnv();
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(`${url}/rest/v1/${table}${qs ? `?${qs}` : ""}`, {
    method,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PostgREST ${method} ${table} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? (JSON.parse(text) as unknown) : null;
}

/** `select` rows (PostgREST filter syntax, e.g. `{ id: "eq.<uuid>" }`). */
export async function dbSelect<T = Record<string, unknown>>(table: string, query: Query = {}): Promise<T[]> {
  return ((await rest("GET", table, { select: "*", ...query })) as T[]) ?? [];
}

export async function dbInsert<T = Record<string, unknown>>(table: string, row: object): Promise<T[]> {
  return ((await rest("POST", table, {}, row, "return=representation")) as T[]) ?? [];
}

export async function dbUpdate<T = Record<string, unknown>>(table: string, filter: Query, patch: object): Promise<T[]> {
  return ((await rest("PATCH", table, filter, patch, "return=representation")) as T[]) ?? [];
}

/** Deletes matching rows; refuses an unfiltered delete. */
export async function dbDelete<T = Record<string, unknown>>(table: string, filter: Query): Promise<T[]> {
  if (Object.keys(filter).length === 0) throw new Error("dbDelete needs a filter");
  return ((await rest("DELETE", table, filter, undefined, "return=representation")) as T[]) ?? [];
}

/** Best-effort removal of storage objects (cleanup only). */
export async function storageRemove(bucket: string, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { url, serviceKey } = supabaseEnv();
  await fetch(`${url}/storage/v1/object/${bucket}`, {
    method: "DELETE",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "content-type": "application/json" },
    body: JSON.stringify({ prefixes: paths }),
  }).catch(() => undefined);
}
