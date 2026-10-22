/**
 * R-G1 (API half): the API must refuse what the UI hides. Tokens come straight
 * from Supabase (global setup); requests go to the API with Playwright's `request`.
 * Expected statuses follow the controllers' @Roles and ProjectAccessService.
 */
import type { APIRequestContext, APIResponse } from "@playwright/test";
import { API_URL, E2E_PREFIX, ROLES, type Role } from "./support/env";
import { deleteNotificationsFor } from "./support/cleanup";
import { bearer, fixtures } from "./support/fixtures";
import { dbDelete, dbInsert, dbSelect, storageRemove } from "./support/supabase";
import { expect, test } from "./support/test";

const f = fixtures();
const S = f.sharedProjectId; // manager (budget) + worker + client
const NB = f.noBudgetProjectId; // manager WITHOUT budget access + worker
const X = f.foreignProjectId; // none of manager/worker/client
const stamp = Date.now().toString(36);
const NO_SUCH_USER = "00000000-0000-4000-8000-00000000e2e0";

function call(request: APIRequestContext, role: Role, method: string, path: string, data?: unknown): Promise<APIResponse> {
  return request.fetch(`${API_URL}/${path}`, { method, headers: bearer(role), data, failOnStatusCode: false });
}

type Row = { label: string; method?: string; path: string; body?: unknown; expect: Partial<Record<Role, number>> };

/** One test per row; every role listed must get exactly that status. */
function matrix(title: string, rows: Row[]) {
  test.describe(title, () => {
    for (const row of rows) {
      test(row.label, async ({ request }) => {
        for (const role of ROLES) {
          const want = row.expect[role];
          if (want === undefined) continue;
          const res = await call(request, role, row.method ?? "GET", row.path, row.body);
          expect.soft(res.status(), `${role} ${row.method ?? "GET"} /${row.path}`).toBe(want);
        }
      });
    }
  });
}

const ALL_403_BUT = (allowed: Partial<Record<Role, number>>): Partial<Record<Role, number>> => ({
  head: 403,
  manager: 403,
  worker: 403,
  client: 403,
  ...allowed,
});

const anExpense = { type: "debit", amount: 1, date: "2026-01-01", category: "material" };

matrix("budget & settlements", [
  { label: "summary on the shared project", path: `projects/${S}/budget/summary`, expect: ALL_403_BUT({ head: 200, manager: 200 }) },
  { label: "expenses on the shared project", path: `projects/${S}/expenses`, expect: ALL_403_BUT({ head: 200, manager: 200 }) },
  { label: "settlements on the shared project", path: `projects/${S}/settlements`, expect: ALL_403_BUT({ head: 200, manager: 200 }) },
  { label: "summary without budget access", path: `projects/${NB}/budget/summary`, expect: { head: 200, manager: 403, worker: 403 } },
  { label: "settlements without budget access", path: `projects/${NB}/settlements`, expect: { head: 200, manager: 403 } },
  // Writes are refused before validation, so nothing is ever created here.
  { label: "worker/client cannot record expenses", method: "POST", path: `projects/${S}/expenses`, body: anExpense, expect: { worker: 403, client: 403 } },
  { label: "manager without access cannot record expenses", method: "POST", path: `projects/${NB}/expenses`, body: anExpense, expect: { manager: 403 } },
  { label: "worker/client cannot record settlements", method: "POST", path: `projects/${S}/settlements`, body: { amount: 1 }, expect: { worker: 403, client: 403 } },
]);

// NEEDS RE-RUN AFTER THE PORTAL CHANGE: GET /projects/:id/client-payments (2026-10-22).
matrix("client payments (portal money view)", [
  { label: "on the shared project", path: `projects/${S}/client-payments`, expect: { head: 200, manager: 200, worker: 403, client: 200 } },
  { label: "manager without budget access", path: `projects/${NB}/client-payments`, expect: { head: 200, manager: 403 } },
  { label: "a project the client isn't on", path: `projects/${X}/client-payments`, expect: { client: 403 } },
]);

test("client payments carry only budget / received / balance", async ({ request }) => {
  const res = await call(request, "client", "GET", `projects/${S}/client-payments`);
  expect(res.status()).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;
  expect(Object.keys(body).sort()).toEqual(["balance", "budget", "payments", "received", "receivedPercent"]);
  for (const p of body.payments as Record<string, unknown>[]) {
    expect(Object.keys(p).sort()).toEqual(["amount", "date", "id", "paymentMethod"]);
  }
});

matrix("projects", [
  { label: "a project the user is not on", path: `projects/${X}`, expect: { head: 200, manager: 403, worker: 403, client: 403 } },
  { label: "create", method: "POST", path: "projects", body: { projectCode: `E2E-DENY-${stamp}`, projectName: `${E2E_PREFIX}denied` }, expect: { worker: 403, client: 403 } },
  { label: "edit", method: "PATCH", path: `projects/${NB}`, body: { location: "E2E" }, expect: { worker: 403, client: 403 } },
  { label: "delete is head-only", method: "DELETE", path: `projects/${NB}`, expect: { manager: 403, worker: 403, client: 403 } },
  { label: "a manager can't grant himself budget access", method: "PATCH", path: `projects/${NB}`, body: { budgetAccessManagerIds: [f.userIds.manager] }, expect: { manager: 403 } },
  { label: "a manager can't add managers", method: "PATCH", path: `projects/${NB}`, body: { managerIds: [f.userIds.manager, f.userIds.head] }, expect: { manager: 403 } },
  { label: "client invites", path: `projects/${S}/client-invites`, expect: { head: 200, manager: 200, worker: 403, client: 403 } },
  { label: "client invites on someone else's project", path: `projects/${X}/client-invites`, expect: { manager: 403 } },
]);

test.describe("project field visibility", () => {
  const MONEY = ["budget", "estimatedCost", "currentSpend"];
  const CONTACT = ["clientPhone", "clientEmail"];

  for (const role of ROLES) {
    test(`${role}: money and client contact fields`, async ({ request }) => {
      const res = await call(request, role, "GET", `projects/${S}`);
      expect(res.status()).toBe(200);
      const project = (await res.json()) as Record<string, unknown>;
      const keys = Object.keys(project);
      const seesMoney = role === "head" || role === "manager"; // the seeded manager has budget access on S
      for (const k of MONEY) expect.soft(keys.includes(k), `${k}`).toBe(seesMoney);
      if (role === "worker" || role === "client") for (const k of CONTACT) expect.soft(keys).not.toContain(k);
      if (role === "client") {
        expect.soft(keys).not.toContain("clientIds");
        expect.soft(keys).not.toContain("budgetAccessManagerIds");
      }
    });
  }

  test("manager without budget access gets no money fields", async ({ request }) => {
    const project = (await (await call(request, "manager", "GET", `projects/${NB}`)).json()) as Record<string, unknown>;
    for (const k of MONEY) expect.soft(Object.keys(project)).not.toContain(k);
  });

  test("project lists are membership-scoped", async ({ request }) => {
    for (const role of ["manager", "worker", "client"] as Role[]) {
      const ids = ((await (await call(request, role, "GET", "projects")).json()) as { id: string }[]).map((p) => p.id);
      expect.soft(ids, role).toContain(S);
      expect.soft(ids, role).not.toContain(X);
    }
  });
});

test.describe("project members", () => {
  for (const role of ROLES) {
    test(`${role}: directory and contact details`, async ({ request }) => {
      const res = await call(request, role, "GET", `projects/${S}/members`);
      expect(res.status()).toBe(200);
      const members = (await res.json()) as Record<string, unknown>[];
      expect(members.length).toBeGreaterThan(0);
      const staffView = role === "head" || role === "manager";
      const types = new Set(members.map((m) => m.memberType));
      expect.soft(types.has("client"), "sees client accounts").toBe(staffView);
      expect.soft(types.has("budgetAccess"), "sees budget access").toBe(staffView);
      if (!staffView) {
        for (const m of members) for (const k of ["email", "phone", "username"]) expect.soft(Object.keys(m)).not.toContain(k);
      }
    });
  }
  test("members of a project the user is not on", async ({ request }) => {
    for (const role of ["manager", "worker", "client"] as Role[]) {
      expect.soft((await call(request, role, "GET", `projects/${X}/members`)).status(), role).toBe(403);
    }
  });
});

matrix("staff", [
  { label: "list", path: "staff", expect: { head: 200, manager: 200, worker: 403, client: 403 } },
  { label: "assignments", path: `staff/${f.userIds.worker}/assignments`, expect: { head: 200, manager: 403, worker: 403, client: 403 } },
  // Aimed at a non-existent id: if a guard ever regressed, the call would 404 instead of touching a real account.
  { label: "edit / suspend", method: "PATCH", path: `staff/${NO_SUCH_USER}`, body: {}, expect: { manager: 403, worker: 403, client: 403 } },
  { label: "create", method: "POST", path: "staff", body: { role: "worker", displayName: `${E2E_PREFIX}denied` }, expect: { manager: 403, worker: 403, client: 403 } },
  { label: "delete", method: "DELETE", path: `staff/${NO_SUCH_USER}`, expect: { manager: 403, worker: 403, client: 403 } },
]);

test("managers list workers only", async ({ request }) => {
  const res = await call(request, "manager", "GET", "staff");
  const staff = (await res.json()) as { role: string }[];
  expect(staff.length).toBeGreaterThan(0);
  expect(new Set(staff.map((s) => s.role))).toEqual(new Set(["worker"]));
});

matrix("sales", [
  { label: "leads", path: "leads", expect: { head: 200, manager: 200, worker: 403, client: 403 } },
  { label: "a lead", path: `leads/${f.leadId}`, expect: { head: 200, manager: 200, worker: 403, client: 403 } },
  { label: "lead delete is head-only", method: "DELETE", path: `leads/${f.leadId}`, expect: { manager: 403, worker: 403, client: 403 } },
  { label: "a quote", path: `quotes/${f.quoteId}`, expect: { head: 200, manager: 200, worker: 403, client: 403 } },
  { label: "quote PDF", path: `quotes/${f.quoteId}/pdf`, expect: { head: 200, manager: 200, worker: 403, client: 403 } },
  { label: "quote delete is head-only", method: "DELETE", path: `quotes/${f.quoteId}`, expect: { manager: 403, worker: 403, client: 403 } },
  { label: "rate card read", path: "catalog-items", expect: { head: 200, manager: 200, worker: 403, client: 403 } },
  { label: "rate card write", method: "POST", path: "catalog-items", body: { name: `${E2E_PREFIX}denied` }, expect: { manager: 403, worker: 403, client: 403 } },
  { label: "templates read", path: "quote-templates", expect: { head: 200, manager: 200, worker: 403, client: 403 } },
  { label: "templates write", method: "POST", path: "quote-templates", body: { name: `${E2E_PREFIX}denied` }, expect: { manager: 403, worker: 403, client: 403 } },
  { label: "quotation settings read", path: "quotation-settings", expect: { head: 200, manager: 200, worker: 403, client: 403 } },
  // Invalid on purpose: head passes the role guard and fails validation (400), so nothing is written.
  { label: "quotation settings PUT is head-only", method: "PUT", path: "quotation-settings", body: { quoteValidityDays: 0 }, expect: { head: 400, manager: 403, worker: 403, client: 403 } },
  { label: "website portfolio admin", path: "portfolio", expect: { head: 200, manager: 403, worker: 403, client: 403 } },
]);

test("lead delete: manager refused, head allowed", async ({ request }) => {
  const created = await call(request, "manager", "POST", "leads", { clientName: `${E2E_PREFIX}API lead ${stamp}` });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  try {
    expect((await call(request, "manager", "DELETE", `leads/${id}`)).status()).toBe(403);
    expect((await call(request, "head", "GET", `leads/${id}`)).status()).toBe(200);
    expect((await call(request, "head", "DELETE", `leads/${id}`)).status()).toBe(200);
    expect((await call(request, "head", "GET", `leads/${id}`)).status()).toBe(404);
  } finally {
    await call(request, "head", "DELETE", `leads/${id}`);
  }
});

test("notifications are owner-only", async ({ request }) => {
  // A notification addressed to the head, inserted directly so nothing else is triggered.
  const text = `${E2E_PREFIX}ownership probe ${stamp}`;
  const [{ id }] = await dbInsert<{ id: string }>("notifications", {
    recipient_id: f.userIds.head,
    title: text,
    body: text,
    type: "system",
  });
  try {
    const managerList = (await (await call(request, "manager", "GET", "notifications")).json()) as { id: string }[];
    expect(managerList.map((n) => n.id)).not.toContain(id);

    // Mark-read is scoped to the caller: 200, but someone else's row is untouched.
    expect((await call(request, "manager", "PATCH", `notifications/${id}/read`)).status()).toBe(200);
    expect((await call(request, "manager", "DELETE", `notifications/${id}`)).status()).toBe(404);
    expect((await call(request, "client", "DELETE", `notifications/${id}`)).status()).toBe(404);
    const [row] = await dbSelect<{ is_read: boolean }>("notifications", { id: `eq.${id}` });
    expect(row, "still there").toBeTruthy();
    expect(row.is_read, "not marked read by someone else").toBe(false);

    const headList = (await (await call(request, "head", "GET", "notifications")).json()) as { id: string }[];
    expect(headList.map((n) => n.id)).toContain(id);
    expect((await call(request, "head", "DELETE", `notifications/${id}`)).status()).toBe(200);
  } finally {
    await dbDelete("notifications", { id: `eq.${id}` });
  }
});

test.describe("design approval: only the client decides", () => {
  const designs: { project: string; id: string }[] = [];

  async function newDesign(request: APIRequestContext, project: string) {
    const res = await call(request, "head", "POST", `projects/${project}/designs`, {
      title: `${E2E_PREFIX}API design ${stamp}`,
      approvalRequired: true,
    });
    expect(res.status()).toBe(201);
    const { id } = (await res.json()) as { id: string };
    designs.push({ project, id });
    return id;
  }

  test.afterAll(async ({ request }) => {
    for (const d of designs) {
      await call(request, "head", "DELETE", `projects/${d.project}/designs/${d.id}`);
      await deleteNotificationsFor(d.id);
    }
  });

  test("staff and workers can't decide; the client can", async ({ request }) => {
    const id = await newDesign(request, S);
    const decide = (role: Role, status: string, comment?: string) =>
      call(request, role, "POST", `projects/${S}/designs/${id}/approval`, { status, comment });

    expect.soft((await decide("head", "approved")).status(), "head approves").toBe(403);
    expect.soft((await decide("manager", "changes_requested", "no")).status(), "manager decides").toBe(403);
    expect.soft((await decide("worker", "approved")).status(), "worker approves").toBe(403);
    expect.soft((await call(request, "client", "PATCH", `projects/${S}/designs/${id}`, { title: "hijack" })).status(), "client edits").toBe(403);
    expect.soft((await call(request, "worker", "POST", `projects/${S}/designs`, { title: `${E2E_PREFIX}worker` })).status(), "worker uploads").toBe(403);
    expect.soft((await call(request, "client", "POST", `projects/${S}/designs`, { title: `${E2E_PREFIX}client` })).status(), "client uploads").toBe(403);

    const approved = await decide("client", "approved");
    expect(approved.status()).toBe(200);
    expect(((await approved.json()) as { approvalStatus: string }).approvalStatus).toBe("approved");
    // Staff may only ask again (status "pending").
    expect((await decide("manager", "pending")).status()).toBe(200);
  });

  test("a client can't decide on another project's design", async ({ request }) => {
    const id = await newDesign(request, NB);
    const res = await call(request, "client", "POST", `projects/${NB}/designs/${id}/approval`, { status: "approved" });
    expect(res.status()).toBe(403);
  });
});

test("internal updates never reach the client", async ({ request }) => {
  const res = await call(request, "head", "POST", `projects/${S}/updates`, {
    content: `${E2E_PREFIX}internal update ${stamp}`,
    isClientViewable: false,
  });
  expect(res.status()).toBe(201);
  const { id } = (await res.json()) as { id: string };
  try {
    const ids = async (role: Role) =>
      ((await (await call(request, role, "GET", `projects/${S}/updates`)).json()) as { id: string }[]).map((u) => u.id);
    expect(await ids("worker")).toContain(id);
    expect(await ids("manager")).toContain(id);
    expect(await ids("client")).not.toContain(id);
    const comment = await call(request, "client", "POST", `projects/${S}/updates/${id}/comments`, { text: "E2E" });
    expect([403, 404]).toContain(comment.status());
    expect((await call(request, "client", "POST", `projects/${S}/updates`, { content: `${E2E_PREFIX}client post` })).status()).toBe(403);
    expect((await call(request, "worker", "DELETE", `projects/${S}/updates/${id}`)).status()).toBe(403);
  } finally {
    await call(request, "head", "DELETE", `projects/${S}/updates/${id}`);
  }
});

test.describe("client file visibility", () => {
  const base = `projects/${S}/e2e-rbac/${stamp}`;
  const hiddenPath = `${base}-hidden.pdf`;
  const sharedPath = `${base}-shared.pdf`;
  const fileIds: string[] = [];

  async function upload(request: APIRequestContext, path: string) {
    const signed = await call(request, "head", "POST", "uploads/sign", { bucket: "project-files", path });
    expect(signed.status()).toBe(201);
    const { signedUrl } = (await signed.json()) as { signedUrl: string };
    const put = await request.fetch(signedUrl, {
      method: "PUT",
      headers: { "content-type": "application/pdf" },
      data: Buffer.from("%PDF-1.4\n%E2E\n"),
    });
    expect(put.ok()).toBeTruthy();
  }

  async function fileRow(request: APIRequestContext, path: string, clientVisible: boolean) {
    const res = await call(request, "head", "POST", `projects/${S}/files`, {
      title: `${E2E_PREFIX}${clientVisible ? "shared" : "hidden"} ${stamp}`,
      name: path.split("/").pop(),
      storagePath: `sb://project-files/${path}`,
      clientVisible,
    });
    expect(res.status()).toBe(201);
    const { id } = (await res.json()) as { id: string };
    fileIds.push(id);
    return id;
  }

  test.afterAll(async ({ request }) => {
    for (const id of fileIds) await call(request, "head", "DELETE", `projects/${S}/files/${id}`);
    await storageRemove("project-files", [hiddenPath, sharedPath]);
  });

  test("hidden files are invisible and undownloadable for the client", async ({ request }) => {
    await upload(request, hiddenPath);
    await upload(request, sharedPath);
    const hiddenId = await fileRow(request, hiddenPath, false);
    const sharedId = await fileRow(request, sharedPath, true);

    const clientFiles = ((await (await call(request, "client", "GET", `projects/${S}/files`)).json()) as { id: string }[]).map((x) => x.id);
    expect(clientFiles).toContain(sharedId);
    expect(clientFiles).not.toContain(hiddenId);

    const sign = (role: Role, path: string) => call(request, role, "POST", "uploads/sign-download", { bucket: "project-files", path });
    expect((await sign("client", hiddenPath)).status(), "client → hidden").toBe(403);
    expect((await sign("client", sharedPath)).status(), "client → shared").toBe(201);
    expect((await sign("head", hiddenPath)).status(), "head → hidden").toBe(201);
    expect((await sign("manager", hiddenPath)).status(), "manager → hidden").toBe(201);
    expect((await sign("worker", hiddenPath)).status(), "worker → hidden (workers see all files)").toBe(201);

    // Nor can the client touch it.
    const patch = await call(request, "client", "PATCH", `projects/${S}/files/${hiddenId}`, { approvalStatus: "approved" });
    expect([403, 404]).toContain(patch.status());
  });

  test("storage paths outside the user's projects are refused", async ({ request }) => {
    const foreign = `projects/${X}/e2e-rbac/${stamp}.pdf`;
    for (const role of ["manager", "worker", "client"] as Role[]) {
      const res = await call(request, role, "POST", "uploads/sign-download", { bucket: "project-files", path: foreign });
      expect.soft(res.status(), role).toBe(403);
    }
    const res = await call(request, "worker", "POST", "uploads/sign", { bucket: "designs", path: `projects/${S}/e2e/${stamp}.pdf` });
    expect(res.status(), "worker uploading a design").toBe(403);
    const quotation = await call(request, "client", "POST", "uploads/sign-download", { bucket: "quotations", path: `quotation/${stamp}.pdf` });
    expect(quotation.status(), "client reading quotations bucket").toBe(403);
  });
});
