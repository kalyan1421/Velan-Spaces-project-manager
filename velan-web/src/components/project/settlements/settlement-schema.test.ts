import { describe, expect, it } from "vitest";
import type { Settlement } from "@/lib/api/money";
import {
  settlementFormDefaults,
  settlementFormSchema,
  settlementPayload,
  type SettlementFormValues,
} from "./settlement-schema";

const valid: SettlementFormValues = {
  amount: "25,000",
  date: "2026-10-14",
  paidToName: "Ravi Tiles",
  description: "Advance for floor tiles",
  mode: "UPI",
};

function errorsFor(values: SettlementFormValues) {
  const r = settlementFormSchema.safeParse(values);
  return r.success ? {} : r.error.flatten().fieldErrors;
}

describe("settlementFormSchema", () => {
  it("accepts a complete settlement", () => {
    const r = settlementFormSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBe(25000);
  });

  it("requires who was paid", () => {
    expect(errorsFor({ ...valid, paidToName: "   " }).paidToName?.[0]).toMatch(/who was paid/i);
  });

  it("validates amount and date", () => {
    expect(errorsFor({ ...valid, amount: "-5" }).amount?.[0]).toMatch(/more than ₹0/);
    expect(errorsFor({ ...valid, date: "yesterday" }).date?.[0]).toMatch(/date/i);
  });

  it("enforces the API's text limits", () => {
    expect(errorsFor({ ...valid, paidToName: "x".repeat(201) }).paidToName?.[0]).toMatch(/200/);
    expect(errorsFor({ ...valid, mode: "x".repeat(61) }).mode?.[0]).toMatch(/60/);
    expect(errorsFor({ ...valid, description: "x".repeat(1001) }).description?.[0]).toMatch(/1,000/);
  });
});

describe("settlementFormDefaults", () => {
  it("starts empty and dated today", () => {
    expect(settlementFormDefaults(null, "2026-10-14")).toEqual({
      amount: "",
      date: "2026-10-14",
      paidToName: "",
      description: "",
      mode: "",
    });
  });

  it("fills an existing settlement", () => {
    const s: Settlement = {
      id: "s1",
      amount: 1200.45,
      date: "2026-10-03",
      paidTo: "Sri Electricals",
      description: "Wiring",
      mode: "Cash",
      proofUrl: null,
      createdBy: null,
      createdByName: null,
      createdAt: "2026-10-03T00:00:00Z",
    };
    expect(settlementFormDefaults(s, "2026-10-14")).toEqual({
      amount: "1,200.45",
      date: "2026-10-03",
      paidToName: "Sri Electricals",
      description: "Wiring",
      mode: "Cash",
    });
  });
});

describe("settlementPayload", () => {
  it("creates with trimmed fields and omits empty optionals", () => {
    const parsed = settlementFormSchema.parse({ ...valid, description: "  ", mode: "" });
    expect(settlementPayload(parsed, { kind: "keep" }, "create")).toEqual({
      amount: 25000,
      date: "2026-10-14",
      paidToName: "Ravi Tiles",
    });
  });

  it("updates with cleared text and proof changes", () => {
    const parsed = settlementFormSchema.parse({ ...valid, mode: "" });
    expect(settlementPayload(parsed, { kind: "remove" }, "update")).toEqual({
      amount: 25000,
      date: "2026-10-14",
      paidToName: "Ravi Tiles",
      description: "Advance for floor tiles",
      mode: "",
      proofUrl: "",
    });
    expect(settlementPayload(parsed, { kind: "upload", ref: "sb://project-files/x" }, "update").proofUrl).toBe(
      "sb://project-files/x",
    );
  });
});
