/**
 * R-G2 flow (design approval, R-E4): a manager asks the client to approve a
 * design; the client approves in the portal; staff see the decision. Then a
 * second round where the client requests changes with a comment.
 */
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { apiOk } from "./support/api";
import { clientIpFor } from "./support/client-ip";
import { deleteNotificationsFor } from "./support/cleanup";
import { BASE_URL, E2E_PREFIX, storageStatePath, type Role } from "./support/env";
import { fixtures, tokens } from "./support/fixtures";
import { dbSelect } from "./support/supabase";
import { expect, test } from "./support/test";
import { settled } from "./support/ui";

const f = fixtures();
const stamp = Date.now().toString(36).toUpperCase();
const title = `${E2E_PREFIX}Flow design ${stamp}`;
const comment = `${E2E_PREFIX}please make the wardrobe wider ${stamp}`;
let designId = "";
const contexts: BrowserContext[] = [];

async function open(browser: Browser, role: Role, key: string): Promise<Page> {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    storageState: storageStatePath(role),
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: { "X-Forwarded-For": clientIpFor(`design-flow:${key}:${stamp}`) },
  });
  contexts.push(context);
  return context.newPage();
}

test.beforeAll(async () => {
  // The design itself is set up through the API; the approval round trip is the UI under test.
  const design = await apiOk<{ id: string }>(tokens().head.accessToken, "POST", `projects/${f.sharedProjectId}/designs`, {
    title,
    approvalRequired: false,
  });
  designId = design.id;
});

test.afterAll(async () => {
  for (const c of contexts) await c.close().catch(() => undefined);
  if (designId) {
    await apiOk(tokens().head.accessToken, "DELETE", `projects/${f.sharedProjectId}/designs/${designId}`).catch(() => undefined);
    await deleteNotificationsFor(designId);
  }
});

const staffDesigns = `/app/projects/${f.sharedProjectId}/designs`;
const portalDesigns = `/portal/projects/${f.sharedProjectId}/designs`;

const card = (page: Page) => page.getByRole("article").filter({ hasText: title });

async function staffAction(page: Page, item: string) {
  await card(page).getByRole("button", { name: `Actions for ${title}` }).click();
  await page.getByRole("menuitem", { name: item }).click();
}

test("manager asks → client approves → staff see it; then changes requested", async ({ browser }) => {
  const staff = await open(browser, "manager", "manager");
  const client = await open(browser, "client", "client");

  await test.step("manager asks the client to approve", async () => {
    await staff.goto(staffDesigns);
    await settled(staff);
    await expect(card(staff)).toBeVisible();
    await staffAction(staff, "Ask client to approve");
    await expect(card(staff)).toContainText("Waiting for the client");
  });

  await test.step("client approves from the portal queue", async () => {
    await client.goto(portalDesigns);
    await settled(client);
    await client.getByRole("button", { name: `Approve ${title}` }).click();
    const dialog = client.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Approve this design?" })).toBeVisible();
    await dialog.getByRole("button", { name: "Approve design" }).click();
    await expect(card(client)).toContainText("You approved this");
  });

  await test.step("staff see the approval (page and notification)", async () => {
    await staff.reload();
    await settled(staff);
    await expect(card(staff)).toContainText("Approved by Demo Client");
    const notices = await dbSelect("notifications", {
      entity_id: `eq.${designId}`,
      recipient_id: `eq.${f.userIds.manager}`,
      type: "eq.design_approval",
    });
    expect(notices.length).toBeGreaterThan(0);
  });

  await test.step("manager asks for a fresh review; client requests changes", async () => {
    await staffAction(staff, "Ask client to review again");
    await expect(card(staff)).toContainText("Waiting for the client");

    await client.reload();
    await settled(client);
    await client.getByRole("button", { name: `Request changes to ${title}` }).click();
    const dialog = client.getByRole("dialog");
    await dialog.getByRole("button", { name: "Send request" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Tell the team what you'd like changed.");
    await dialog.getByRole("textbox").fill(comment);
    await dialog.getByRole("button", { name: "Send request" }).click();
    await expect(card(client)).toContainText("You asked for changes");
  });

  await test.step("staff see the change request and the comment", async () => {
    await staff.reload();
    await settled(staff);
    await expect(card(staff)).toContainText("Changes requested by Demo Client");
    await expect(card(staff)).toContainText(comment);
  });
});
