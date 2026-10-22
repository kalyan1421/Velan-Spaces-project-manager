/** Leads pipeline: URL filters, search, counts and display helpers (pure). */

import { LEAD_SOURCES, LEAD_STATUSES, type Lead, type LeadStatus } from "@/lib/api/sales-types";

export type LeadStatusFilter = "all" | LeadStatus;
export type LeadSourceFilter = "all" | (typeof LEAD_SOURCES)[number];
export type LeadAssigneeFilter = "all" | "me" | "unassigned";

export type LeadFilters = {
  q: string;
  status: LeadStatusFilter;
  source: LeadSourceFilter;
  assignee: LeadAssigneeFilter;
};

type ParamsLike = { get(name: string): string | null };

export function parseLeadFilters(params: ParamsLike): LeadFilters {
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const s = params.get("status");
  const src = params.get("source");
  const a = params.get("assignee");
  return {
    q,
    status: s && (LEAD_STATUSES as readonly string[]).includes(s) ? (s as LeadStatus) : "all",
    source: src && (LEAD_SOURCES as readonly string[]).includes(src) ? (src as LeadSourceFilter) : "all",
    assignee: a === "me" || a === "unassigned" ? a : "all",
  };
}

const KNOWN_SOURCES = new Set<string>(LEAD_SOURCES.filter((s) => s !== "other"));

/** "other" also matches legacy/unknown sources and blanks. */
function sourceMatches(lead: Lead, source: LeadSourceFilter): boolean {
  if (source === "all") return true;
  const value = (lead.source ?? "").toLowerCase();
  if (source === "other") return !KNOWN_SOURCES.has(value);
  return value === source;
}

const digits = (s: string) => s.replace(/\D/g, "");

/** Filters other than status (the status tabs show counts for this subset). */
export function filterLeadsExceptStatus(leads: Lead[], filters: LeadFilters, meId: string): Lead[] {
  const needle = filters.q.toLowerCase();
  const needleDigits = digits(filters.q);
  return leads.filter((lead) => {
    if (!sourceMatches(lead, filters.source)) return false;
    if (filters.assignee === "me" && lead.assignedManagerId !== meId) return false;
    if (filters.assignee === "unassigned" && lead.assignedManagerId) return false;
    if (!needle) return true;
    const text = [lead.clientName, lead.area, lead.projectType, lead.estimatedBudget, lead.notes]
      .some((f) => (f ?? "").toLowerCase().includes(needle));
    const phone = needleDigits.length >= 3 && digits(lead.clientPhone ?? "").includes(needleDigits);
    return text || phone;
  });
}

export function filterLeads(leads: Lead[], filters: LeadFilters, meId: string): Lead[] {
  return filterLeadsExceptStatus(leads, filters, meId).filter(
    (lead) => filters.status === "all" || lead.status === filters.status,
  );
}

export function countByStatus(leads: Lead[]): Record<LeadStatusFilter, number> {
  const counts = Object.fromEntries([["all", leads.length], ...LEAD_STATUSES.map((s) => [s, 0])]) as Record<
    LeadStatusFilter,
    number
  >;
  for (const lead of leads) {
    if ((LEAD_STATUSES as readonly string[]).includes(lead.status)) counts[lead.status as LeadStatus] += 1;
  }
  return counts;
}

/** Newest first; leads without a date sink to the bottom. */
export function sortLeads(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

/** An untouched website enquiry: highlighted in the pipeline. */
export function isFreshEnquiry(lead: Pick<Lead, "source" | "status">): boolean {
  return (lead.source ?? "").toLowerCase() === "website" && lead.status === "new";
}

export type Person = { id: string; name: string };

/** "You", the joined name, the staff list's name, or a neutral fallback. */
export function assigneeLabel(lead: Pick<Lead, "assignedManagerId" | "assignedManagerName">, people: Person[], meId: string): string | null {
  const id = lead.assignedManagerId;
  if (!id) return null;
  if (id === meId) return "You";
  return lead.assignedManagerName?.trim() || people.find((p) => p.id === id)?.name || "Another team member";
}

/** wa.me link for an Indian number (10 digits get the 91 country code). */
export function whatsappUrl(phone: string | null | undefined): string | null {
  const d = digits(phone ?? "");
  if (d.length < 10) return null;
  const full = d.length === 10 ? `91${d}` : d.replace(/^0+/, "");
  return `https://wa.me/${full}`;
}

export function telUrl(phone: string | null | undefined): string | null {
  const value = (phone ?? "").trim();
  if (!value) return null;
  return `tel:${value.replace(/[^\d+]/g, "")}`;
}
