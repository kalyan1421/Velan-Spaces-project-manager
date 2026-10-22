/**
 * The expected RBAC matrix, derived from the code (not guessed):
 *  - sidebar per role: src/lib/nav.ts `navFor`
 *  - project tabs per role: src/lib/projects.ts `projectTabsFor` (+ API field stripping)
 *  - route gates: src/app/app/layout.tsx + portal/layout.tsx (`requireRole`), each page's
 *    `ForbiddenState`, src/proxy.ts (signed-out → /login?next=…)
 *  - API guards: @Roles on the Nest controllers + ProjectAccessService (membership, budget access)
 * Keep this file in sync with those when roles change.
 */
import type { Role } from "./env";

export type StaffRole = Exclude<Role, "client">;

/** Sidebar labels (top level + Sales children), in order. */
export const NAV: Record<StaffRole, string[]> = {
  head: ["Projects", "Sales", "Quotations", "Rate card", "Templates", "Quotation settings", "Staff", "Website", "Notifications", "Profile"],
  manager: ["Projects", "Sales", "Quotations", "Notifications", "Profile"],
  worker: ["Projects", "Notifications", "Profile"],
};

/** Labels no role outside the list may see in its sidebar. */
export const NAV_RESTRICTED = ["Sales", "Quotations", "Staff", "Website", "Rate card", "Templates", "Quotation settings"];

const ALL_TABS = [
  "Overview",
  "Updates",
  "Designs",
  "Files",
  "Timeline",
  "Workers",
  "Rooms",
  "Budget",
  "Settlements",
  "Support",
  "Client access",
] as const;
export type TabLabel = (typeof ALL_TABS)[number];

/** Project tabs on a project the role belongs to. `money` = the viewer has budget access there. */
export function expectedTabs(role: StaffRole, money: boolean): TabLabel[] {
  return ALL_TABS.filter((t) => {
    if (t === "Workers" || t === "Rooms" || t === "Client access") return role !== "worker";
    if (t === "Budget" || t === "Settlements") return role !== "worker" && money;
    return true; // NOTE: workers get Support (UI and API agree; spec §5 says "—").
  });
}

/** What a staff page shows for a role. */
export type PageOutcome = "ok" | "forbidden" | { redirect: RegExp };

const OK: PageOutcome = "ok";
const FORBIDDEN: PageOutcome = "forbidden";
const TO_PROJECTS: PageOutcome = { redirect: /\/app\/projects$/ };

/** Top-level /app pages (ids are filled in by the spec). */
export const APP_PAGES: { path: (f: { leadId: string; quoteId: string }) => string; expect: Record<StaffRole, PageOutcome> }[] = [
  { path: () => "/app/projects", expect: { head: OK, manager: OK, worker: OK } },
  { path: () => "/app/projects/new", expect: { head: OK, manager: OK, worker: TO_PROJECTS } },
  { path: () => "/app/sales", expect: { head: OK, manager: OK, worker: FORBIDDEN } },
  { path: (f) => `/app/sales/${f.leadId}`, expect: { head: OK, manager: OK, worker: FORBIDDEN } },
  { path: (f) => `/app/quotes/${f.quoteId}`, expect: { head: OK, manager: OK, worker: FORBIDDEN } },
  // Managers get a read-only rate card (they price quotes from it); no sidebar link though.
  { path: () => "/app/rate-card", expect: { head: OK, manager: OK, worker: FORBIDDEN } },
  { path: () => "/app/quote-templates", expect: { head: OK, manager: FORBIDDEN, worker: FORBIDDEN } },
  { path: () => "/app/settings/quotation", expect: { head: OK, manager: FORBIDDEN, worker: FORBIDDEN } },
  { path: () => "/app/staff", expect: { head: OK, manager: FORBIDDEN, worker: FORBIDDEN } },
  { path: () => "/app/website", expect: { head: OK, manager: FORBIDDEN, worker: FORBIDDEN } },
  { path: () => "/app/notifications", expect: { head: OK, manager: OK, worker: OK } },
];

/** Tab pages under /app/projects/<shared project> (all three staff roles are members). */
export const PROJECT_PAGES: { segment: string; expect: Record<StaffRole, PageOutcome> }[] = [
  { segment: "", expect: { head: OK, manager: OK, worker: OK } },
  { segment: "updates", expect: { head: OK, manager: OK, worker: OK } },
  { segment: "designs", expect: { head: OK, manager: OK, worker: OK } },
  { segment: "files", expect: { head: OK, manager: OK, worker: OK } },
  { segment: "timeline", expect: { head: OK, manager: OK, worker: OK } },
  { segment: "support", expect: { head: OK, manager: OK, worker: OK } },
  { segment: "workers", expect: { head: OK, manager: OK, worker: FORBIDDEN } },
  { segment: "rooms", expect: { head: OK, manager: OK, worker: FORBIDDEN } },
  { segment: "budget", expect: { head: OK, manager: OK, worker: FORBIDDEN } },
  { segment: "settlements", expect: { head: OK, manager: OK, worker: FORBIDDEN } },
  { segment: "client-access", expect: { head: OK, manager: OK, worker: FORBIDDEN } },
  { segment: "edit", expect: { head: OK, manager: OK, worker: FORBIDDEN } },
];

// ---------------------------------------------------------------------------
// Client portal. NEEDS RE-RUN AFTER THE PORTAL CHANGE (payments card + chat box,
// 2026-10-22): everything portal-specific the suite asserts lives here.
// ---------------------------------------------------------------------------

/** Portal section tabs (no Support tab: support is the chat box on the overview). */
export const PORTAL_TABS = ["Overview", "Updates", "Designs", "Files", "Timeline"];
/** Labels that would mean the client sees staff-only money. */
export const PORTAL_FORBIDDEN_MONEY_LABELS = [/\bspent\b/i, /estimated cost/i, /settlements?/i, /\bexpenses?\b/i];
/** The only place a client may see ₹ figures: the "Payments" card on the project overview. */
export const PORTAL_PAYMENTS_CARD_TITLE = "Payments";
/** Portal sub-pages; none may show a ₹ figure. */
export const PORTAL_SUBPAGES = ["updates", "designs", "files", "timeline"];
/** `/portal/projects/<id>/support` now redirects to the overview's chat box. */
export const PORTAL_SUPPORT_REDIRECT = (projectId: string) => new RegExp(`/portal/projects/${projectId}#chat$`);
