import { describe, expect, it } from "vitest";
import { normalizeLead, type Lead } from "@/lib/api/sales-types";
import {
  assigneeLabel,
  countByStatus,
  filterLeads,
  filterLeadsExceptStatus,
  isFreshEnquiry,
  parseLeadFilters,
  sortLeads,
  telUrl,
  whatsappUrl,
  type LeadFilters,
} from "./lead-model";

const ME = "me-id";
const lead = (over: Partial<Lead>): Lead => normalizeLead({ id: "x", clientName: "X", status: "new", createdAt: "2026-10-01T00:00:00Z", ...over });

const leads: Lead[] = [
  lead({ id: "1", clientName: "Asha Raman", clientPhone: "+91 98765 43210", source: "website", status: "new", createdAt: "2026-10-20T00:00:00Z" }),
  lead({ id: "2", clientName: "Bala", area: "Adyar", source: "instagram", status: "contacted", assignedManagerId: ME, createdAt: "2026-10-21T00:00:00Z" }),
  lead({ id: "3", clientName: "Chitra", projectType: "Kitchen", source: "justdial", status: "won", assignedManagerId: "other" }),
  lead({ id: "4", clientName: "Dev", source: null, status: "legacy_stage" }),
];

const all: LeadFilters = { q: "", status: "all", source: "all", assignee: "all" };
const ids = (xs: Lead[]) => xs.map((l) => l.id);

describe("parseLeadFilters", () => {
  it("reads known values and ignores the rest", () => {
    const p = new URLSearchParams("q=%20asha%20&status=won&source=website&assignee=me");
    expect(parseLeadFilters(p)).toEqual({ q: "asha", status: "won", source: "website", assignee: "me" });
    expect(parseLeadFilters(new URLSearchParams("status=bogus&source=fax&assignee=x"))).toEqual(all);
  });
});

describe("filterLeads", () => {
  it("searches name, area, project type and phone digits", () => {
    expect(ids(filterLeads(leads, { ...all, q: "asha" }, ME))).toEqual(["1"]);
    expect(ids(filterLeads(leads, { ...all, q: "adyar" }, ME))).toEqual(["2"]);
    expect(ids(filterLeads(leads, { ...all, q: "kitchen" }, ME))).toEqual(["3"]);
    expect(ids(filterLeads(leads, { ...all, q: "98765" }, ME))).toEqual(["1"]);
  });

  it("filters by status, source and assignee", () => {
    expect(ids(filterLeads(leads, { ...all, status: "contacted" }, ME))).toEqual(["2"]);
    expect(ids(filterLeads(leads, { ...all, source: "website" }, ME))).toEqual(["1"]);
    // "Other" covers unknown and blank sources.
    expect(ids(filterLeads(leads, { ...all, source: "other" }, ME))).toEqual(["3", "4"]);
    expect(ids(filterLeads(leads, { ...all, assignee: "me" }, ME))).toEqual(["2"]);
    expect(ids(filterLeads(leads, { ...all, assignee: "unassigned" }, ME))).toEqual(["1", "4"]);
  });

  it("status tabs count the other filters' subset", () => {
    const subset = filterLeadsExceptStatus(leads, { ...all, status: "won", assignee: "unassigned" }, ME);
    const counts = countByStatus(subset);
    expect(counts.all).toBe(2);
    expect(counts.new).toBe(1);
    expect(counts.won).toBe(0);
  });
});

describe("display helpers", () => {
  it("sorts newest first", () => {
    expect(ids(sortLeads(leads))).toEqual(["2", "1", "3", "4"]);
  });

  it("highlights untouched website enquiries", () => {
    expect(isFreshEnquiry(leads[0])).toBe(true);
    expect(isFreshEnquiry({ source: "website", status: "contacted" })).toBe(false);
    expect(isFreshEnquiry({ source: "instagram", status: "new" })).toBe(false);
  });

  it("labels the assignee", () => {
    const people = [{ id: "other", name: "Meena" }];
    expect(assigneeLabel(leads[1], people, ME)).toBe("You");
    expect(assigneeLabel(leads[2], people, ME)).toBe("Meena");
    expect(assigneeLabel(leads[2], [], ME)).toBe("Another team member");
    expect(assigneeLabel({ assignedManagerId: "other", assignedManagerName: "Ravi" }, people, ME)).toBe("Ravi");
    expect(assigneeLabel(leads[0], people, ME)).toBeNull();
  });

  it("builds call and WhatsApp links", () => {
    expect(whatsappUrl("98765 43210")).toBe("https://wa.me/919876543210");
    expect(whatsappUrl("+91 98765 43210")).toBe("https://wa.me/919876543210");
    expect(whatsappUrl("12345")).toBeNull();
    expect(telUrl("+91 98765-43210")).toBe("tel:+919876543210");
    expect(telUrl("")).toBeNull();
  });
});
