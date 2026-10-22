/**
 * Shared fixtures: discovered from the seeded data (who is a member of what)
 * plus a few records created by global setup and removed by global teardown.
 * Written to e2e/.auth/fixtures.json so every worker process reads the same ids.
 */
import { existsSync, readFileSync } from "node:fs";
import { FIXTURES_PATH, TOKENS_PATH, type Role } from "./env";

export type Fixtures = {
  userIds: Record<Role, string>;
  /** Seeded project with the manager (budget access), the worker and the client as members. */
  sharedProjectId: string;
  /** A project none of manager/worker/client belongs to. */
  foreignProjectId: string;
  /** Created by setup: manager + worker are members, the manager WITHOUT budget access. */
  noBudgetProjectId: string;
  noBudgetProjectCode: string;
  /** Created by setup (head): a lead and a quote on it. */
  leadId: string;
  quoteId: string;
  /** quote_number_counters.last_seq for the current year before the run (restored by teardown). */
  quoteCounter: { year: number; lastSeq: number | null };
};

export type Tokens = Record<Role, { accessToken: string; expiresAt: number; userId: string }>;

function readJson<T>(file: string, what: string): T {
  if (!existsSync(file)) throw new Error(`${what} missing (${file}): did global setup run?`);
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

export const fixtures = (): Fixtures => readJson<Fixtures>(FIXTURES_PATH, "fixtures.json");
export const tokens = (): Tokens => readJson<Tokens>(TOKENS_PATH, "tokens.json");
export const bearer = (role: Role) => ({ Authorization: `Bearer ${tokens()[role].accessToken}` });
