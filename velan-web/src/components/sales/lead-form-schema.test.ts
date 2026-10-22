import { describe, expect, it } from "vitest";
import type { Lead } from "@/lib/api/sales-types";
import {
  leadFormDefaults,
  leadFormSchema,
  phoneProblem,
  toLeadInput,
  toLeadPatch,
  type LeadFormValues,
} from "./lead-form-schema";

const valid: LeadFormValues = {
  clientName: "  Asha Raman ",
  clientPhone: "+91 98765 43210",
  area: "Adyar, Chennai",
  projectType: "3BHK full home",
  source: "instagram",
  estimatedBudget: "10-15 L",
  notes: "Wants a site visit next week",
  status: "new",
  assignedManagerId: "",
};

function errorsFor(values: LeadFormValues) {
  const r = leadFormSchema.safeParse(values);
  return r.success ? {} : r.error.flatten().fieldErrors;
}

const lead: Lead = {
  id: "11111111-1111-4111-8111-111111111111",
  clientName: "Asha",
  clientPhone: "9876543210",
  area: null,
  projectType: "Kitchen",
  source: "justdial",
  estimatedBudget: null,
  notes: "Old note",
  status: "contacted",
  assignedManagerId: "22222222-2222-4222-8222-222222222222",
  createdAt: "2026-10-01T05:00:00Z",
};

describe("leadFormSchema", () => {
  it("accepts a full lead and trims text", () => {
    const r = leadFormSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.clientName).toBe("Asha Raman");
  });

  it("requires a name", () => {
    expect(errorsFor({ ...valid, clientName: "   " }).clientName?.[0]).toMatch(/name/i);
  });

  it("validates phone numbers loosely", () => {
    expect(phoneProblem("")).toBeNull();
    expect(phoneProblem("98765 43210")).toBeNull();
    expect(phoneProblem("044-2441 1234")).toBeNull();
    expect(phoneProblem("12345")).toMatch(/valid/);
    expect(phoneProblem("call me")).toMatch(/digits/);
    expect(errorsFor({ ...valid, clientPhone: "abc" }).clientPhone).toBeDefined();
  });

  it("only allows known statuses and sources", () => {
    expect(errorsFor({ ...valid, status: "maybe" as LeadFormValues["status"] }).status).toBeDefined();
    expect(errorsFor({ ...valid, source: "fax" as LeadFormValues["source"] }).source).toBeDefined();
    expect(errorsFor({ ...valid, source: "" })).toEqual({});
  });

  it("requires a real user id for the assignee", () => {
    expect(errorsFor({ ...valid, assignedManagerId: "bob" }).assignedManagerId).toBeDefined();
    expect(errorsFor({ ...valid, assignedManagerId: lead.assignedManagerId! })).toEqual({});
  });

  it("caps long notes", () => {
    expect(errorsFor({ ...valid, notes: "x".repeat(5001) }).notes?.[0]).toMatch(/5,000/);
  });
});

describe("lead bodies", () => {
  it("create omits empty optionals", () => {
    const out = leadFormSchema.parse({ ...valid, area: "", notes: "  ", source: "" });
    expect(toLeadInput(out)).toEqual({
      clientName: "Asha Raman",
      clientPhone: "+91 98765 43210",
      projectType: "3BHK full home",
      estimatedBudget: "10-15 L",
      status: "new",
    });
  });

  it("defaults map a lead (legacy source shown as Other)", () => {
    expect(leadFormDefaults(lead)).toEqual({
      clientName: "Asha",
      clientPhone: "9876543210",
      area: "",
      projectType: "Kitchen",
      source: "other",
      estimatedBudget: "",
      notes: "Old note",
      status: "contacted",
      assignedManagerId: lead.assignedManagerId,
    });
    expect(leadFormDefaults(null, { assignedManagerId: "me" }).assignedManagerId).toBe("me");
  });

  it("patch sends nulls to clear and keeps a legacy source", () => {
    const values = leadFormSchema.parse({ ...leadFormDefaults(lead), notes: "", assignedManagerId: "" });
    expect(toLeadPatch(values, lead)).toEqual({
      clientName: "Asha",
      clientPhone: "9876543210",
      area: null,
      projectType: "Kitchen",
      source: "justdial",
      estimatedBudget: null,
      notes: null,
      status: "contacted",
      assignedManagerId: null,
    });
    const changed = leadFormSchema.parse({ ...leadFormDefaults(lead), source: "referral" });
    expect(toLeadPatch(changed, lead).source).toBe("referral");
  });
});
