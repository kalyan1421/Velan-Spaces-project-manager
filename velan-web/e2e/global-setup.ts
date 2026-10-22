/**
 * Global setup:
 *  1. API tokens per role straight from Supabase (cached while > 15 min valid),
 *  2. fixtures: seeded membership discovery + a few E2E records (removed in teardown),
 *  3. one UI login per role at /login, saved as storageState (reused while the
 *     session cookie is > 15 min valid) — the API throttles logins to 8/min/IP.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { apiOk } from "./support/api";
import { deleteLead, deleteProject, sweepE2EData } from "./support/cleanup";
import {
  AUTH_DIR,
  BASE_URL,
  E2E_PREFIX,
  FIXTURES_PATH,
  PASSWORD,
  ROLES,
  TOKENS_PATH,
  USERS,
  storageStatePath,
  type Role,
} from "./support/env";
import type { Fixtures, Tokens } from "./support/fixtures";
import { clientIpFor } from "./support/client-ip";
import { dbSelect, passwordGrant } from "./support/supabase";

const FRESH_FOR_SECONDS = 15 * 60;
const now = () => Math.floor(Date.now() / 1000);

async function ensureTokens(): Promise<Tokens> {
  const cached: Partial<Tokens> = existsSync(TOKENS_PATH) ? JSON.parse(readFileSync(TOKENS_PATH, "utf8")) : {};
  const out = {} as Tokens;
  for (const role of ROLES) {
    const hit = cached[role];
    out[role] = hit && hit.expiresAt - now() > FRESH_FOR_SECONDS ? hit : await passwordGrant(USERS[role].email, PASSWORD);
  }
  writeFileSync(TOKENS_PATH, JSON.stringify(out, null, 2));
  return out;
}

type Member = { project_id: string; user_id: string; member_role: string; has_budget_access: boolean };

async function buildFixtures(t: Tokens): Promise<Fixtures> {
  const userIds = Object.fromEntries(ROLES.map((r) => [r, t[r].userId])) as Record<Role, string>;
  const members = await dbSelect<Member>("project_members", { select: "project_id,user_id,member_role,has_budget_access" });
  const projects = await dbSelect<{ id: string; project_name: string }>("projects", { select: "id,project_name" });
  const real = projects.filter((p) => !p.project_name.startsWith(E2E_PREFIX)).map((p) => p.id);
  const has = (pid: string, role: Role, extra?: (m: Member) => boolean) =>
    members.some((m) => m.project_id === pid && m.user_id === userIds[role] && (!extra || extra(m)));

  const sharedProjectId = real.find(
    (pid) =>
      has(pid, "manager", (m) => m.member_role === "manager" && m.has_budget_access) &&
      has(pid, "worker", (m) => m.member_role === "worker") &&
      has(pid, "client", (m) => m.member_role === "client"),
  );
  if (!sharedProjectId) {
    throw new Error("No seeded project has manager (budget access) + worker + client as members. Run scripts/seed-demo.ts.");
  }
  const foreignProjectId = real.find((pid) => !has(pid, "manager") && !has(pid, "worker") && !has(pid, "client"));
  if (!foreignProjectId) throw new Error("Need a project that manager/worker/client are not members of.");

  const counters = await dbSelect<{ year: number; last_seq: number }>("quote_number_counters");
  const year = new Date().getFullYear();
  const quoteCounter = { year, lastSeq: counters.find((c) => c.year === year)?.last_seq ?? null };

  const head = t.head.accessToken;
  const stamp = Date.now().toString(36).toUpperCase();
  const created: { projectId?: string; leadId?: string } = {};
  try {
    const project = await apiOk<{ id: string; projectCode: string }>(head, "POST", "projects", {
      projectCode: `E2E-NB-${stamp}`,
      projectName: `${E2E_PREFIX}RBAC no-budget ${stamp}`,
      budget: 777777,
      estimatedCost: 555555,
      managerIds: [userIds.manager],
      workerIds: [userIds.worker],
      budgetAccessManagerIds: [],
    });
    created.projectId = project.id;
    const lead = await apiOk<{ id: string }>(head, "POST", "leads", {
      clientName: `${E2E_PREFIX}RBAC lead ${stamp}`,
      projectType: "Residential",
    });
    created.leadId = lead.id;
    const quote = await apiOk<{ id: string }>(head, "POST", "quotes", {
      leadId: lead.id,
      preparedForName: `${E2E_PREFIX}RBAC lead ${stamp}`,
    });
    return {
      userIds,
      sharedProjectId,
      foreignProjectId,
      noBudgetProjectId: project.id,
      noBudgetProjectCode: project.projectCode,
      leadId: lead.id,
      quoteId: quote.id,
      quoteCounter,
    };
  } catch (error) {
    if (created.leadId) await deleteLead(head, created.leadId);
    if (created.projectId) await deleteProject(head, created.projectId);
    throw error;
  }
}

function sessionStillFresh(file: string): boolean {
  if (!existsSync(file)) return false;
  try {
    const state = JSON.parse(readFileSync(file, "utf8")) as { cookies?: { name: string; expires: number }[] };
    const access = state.cookies?.find((c) => c.name === "vs_at");
    return !!access && access.expires - now() > FRESH_FOR_SECONDS;
  } catch {
    return false;
  }
}

async function uiLogin(role: Role) {
  const file = storageStatePath(role);
  if (sessionStillFresh(file)) return;
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      baseURL: BASE_URL,
      extraHTTPHeaders: { "X-Forwarded-For": clientIpFor(`login:${role}`) },
    });
    const page = await context.newPage();
    await page.goto("/login");
    await page.getByLabel("Email or username").fill(USERS[role].login);
    await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    const landing = role === "client" ? /\/portal(\/|$)/ : /\/app\/projects$/;
    await page.waitForURL(landing, { timeout: 30_000 });
    await context.storageState({ path: file });
  } finally {
    await browser.close();
  }
}

export default async function globalSetup() {
  mkdirSync(AUTH_DIR, { recursive: true });
  const t = await ensureTokens();
  // Logins first: nothing after fixture creation can fail, so teardown always gets to clean up.
  for (const role of ROLES) await uiLogin(role);
  // Leftovers from an interrupted run would confuse fixture discovery and the flows.
  await sweepE2EData(t.head.accessToken);
  writeFileSync(FIXTURES_PATH, JSON.stringify(await buildFixtures(t), null, 2));
}
