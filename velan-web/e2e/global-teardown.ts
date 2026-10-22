/**
 * Global teardown: remove the setup fixtures, sweep anything E2E-prefixed a
 * failed test left behind, and put the quote number counter back.
 * Runs after every test (pass or fail); each step is best-effort.
 */
import { existsSync, readFileSync } from "node:fs";
import { deleteLead, deleteProject, restoreQuoteCounter, sweepE2EData } from "./support/cleanup";
import { FIXTURES_PATH, PASSWORD, USERS } from "./support/env";
import { tokens, type Fixtures } from "./support/fixtures";
import { passwordGrant } from "./support/supabase";

async function headToken(): Promise<string> {
  try {
    const t = tokens().head;
    if (t.expiresAt - Date.now() / 1000 > 120) return t.accessToken;
  } catch {
    /* no cached tokens */
  }
  return (await passwordGrant(USERS.head.email, PASSWORD)).accessToken;
}

export default async function globalTeardown() {
  const head = await headToken();
  const f: Fixtures | null = existsSync(FIXTURES_PATH) ? JSON.parse(readFileSync(FIXTURES_PATH, "utf8")) : null;
  if (f) {
    await deleteLead(head, f.leadId); // cascades its quote
    await deleteProject(head, f.noBudgetProjectId);
  }
  await sweepE2EData(head);
  if (f) await restoreQuoteCounter(f.quoteCounter.year, f.quoteCounter.lastSeq);
}
