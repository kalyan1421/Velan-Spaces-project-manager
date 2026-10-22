/** Phone-width smoke (375×812): key screens must not scroll sideways. */
import { storageStatePath, type Role } from "./support/env";
import { expect, test } from "./support/test";
import { expectRendered, horizontalOverflow } from "./support/ui";

test.use({ viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true });

const SCREENS: { role: Role; path: string }[] = [
  { role: "head", path: "/app/projects" },
  { role: "worker", path: "/app/projects" },
  { role: "head", path: "/app/sales" },
  { role: "manager", path: "/app/sales" },
  { role: "client", path: "/portal" }, // lands on the client's project overview
];

for (const { role, path } of SCREENS) {
  test.describe(role, () => {
    test.use({ storageState: storageStatePath(role) });

    test(`${path} has no horizontal scroll`, async ({ page }) => {
      await page.goto(path);
      await expectRendered(page);
      const { scrollWidth, innerWidth } = await horizontalOverflow(page);
      expect(scrollWidth, `scrollWidth ${scrollWidth} > innerWidth ${innerWidth}`).toBeLessThanOrEqual(innerWidth);
    });
  });
}
