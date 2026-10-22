/**
 * Client-portal project sections, shared by the portal header tabs
 * (`PortalShell`) and the overview's section links. Plain module (no
 * "use client") so server and client components can both import it.
 * No budget/spend section, ever (R-B3).
 */
export type PortalSection = {
  /** URL segment under `/portal/projects/[id]`; "" is the overview. */
  segment: "" | "updates" | "designs" | "files" | "timeline";
  /** Short label for the tab bar. */
  label: string;
  /** Longer label + hint for the overview links. */
  title: string;
  hint: string;
};

export const PORTAL_SECTIONS: readonly PortalSection[] = [
  { segment: "", label: "Overview", title: "Overview", hint: "Progress, payments and chat with the team" },
  { segment: "updates", label: "Updates", title: "Updates", hint: "Progress notes and site photos" },
  { segment: "designs", label: "Designs", title: "Designs", hint: "Plans and renders to review and approve" },
  { segment: "files", label: "Files", title: "Files & documents", hint: "Quotations and shared documents" },
  { segment: "timeline", label: "Timeline", title: "Timeline", hint: "Phases and schedule" },
];

/** Element id of the chat box on the portal project overview. */
export const PORTAL_CHAT_ANCHOR = "chat";

export function portalChatHref(projectId: string): string {
  return `${portalSectionHref(projectId, "")}#${PORTAL_CHAT_ANCHOR}`;
}

export function portalSectionHref(projectId: string, segment: PortalSection["segment"]): string {
  const base = `/portal/projects/${encodeURIComponent(projectId)}`;
  return segment ? `${base}/${segment}` : base;
}

/** The section a portal pathname belongs to (overview for the project root). */
export function activePortalSection(pathname: string, projectId: string): PortalSection | null {
  const base = portalSectionHref(projectId, "");
  if (pathname === base || pathname === `${base}/`) return PORTAL_SECTIONS[0];
  if (!pathname.startsWith(`${base}/`)) return null;
  const segment = pathname.slice(base.length + 1).split("/")[0];
  return PORTAL_SECTIONS.find((s) => s.segment !== "" && s.segment === segment) ?? null;
}
