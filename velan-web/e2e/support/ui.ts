import { expect, type Locator, type Page } from "@playwright/test";

export const FORBIDDEN_HEADING = "You don't have access to this page";
const NOT_FOUND_HEADING = "We couldn't find that";
const ERROR_HEADING = "Something went wrong";

/** Main content area of either shell (both render <main id="main-content">). */
export const main = (page: Page): Locator => page.locator("main").first();

/** Wait for streamed Suspense content: no loading skeletons left in the page. */
export async function settled(page: Page) {
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 });
}

export async function expectForbidden(page: Page) {
  await expect(page.getByRole("heading", { name: FORBIDDEN_HEADING })).toBeVisible({ timeout: 20_000 });
}

/** The page rendered its real content: not the 403, 404 or error state. */
export async function expectRendered(page: Page) {
  await settled(page);
  for (const name of [FORBIDDEN_HEADING, NOT_FOUND_HEADING, ERROR_HEADING]) {
    await expect(page.getByRole("heading", { name })).toHaveCount(0);
  }
}

export async function expectNotFound(page: Page) {
  await expect(page.getByRole("heading", { name: NOT_FOUND_HEADING })).toBeVisible({ timeout: 20_000 });
}

/** Staff sidebar labels (desktop viewport). */
export async function sidebarLabels(page: Page): Promise<string[]> {
  const links = page.getByRole("complementary", { name: "Main navigation" }).getByRole("navigation", { name: "Primary" }).getByRole("link");
  await expect(links.first()).toBeVisible();
  return (await links.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
}

/** Project section tab labels (staff project frame or portal header). */
export async function projectTabLabels(page: Page): Promise<string[]> {
  const links = page.getByRole("navigation", { name: "Project sections" }).first().getByRole("link");
  await expect(links.first()).toBeVisible();
  return (await links.allInnerTexts()).map((t) => t.trim()).filter(Boolean);
}

/** No rupee figure anywhere in the locator's text. */
export async function expectNoMoney(scope: Locator) {
  await expect(scope).not.toContainText("₹");
}

/** document scrollWidth must not exceed the viewport (no sideways page scroll). */
export async function horizontalOverflow(page: Page): Promise<{ scrollWidth: number; innerWidth: number }> {
  return page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
}
