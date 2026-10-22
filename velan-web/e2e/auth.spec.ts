/**
 * R-G2: login per role (fresh sessions, not the cached ones), safe `next`
 * handling, a wrong password, and sign-out. Kept to 5 logins per run: the API
 * throttles logins (8/min per client IP) and Supabase limits sign-ins too.
 */
import type { Page } from "@playwright/test";
import { PASSWORD, USERS, type Role } from "./support/env";
import { fixtures } from "./support/fixtures";
import { expect, test } from "./support/test";

test.use({ storageState: { cookies: [], origins: [] } });

const f = fixtures();

async function signIn(page: Page, role: Role, password = PASSWORD) {
  await page.getByLabel("Email or username").fill(USERS[role].login);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test("head signs in to /app/projects and signs out", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, "head");
  await expect(page).toHaveURL(/\/app\/projects$/);
  await page.getByRole("button", { name: /^Account menu for / }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/app/projects");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fprojects$/);
});

test("worker signs in by username", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, "worker");
  await expect(page).toHaveURL(/\/app\/projects$/);
});

test("manager returns to the page they asked for", async ({ page }) => {
  await page.goto("/app/sales");
  await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fsales$/);
  await signIn(page, "manager");
  await expect(page).toHaveURL(/\/app\/sales$/);
});

test("client asking for a staff page lands in the portal instead", async ({ page }) => {
  await page.goto("/app/sales");
  await signIn(page, "client");
  await expect(page).toHaveURL(new RegExp(`/portal/projects/${f.sharedProjectId}$`));
});

test("a wrong password is refused", async ({ page }) => {
  await page.goto("/login");
  await signIn(page, "head", `${PASSWORD}-wrong`);
  await expect(page.locator('[data-slot="alert"]')).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/app/projects");
  await expect(page).toHaveURL(/\/login\?next=/);
});
