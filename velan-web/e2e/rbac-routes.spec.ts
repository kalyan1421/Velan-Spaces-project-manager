/**
 * R-G1 (web half): every role × every staff/portal route. The expected matrix
 * lives in support/expectations.ts and is derived from nav.ts, the layouts'
 * requireRole gates, each page's ForbiddenState and the API's field stripping.
 */
import type { Page } from "@playwright/test";
import { storageStatePath, type Role } from "./support/env";
import {
  APP_PAGES,
  NAV,
  NAV_RESTRICTED,
  PORTAL_FORBIDDEN_MONEY_LABELS,
  PORTAL_PAYMENTS_CARD_TITLE,
  PORTAL_SUBPAGES,
  PORTAL_SUPPORT_REDIRECT,
  PORTAL_TABS,
  PROJECT_PAGES,
  expectedTabs,
  type PageOutcome,
  type StaffRole,
} from "./support/expectations";
import { fixtures } from "./support/fixtures";
import { expect, test } from "./support/test";
import {
  expectForbidden,
  expectNoMoney,
  expectNotFound,
  expectRendered,
  main,
  projectTabLabels,
  settled,
  sidebarLabels,
} from "./support/ui";

const f = fixtures();
const projectPath = (id: string, segment = "") => `/app/projects/${id}${segment ? `/${segment}` : ""}`;
const portalPath = (id: string, segment = "") => `/portal/projects/${id}${segment ? `/${segment}` : ""}`;

/** Every protected route the matrix covers (signed-out and client checks walk all of them). */
const APP_ROUTES = [
  ...APP_PAGES.map((p) => p.path(f)),
  ...PROJECT_PAGES.map((p) => projectPath(f.sharedProjectId, p.segment)),
];
const PORTAL_ROUTES = [
  "/portal",
  "/portal/notifications",
  portalPath(f.sharedProjectId),
  ...PORTAL_SUBPAGES.map((s) => portalPath(f.sharedProjectId, s)),
  portalPath(f.sharedProjectId, "support"),
];

async function expectOutcome(page: Page, outcome: PageOutcome) {
  if (outcome === "ok") return expectRendered(page);
  if (outcome === "forbidden") return expectForbidden(page);
  await expect(page).toHaveURL(outcome.redirect);
}

// ---------------------------------------------------------------- signed out
test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const path of [...APP_ROUTES, ...PORTAL_ROUTES]) {
    test(`${path} → /login?next=…`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login(\?|$)/);
      const next = new URL(page.url()).searchParams.get("next");
      expect(next).toBe(path);
      await expect(page.getByLabel("Email or username")).toBeVisible();
    });
  }
});

// ---------------------------------------------------------------- staff roles
for (const role of ["head", "manager", "worker"] as StaffRole[]) {
  test.describe(`${role}`, () => {
    test.use({ storageState: storageStatePath(role) });

    test("sidebar shows exactly the role's sections", async ({ page }) => {
      await page.goto("/app/projects");
      await settled(page);
      const labels = await sidebarLabels(page);
      expect(labels).toEqual(NAV[role]);
      for (const restricted of NAV_RESTRICTED) {
        if (!NAV[role].includes(restricted)) expect(labels).not.toContain(restricted);
      }
    });

    for (const { path, expect: outcomes } of APP_PAGES) {
      const url = path(f);
      test(`${url} → ${JSON.stringify(outcomes[role])}`, async ({ page }) => {
        await page.goto(url);
        await expectOutcome(page, outcomes[role]);
      });
    }

    for (const { segment, expect: outcomes } of PROJECT_PAGES) {
      test(`shared project /${segment || "(overview)"} → ${JSON.stringify(outcomes[role])}`, async ({ page }) => {
        await page.goto(projectPath(f.sharedProjectId, segment));
        await expectOutcome(page, outcomes[role]);
        if (role === "worker") await expectNoMoney(main(page));
      });
    }

    test("shared project tabs match the role", async ({ page }) => {
      await page.goto(projectPath(f.sharedProjectId));
      await settled(page);
      // The seeded manager has budget access on the shared project.
      expect(await projectTabLabels(page)).toEqual(expectedTabs(role, role !== "worker"));
      const edit = page.getByRole("link", { name: "Edit project" });
      if (role === "worker") await expect(edit).toHaveCount(0);
      else await expect(edit).toBeVisible();
    });

    test("money is visible only with budget access", async ({ page }) => {
      await page.goto(projectPath(f.sharedProjectId));
      await settled(page);
      if (role === "worker") {
        await expectNoMoney(main(page));
      } else {
        // Positive control: the ₹ check above would catch a leak.
        await expect(main(page)).toContainText("₹");
      }
      await page.goto("/app/projects");
      await settled(page);
      if (role === "worker") {
        await expectNoMoney(main(page));
        await expect(page.getByRole("columnheader", { name: /budget|spent/i })).toHaveCount(0);
      }
    });

    if (role !== "worker") {
      test("project delete (danger zone) is head-only", async ({ page }) => {
        await page.goto(projectPath(f.sharedProjectId, "edit"));
        await expectRendered(page);
        const del = page.getByRole("button", { name: "Delete project" });
        if (role === "head") await expect(del).toBeVisible();
        else await expect(del).toHaveCount(0);
      });
    }

    test("projects they are not on are refused", async ({ page }) => {
      await page.goto(projectPath(f.foreignProjectId));
      if (role === "head") await expectRendered(page);
      else await expectForbidden(page);
    });

    for (const path of PORTAL_ROUTES) {
      test(`${path} → /app/projects (portal is clients-only)`, async ({ page }) => {
        await page.goto(path);
        await expect(page).toHaveURL(/\/app\/projects$/);
      });
    }
  });
}

// ---------------------------------------------------------------- manager without budget access
test.describe("manager without budget access on a project", () => {
  test.use({ storageState: storageStatePath("manager") });

  test("no Budget/Settlements tabs and no ₹ on the overview", async ({ page }) => {
    await page.goto(projectPath(f.noBudgetProjectId));
    await settled(page);
    expect(await projectTabLabels(page)).toEqual(expectedTabs("manager", false));
    await expectNoMoney(main(page));
  });

  for (const segment of ["budget", "settlements"]) {
    test(`/${segment} is refused`, async ({ page }) => {
      await page.goto(projectPath(f.noBudgetProjectId, segment));
      await expectForbidden(page);
      await expectNoMoney(main(page));
    });
  }

  test("the edit form has no money fields", async ({ page }) => {
    await page.goto(projectPath(f.noBudgetProjectId, "edit"));
    await expectRendered(page);
    await expect(page.getByRole("textbox", { name: "Budget", exact: true })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Estimated cost" })).toHaveCount(0);
    await expectNoMoney(main(page));
  });

  test("the project row in the list shows no figures", async ({ page }) => {
    await page.goto("/app/projects");
    await settled(page);
    const row = page.getByRole("row").filter({ hasText: f.noBudgetProjectCode });
    await expect(row).toHaveCount(1);
    await expectNoMoney(row);
  });
});

// ---------------------------------------------------------------- sales details per role
test.describe("lead actions", () => {
  for (const role of ["head", "manager"] as const) {
    test.describe(role, () => {
      test.use({ storageState: storageStatePath(role) });
      test(`delete lead is ${role === "head" ? "offered" : "hidden"} (API: head only)`, async ({ page }) => {
        await page.goto(`/app/sales/${f.leadId}`);
        await expectRendered(page);
        await expect(page.getByRole("button", { name: "New quote" }).first()).toBeVisible();
        const more = page.getByRole("button", { name: "More actions" });
        if (role === "head") await expect(more).toBeVisible();
        else await expect(more).toHaveCount(0);
      });
    });
  }
});

// ---------------------------------------------------------------- browser-side API routes
// The browser only reaches the API through the BFF (/api/bff/*) and the quote PDF
// route; both carry the session cookie, so they must refuse exactly what the API does.
const BROWSER_ROUTES: { role: Role | "signed-out"; path: string; status: number }[] = [
  { role: "signed-out", path: "/api/bff/projects", status: 401 },
  { role: "signed-out", path: `/api/quotes/${f.quoteId}/pdf`, status: 401 },
  { role: "worker", path: "/api/bff/leads", status: 403 },
  { role: "worker", path: `/api/bff/projects/${f.sharedProjectId}/budget/summary`, status: 403 },
  { role: "worker", path: `/api/quotes/${f.quoteId}/pdf`, status: 403 },
  { role: "client", path: `/api/bff/projects/${f.sharedProjectId}/expenses`, status: 403 },
  { role: "client", path: "/api/bff/staff", status: 403 },
  { role: "client", path: `/api/bff/quotes/${f.quoteId}`, status: 403 },
  { role: "client", path: `/api/quotes/${f.quoteId}/pdf`, status: 403 },
  { role: "manager", path: `/api/bff/projects/${f.noBudgetProjectId}/budget/summary`, status: 403 },
  { role: "manager", path: "/api/bff/portfolio", status: 403 },
  { role: "manager", path: `/api/bff/projects/${f.foreignProjectId}`, status: 403 },
  { role: "head", path: `/api/quotes/${f.quoteId}/pdf`, status: 200 },
];

for (const { role, path, status } of BROWSER_ROUTES) {
  test.describe(`browser route as ${role}`, () => {
    test.use({ storageState: role === "signed-out" ? { cookies: [], origins: [] } : storageStatePath(role) });
    test(`GET ${path} → ${status}`, async ({ page }) => {
      const res = await page.request.get(path, { failOnStatusCode: false, maxRedirects: 0 });
      expect(res.status()).toBe(status);
      if (status === 200) expect(res.headers()["content-type"]).toContain("application/pdf");
      else expect((await res.text()).includes("₹")).toBe(false);
    });
  });
}

// ---------------------------------------------------------------- client
test.describe("client", () => {
  test.use({ storageState: storageStatePath("client") });

  for (const path of APP_ROUTES) {
    test(`${path} → /portal`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/portal(\/|$)/);
    });
  }

  test("/portal opens the client's only project", async ({ page }) => {
    await page.goto("/portal");
    await expect(page).toHaveURL(new RegExp(`${portalPath(f.sharedProjectId)}$`));
  });

  test("/portal/notifications renders", async ({ page }) => {
    await page.goto("/portal/notifications");
    await expectRendered(page);
    await expectNoMoney(main(page));
  });

  test("portal tabs: no staff or money sections, no links into /app", async ({ page }) => {
    await page.goto(portalPath(f.sharedProjectId));
    await settled(page);
    expect(await projectTabLabels(page)).toEqual(PORTAL_TABS);
    await expect(page.locator('a[href^="/app"]')).toHaveCount(0);
  });

  // NEEDS RE-RUN AFTER THE PORTAL CHANGE: the overview may show ₹ only in the Payments card.
  test("overview: ₹ only inside the Payments card, never spend/costs", async ({ page }) => {
    await page.goto(portalPath(f.sharedProjectId));
    await expectRendered(page);
    const content = main(page);
    const card = content
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText(PORTAL_PAYMENTS_CARD_TITLE, { exact: true }) });
    await expect(card).toHaveCount(1);
    const outside = await content.evaluate((el, cardTitle) => {
      const clone = el.cloneNode(true) as HTMLElement;
      for (const c of clone.querySelectorAll('[data-slot="card"]')) {
        if ((c.textContent ?? "").includes(cardTitle)) c.remove();
      }
      return clone.textContent ?? "";
    }, PORTAL_PAYMENTS_CARD_TITLE);
    expect(outside).not.toContain("₹");
    for (const label of PORTAL_FORBIDDEN_MONEY_LABELS) await expect(content).not.toContainText(label);
  });

  for (const segment of PORTAL_SUBPAGES) {
    test(`/${segment}: renders, no ₹`, async ({ page }) => {
      await page.goto(portalPath(f.sharedProjectId, segment));
      await expectRendered(page);
      await expectNoMoney(main(page));
    });
  }

  // NEEDS RE-RUN AFTER THE PORTAL CHANGE: support moved to the overview's chat box.
  test("/support redirects to the chat box", async ({ page }) => {
    await page.goto(portalPath(f.sharedProjectId, "support"));
    await expect(page).toHaveURL(PORTAL_SUPPORT_REDIRECT(f.sharedProjectId));
    await expect(page.locator("#chat")).toBeVisible();
  });

  for (const segment of ["budget", "settlements", "workers", "client-access"]) {
    test(`/portal/…/${segment} does not exist`, async ({ page }) => {
      await page.goto(portalPath(f.sharedProjectId, segment));
      await expectNotFound(page);
      await expectNoMoney(main(page));
    });
  }

  for (const segment of ["", "designs", "files", "updates", "timeline"]) {
    test(`another client's project /${segment || "(overview)"} is refused`, async ({ page }) => {
      await page.goto(portalPath(f.foreignProjectId, segment));
      await expectForbidden(page);
      await expect(main(page)).toContainText("This project isn't on your account.");
    });
  }
});
