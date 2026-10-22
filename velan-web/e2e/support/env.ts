/**
 * Settings for the e2e suite. Everything comes from the environment so the same
 * suite runs locally and in CI against a seeded staging stack.
 *
 *   E2E_BASE_URL               web app (default http://localhost:3101)
 *   E2E_API_URL                NestJS API incl. prefix (default http://localhost:3018/api/v1)
 *   E2E_PASSWORD               password of the seeded users (default: the seed scripts' default)
 *   SUPABASE_URL               Supabase (auth tokens for API tests, fixture lookup, cleanup)
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *   E2E_ENV_FILE               optional KEY=VALUE file loaded first (e.g. the API's .env)
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function loadEnvFile(file: string | undefined) {
  if (!file || !existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!m || line.trimStart().startsWith("#")) continue;
    const [, key, raw] = m;
    const value = raw.replace(/^(['"])(.*)\1$/, "$2");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvFile(process.env.E2E_ENV_FILE);

export const BASE_URL = (process.env.E2E_BASE_URL ?? "http://localhost:3101").replace(/\/$/, "");
export const API_URL = (process.env.E2E_API_URL ?? "http://localhost:3018/api/v1").replace(/\/$/, "");

/** Same default as velan-backend/scripts/seed.ts and seed-demo.ts (SEED_*_PASSWORD). */
const SEED_DEFAULT_PASSWORD = "ChangeMe123!";
export const PASSWORD = process.env.E2E_PASSWORD ?? SEED_DEFAULT_PASSWORD;

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Export it or point E2E_ENV_FILE at the API env file.`);
  }
  return value;
}

export const supabaseEnv = () => ({
  url: required("SUPABASE_URL").replace(/\/$/, ""),
  anonKey: required("SUPABASE_ANON_KEY"),
  serviceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
});

export type Role = "head" | "manager" | "worker" | "client";
export const ROLES: readonly Role[] = ["head", "manager", "worker", "client"];

/**
 * Seeded accounts. `login` is what the UI login form gets (the worker signs in
 * by username); `email` is the Supabase auth email used for API tokens.
 */
export const USERS: Record<Role, { login: string; email: string }> = {
  head: { login: "head@velanspaces.com", email: "head@velanspaces.com" },
  manager: { login: "manager@velanspaces.com", email: "manager@velanspaces.com" },
  worker: { login: "worker", email: "worker@velanspaces.com" },
  client: { login: "client@velanspaces.com", email: "client@velanspaces.com" },
};

const E2E_DIR = path.resolve(__dirname, "..");
export const AUTH_DIR = path.join(E2E_DIR, ".auth");
export const storageStatePath = (role: Role) => path.join(AUTH_DIR, `${role}.json`);
export const TOKENS_PATH = path.join(AUTH_DIR, "tokens.json");
export const FIXTURES_PATH = path.join(AUTH_DIR, "fixtures.json");

/** Every record the suite creates starts with this, so teardown can sweep leftovers. */
export const E2E_PREFIX = "E2E ";
