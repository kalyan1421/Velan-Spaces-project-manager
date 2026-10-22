import type { Project, Role } from "./api/types";

/** The API omits budget fields for roles that may not see money; presence is the signal. */
export function hasBudgetFields(project: Project): boolean {
  return project.budget !== undefined || project.estimatedCost !== undefined || project.currentSpend !== undefined;
}

export type ProjectTabKey =
  | "overview"
  | "updates"
  | "designs"
  | "files"
  | "timeline"
  | "workers"
  | "rooms"
  | "budget"
  | "settlements"
  | "support"
  | "client-access";

export type ProjectTab = { key: ProjectTabKey; label: string; href: string };

const TABS: { key: ProjectTabKey; label: string; segment: string }[] = [
  { key: "overview", label: "Overview", segment: "" },
  { key: "updates", label: "Updates", segment: "updates" },
  { key: "designs", label: "Designs", segment: "designs" },
  { key: "files", label: "Files", segment: "files" },
  { key: "timeline", label: "Timeline", segment: "timeline" },
  { key: "workers", label: "Workers", segment: "workers" },
  { key: "rooms", label: "Rooms", segment: "rooms" },
  { key: "budget", label: "Budget", segment: "budget" },
  { key: "settlements", label: "Settlements", segment: "settlements" },
  { key: "support", label: "Support", segment: "support" },
  { key: "client-access", label: "Client access", segment: "client-access" },
];

/** Every tab segment that can exist under /app/projects/[id]. */
export const PROJECT_TAB_SEGMENTS = TABS.filter((t) => t.segment).map((t) => t.segment);

export function projectTabLabel(segment: string): string | null {
  return TABS.find((t) => t.segment === segment && segment !== "")?.label ?? null;
}

/** Tabs a role may see. The API still enforces access; this only hides what can't be used. */
export function projectTabsFor(role: Role, project: Project): ProjectTab[] {
  const money = role !== "worker" && role !== "client" && hasBudgetFields(project);
  const staffOnly = role === "head" || role === "manager";
  return TABS.filter((t) => {
    if (t.key === "workers" || t.key === "rooms" || t.key === "client-access") return staffOnly;
    if (t.key === "budget" || t.key === "settlements") return money;
    return true;
  }).map((t) => ({
    key: t.key,
    label: t.label,
    href: t.segment ? `/app/projects/${project.id}/${t.segment}` : `/app/projects/${project.id}`,
  }));
}

export type ProjectStatusFilter = "all" | "active" | "completed";
export type ProjectFilters = { q: string; status: ProjectStatusFilter };

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export function parseProjectFilters(params: Record<string, string | string[] | undefined>): ProjectFilters {
  const q = (first(params.q) ?? "").trim().slice(0, 100);
  const s = first(params.status);
  const status: ProjectStatusFilter = s === "active" || s === "completed" ? s : "all";
  return { q, status };
}

export function filterProjects(projects: Project[], { q, status }: ProjectFilters): Project[] {
  const needle = q.toLowerCase();
  return projects.filter((p) => {
    if (status === "active" && p.isComplete) return false;
    if (status === "completed" && !p.isComplete) return false;
    if (!needle) return true;
    return [p.projectName, p.projectCode, p.clientName, p.location].some((field) =>
      (field ?? "").toLowerCase().includes(needle),
    );
  });
}

/** Today's date (YYYY-MM-DD) in IST, so "overdue" flips at Indian midnight. */
function istDateKey(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isOverdue(project: Project, now: Date): boolean {
  if (project.isComplete || !project.targetEndDate) return false;
  const target = project.targetEndDate.slice(0, 10);
  return target < istDateKey(now);
}
