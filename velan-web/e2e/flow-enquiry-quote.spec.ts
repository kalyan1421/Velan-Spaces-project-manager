/**
 * R-G2 flow: a public /contact enquiry becomes a lead + a "New website enquiry"
 * notification for the head; the notification opens the lead; a blank quote is
 * created there and its server PDF downloads; deleting the lead removes its quotes.
 */
import type { Page } from "@playwright/test";
import { deleteLead } from "./support/cleanup";
import { E2E_PREFIX, storageStatePath } from "./support/env";
import { tokens } from "./support/fixtures";
import { dbSelect } from "./support/supabase";
import { expect, test } from "./support/test";
import { expectRendered } from "./support/ui";

const stamp = Date.now().toString(36).toUpperCase();
const name = `${E2E_PREFIX}Enquiry ${stamp}`;
let leadId: string | null = null;

async function poll<T>(fn: () => Promise<T | null | undefined>, what: string, timeoutMs = 15_000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > until) throw new Error(`Timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

test.afterAll(async () => {
  const left = await dbSelect<{ id: string }>("leads", { select: "id", client_name: `eq.${name}` });
  for (const l of left) await deleteLead(tokens().head.accessToken, l.id);
});

test.describe.configure({ mode: "serial" });

test.describe("visitor", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("sends an enquiry from /contact", async ({ page }) => {
    await page.goto("/contact");
    const form = page.locator("form").filter({ has: page.getByLabel("Your name") });
    await form.getByLabel("Your name").fill(name);
    await form.getByLabel("Mobile number").fill("98765 43210");
    await form.getByLabel(/I agree that/).check();
    await form.getByRole("button", { name: "Request a call back" }).click();
    await expect(page.getByRole("heading", { name: /We.ve got your enquiry/ })).toBeVisible();

    const lead = await poll(
      async () => (await dbSelect<{ id: string; source: string }>("leads", { client_name: `eq.${name}` }))[0],
      "the lead",
    );
    expect(lead.source).toBe("website");
    leadId = lead.id;
  });
});

test.describe("head", () => {
  test.use({ storageState: storageStatePath("head") });

  async function openLeadFromNotification(page: Page) {
    // The notification is written asynchronously after the enquiry is accepted.
    await poll(
      async () => (await dbSelect("notifications", { lead_id: `eq.${leadId}`, recipient_id: `eq.${tokens().head.userId}` }))[0],
      "the head's notification",
    );
    await page.goto("/app/notifications");
    await expectRendered(page);
    const item = page.getByRole("listitem").filter({ hasText: "New website enquiry" }).filter({ hasText: name });
    await expect(item).toHaveCount(1);
    await item.getByRole("link").first().click();
    await expect(page).toHaveURL(new RegExp(`/app/sales/${leadId}$`));
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  }

  test("notification → lead → blank quote → server PDF → delete lead", async ({ page }) => {
    test.skip(!leadId, "the enquiry step failed");
    let quoteId = "";

    await test.step("the notification opens the lead", () => openLeadFromNotification(page));

    await test.step("create a blank quote", async () => {
      await page.getByRole("button", { name: "New quote" }).first().click();
      const dialog = page.getByRole("dialog", { name: "New quote" });
      await expect(dialog.getByLabel("Blank quote")).toBeChecked();
      await dialog.getByRole("button", { name: "Create quote" }).click();
      await expect(page).toHaveURL(/\/app\/quotes\/[0-9a-f-]{36}$/);
      quoteId = page.url().split("/").pop() ?? "";
      const [quote] = await dbSelect<{ lead_id: string }>("quotes", { id: `eq.${quoteId}` });
      expect(quote.lead_id).toBe(leadId);
    });

    await test.step("GET /api/quotes/<id>/pdf returns a PDF", async () => {
      const res = await page.request.get(`/api/quotes/${quoteId}/pdf`);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("application/pdf");
      expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
    });

    await test.step("delete the lead (cascades its quotes and notification)", async () => {
      await page.goto(`/app/sales/${leadId}`);
      await expectRendered(page);
      await page.getByRole("button", { name: "More actions" }).click();
      await page.getByRole("menuitem", { name: "Delete lead" }).click();
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toContainText("The lead and its quote are removed");
      await dialog.getByRole("button", { name: "Delete" }).click();
      await expect(page).toHaveURL(/\/app\/sales$/);
      expect(await dbSelect("leads", { id: `eq.${leadId}` })).toHaveLength(0);
      expect(await dbSelect("quotes", { id: `eq.${quoteId}` })).toHaveLength(0);
      expect(await dbSelect("notifications", { lead_id: `eq.${leadId}` })).toHaveLength(0);
    });
  });
});
