import type { Role } from "./api/types";

/** Icon keys resolved to lucide icons by the app shell (keeps this module serialisable). */
export type NavIcon = "projects" | "sales" | "staff" | "website" | "notifications" | "profile";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIcon;
  /** Extra path prefixes that belong to this section (for the active state). */
  match?: string[];
  children?: { label: string; href: string }[];
};

const PROJECTS: NavItem = { label: "Projects", href: "/app/projects", icon: "projects" };
const SALES: NavItem = {
  label: "Sales",
  href: "/app/sales",
  icon: "sales",
  match: ["/app/quotes"],
  children: [{ label: "Quotations", href: "/app/quotes" }],
};
const STAFF: NavItem = { label: "Staff", href: "/app/staff", icon: "staff" };
const WEBSITE: NavItem = { label: "Website", href: "/app/website", icon: "website" };
const NOTIFICATIONS: NavItem = { label: "Notifications", href: "/app/notifications", icon: "notifications" };
const PROFILE: NavItem = { label: "Profile", href: "/app/profile", icon: "profile" };

const HEAD_SALES: NavItem = {
  ...SALES,
  match: ["/app/quotes", "/app/rate-card", "/app/quote-templates", "/app/settings/quotation"],
  children: [
    { label: "Quotations", href: "/app/quotes" },
    { label: "Rate card", href: "/app/rate-card" },
    { label: "Templates", href: "/app/quote-templates" },
    { label: "Quotation settings", href: "/app/settings/quotation" },
  ],
};

/** Staff sidebar by role (WEB_APP_PLAN §5). Clients never see the staff shell. */
export function navFor(role: Role): NavItem[] {
  switch (role) {
    case "head":
      return [PROJECTS, HEAD_SALES, STAFF, WEBSITE, NOTIFICATIONS, PROFILE];
    case "manager":
      return [PROJECTS, SALES, NOTIFICATIONS, PROFILE];
    case "worker":
      return [PROJECTS, NOTIFICATIONS, PROFILE];
    default:
      return [];
  }
}

export function pathMatches(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  return [item.href, ...(item.match ?? [])].some((p) => pathMatches(pathname, p));
}
