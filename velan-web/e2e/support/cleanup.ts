/**
 * Cleanup shared by flow `afterAll` hooks and global teardown. Uses the API (as
 * head) where it can, so deletes cascade exactly as in production, and the
 * service role only for what the API can't do (notifications, the quote counter).
 * Every step is best-effort: one failure must not stop the rest.
 */
import { apiCall } from "./api";
import { E2E_PREFIX } from "./env";
import { dbDelete, dbSelect, dbUpdate } from "./supabase";

// PostgREST `like`: `*` is `%`; SQL `_` matches the space in "E2E " without URL-encoding trouble.
const like = `like.${E2E_PREFIX.trim()}_*`;

async function quietly(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    console.warn(`[e2e cleanup] ${label}: ${(error as Error).message}`);
  }
}

export async function deleteProject(headToken: string, id: string) {
  await quietly(`project ${id}`, async () => {
    const res = await apiCall(headToken, "DELETE", `projects/${id}`);
    if (res.status >= 300 && res.status !== 404) throw new Error(`DELETE → ${res.status}`);
  });
}

export async function deleteLead(headToken: string, id: string) {
  await quietly(`lead ${id}`, async () => {
    const res = await apiCall(headToken, "DELETE", `leads/${id}`);
    if (res.status >= 300 && res.status !== 404) throw new Error(`DELETE → ${res.status}`);
  });
}

/** Notifications about an entity (design/lead) — e.g. approval requests and decisions. */
export async function deleteNotificationsFor(entityId: string) {
  await quietly(`notifications for ${entityId}`, () => dbDelete("notifications", { entity_id: `eq.${entityId}` }));
}

/**
 * Removes anything the suite created that is still around (a crashed run, a
 * failed afterAll): projects (cascades their designs/files/notifications),
 * leads (cascades quotes + lead notifications), stray designs/files.
 */
export async function sweepE2EData(headToken: string) {
  await quietly("sweep projects", async () => {
    const byName = await dbSelect<{ id: string }>("projects", { select: "id", project_name: like });
    const byCode = await dbSelect<{ id: string }>("projects", { select: "id", project_code: "like.E2E-*" });
    for (const id of new Set([...byName, ...byCode].map((p) => p.id))) await deleteProject(headToken, id);
  });
  await quietly("sweep leads", async () => {
    const leads = await dbSelect<{ id: string }>("leads", { select: "id", client_name: like });
    for (const { id } of leads) await deleteLead(headToken, id);
  });
  await quietly("sweep designs", async () => {
    const designs = await dbSelect<{ id: string; project_id: string }>("designs", { select: "id,project_id", title: like });
    for (const d of designs) {
      await apiCall(headToken, "DELETE", `projects/${d.project_id}/designs/${d.id}`);
      await deleteNotificationsFor(d.id);
    }
  });
  await quietly("sweep files", async () => {
    const files = await dbSelect<{ id: string; project_id: string }>("files", { select: "id,project_id", title: like });
    for (const f of files) await apiCall(headToken, "DELETE", `projects/${f.project_id}/files/${f.id}`);
  });
  await quietly("sweep updates", async () => {
    const updates = await dbSelect<{ id: string; project_id: string }>("project_updates", { select: "id,project_id", content: like });
    for (const u of updates) await apiCall(headToken, "DELETE", `projects/${u.project_id}/updates/${u.id}`);
  });
  await quietly("sweep notifications", () => dbDelete("notifications", { body: "like.*E2E*" }));
}

/**
 * Creating a quote bumps the per-year quote number counter. Put it back to where
 * it was before the run, but never below a number still in use.
 */
export async function restoreQuoteCounter(year: number, lastSeqBefore: number | null) {
  if (lastSeqBefore === null) return;
  await quietly("quote counter", async () => {
    const quotes = await dbSelect<{ quote_number: string | null }>("quotes", {
      select: "quote_number",
      quote_number: `like.*${year}-*`,
    });
    const inUse = quotes
      .map((q) => /(\d+)$/.exec(q.quote_number ?? "")?.[1])
      .filter((n): n is string => !!n)
      .map(Number);
    const target = Math.max(lastSeqBefore, ...inUse);
    await dbUpdate("quote_number_counters", { year: `eq.${year}`, last_seq: `gt.${target}` }, { last_seq: target });
  });
}
