/**
 * R-G2 flow: the head creates a project, sets its budget from the Budget tab's
 * "Set a budget" link (/edit#budget), sees it on the Budget tab without a page
 * reload, then deletes the project from the danger zone.
 */
import { apiCall } from "./support/api";
import { deleteProject } from "./support/cleanup";
import { E2E_PREFIX, storageStatePath } from "./support/env";
import { tokens } from "./support/fixtures";
import { dbSelect } from "./support/supabase";
import { expect, test } from "./support/test";
import { expectRendered, main } from "./support/ui";

test.use({ storageState: storageStatePath("head") });

const stamp = Date.now().toString(36).toUpperCase();
const name = `${E2E_PREFIX}Flow project ${stamp}`;
const code = `E2E-FLOW-${stamp}`;
let projectId: string | null = null;

test.afterAll(async () => {
  // Normally the test deletes it; this covers a failure part-way through.
  const left = await dbSelect<{ id: string }>("projects", { select: "id", project_code: `eq.${code}` });
  for (const p of left) await deleteProject(tokens().head.accessToken, p.id);
});

test("create → set budget → see it on the Budget tab → delete", async ({ page }) => {
  await test.step("create the project", async () => {
    await page.goto("/app/projects/new");
    await expectRendered(page);
    await page.getByLabel("Project name").fill(name);
    await page.getByLabel("Project code").fill(code);
    await page.getByRole("button", { name: "Create project" }).click();
    await expect(page).toHaveURL(/\/app\/projects\/[0-9a-f-]{36}$/);
    projectId = page.url().split("/").pop() ?? null;
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
  });

  await test.step("open the Budget tab: no budget yet", async () => {
    await page.getByRole("navigation", { name: "Project sections" }).getByRole("link", { name: "Budget" }).click();
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}/budget$`));
    await expect(page.getByText("No budget is set for this project")).toBeVisible();
  });

  await test.step("set the budget via /edit#budget", async () => {
    // Survives client-side navigation only; a full page load would drop it.
    await page.evaluate(() => ((window as unknown as { __e2eNoReload: boolean }).__e2eNoReload = true));
    await page.getByRole("link", { name: "Set a budget" }).click();
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}/edit#budget$`));
    const budget = page.getByRole("textbox", { name: "Budget", exact: true });
    await expect(budget).toBeVisible();
    await budget.fill("1234567");
    await page.getByRole("button", { name: "Save changes" }).click();
  });

  await test.step("the Budget tab shows it without a reload", async () => {
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}/budget$`));
    await expect(main(page).getByText("₹12,34,567").first()).toBeVisible();
    await expect(page.getByText("No budget is set for this project")).toHaveCount(0);
    const sameDocument = await page.evaluate(() => (window as unknown as { __e2eNoReload?: boolean }).__e2eNoReload === true);
    expect(sameDocument, "navigated client-side (no full reload)").toBe(true);
  });

  await test.step("delete it from the danger zone", async () => {
    await page.getByRole("link", { name: "Edit project" }).click();
    await expect(page).toHaveURL(new RegExp(`/app/projects/${projectId}/edit$`));
    await page.getByRole("button", { name: "Delete project" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText(`Delete ${name}?`)).toBeVisible();
    const confirm = dialog.getByRole("button", { name: "Delete forever" });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel(/Type the project code/).fill(code);
    await confirm.click();
    await expect(page).toHaveURL(/\/app\/projects$/);
    await expect(page.getByRole("row").filter({ hasText: code })).toHaveCount(0);
    const res = await apiCall(tokens().head.accessToken, "GET", `projects/${projectId}`);
    expect(res.status).toBe(404);
  });
});
