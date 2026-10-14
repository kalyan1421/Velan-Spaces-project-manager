import { describe, expect, it } from "vitest";
import type { Expense } from "@/lib/api/money";
import { expenseFormDefaults, expenseFormSchema, expensePayload, type ExpenseFormValues } from "./expense-schema";

const valid: ExpenseFormValues = {
  type: "debit",
  amount: "₹15,000",
  date: "2026-10-14",
  category: "material",
  paymentMethod: "UPI",
  accountDetails: "",
};

function errorsFor(values: ExpenseFormValues) {
  const r = expenseFormSchema.safeParse(values);
  return r.success ? {} : r.error.flatten().fieldErrors;
}

describe("expenseFormSchema", () => {
  it("parses the amount to a number", () => {
    const r = expenseFormSchema.safeParse(valid);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.amount).toBe(15000);
  });

  it("rejects bad amounts with the parser's message", () => {
    expect(errorsFor({ ...valid, amount: "0" }).amount?.[0]).toMatch(/more than ₹0/);
    expect(errorsFor({ ...valid, amount: "12.345" }).amount?.[0]).toMatch(/2 decimal/);
    expect(errorsFor({ ...valid, amount: "" }).amount?.[0]).toMatch(/enter an amount/i);
  });

  it("requires a category for expenses but not for income", () => {
    expect(errorsFor({ ...valid, category: "" }).category?.[0]).toMatch(/category/i);
    expect(errorsFor({ ...valid, type: "credit", category: "" })).toEqual({});
  });

  it("requires a real date and allows future dates (the API does)", () => {
    expect(errorsFor({ ...valid, date: "" }).date?.[0]).toMatch(/date/i);
    expect(errorsFor({ ...valid, date: "2026-02-30" }).date?.[0]).toMatch(/date/i);
    expect(errorsFor({ ...valid, date: "2030-01-01" })).toEqual({});
  });

  it("enforces the API's text limits", () => {
    expect(errorsFor({ ...valid, paymentMethod: "x".repeat(61) }).paymentMethod?.[0]).toMatch(/60/);
    expect(errorsFor({ ...valid, accountDetails: "x".repeat(1001) }).accountDetails?.[0]).toMatch(/1,000/);
  });
});

describe("expenseFormDefaults", () => {
  it("starts a new entry as an expense dated today", () => {
    expect(expenseFormDefaults(null, "2026-10-14")).toEqual({
      type: "debit",
      amount: "",
      date: "2026-10-14",
      category: "",
      paymentMethod: "",
      accountDetails: "",
    });
  });

  it("fills an existing entry with a grouped amount", () => {
    const e: Expense = {
      id: "e1",
      type: "credit",
      amount: 150000.5,
      date: "2026-10-02",
      category: "other",
      paymentMethod: "Cheque",
      accountDetails: "HDFC 1234",
      proofUrl: null,
      createdBy: null,
      createdByName: null,
      createdAt: "2026-10-02T00:00:00Z",
    };
    expect(expenseFormDefaults(e, "2026-10-14")).toEqual({
      type: "credit",
      amount: "1,50,000.50",
      date: "2026-10-02",
      category: "other",
      paymentMethod: "Cheque",
      accountDetails: "HDFC 1234",
    });
  });

  it("blanks a legacy category the form can't show, so the user picks one", () => {
    const legacy: Expense = {
      id: "e2",
      type: "debit",
      amount: 10,
      date: "2026-10-02",
      category: "electrical_work",
      paymentMethod: "",
      accountDetails: "",
      proofUrl: null,
      createdBy: null,
      createdByName: null,
      createdAt: "2026-10-02T00:00:00Z",
    };
    expect(expenseFormDefaults(legacy, "2026-10-14").category).toBe("");
  });
});

describe("expensePayload", () => {
  const parsed = expenseFormSchema.parse(valid);

  it("creates with trimmed fields and omits empty optionals", () => {
    expect(expensePayload(expenseFormSchema.parse({ ...valid, paymentMethod: "  " }), { kind: "keep" }, "create")).toEqual({
      type: "debit",
      amount: 15000,
      date: "2026-10-14",
      category: "material",
    });
  });

  it("attaches a newly uploaded proof", () => {
    expect(expensePayload(parsed, { kind: "upload", ref: "sb://project-files/p" }, "create").proofUrl).toBe(
      "sb://project-files/p",
    );
  });

  it("lets income fall back to the API's default category", () => {
    const income = expenseFormSchema.parse({ ...valid, type: "credit", category: "" });
    expect(expensePayload(income, { kind: "keep" }, "create")).not.toHaveProperty("category");
  });

  it("on update sends cleared text as empty strings and leaves the proof alone unless changed", () => {
    const body = expensePayload(expenseFormSchema.parse({ ...valid, paymentMethod: "" }), { kind: "keep" }, "update");
    expect(body.paymentMethod).toBe("");
    expect(body.accountDetails).toBe("");
    expect(body).not.toHaveProperty("proofUrl");
  });

  it("on update clears a removed proof", () => {
    expect(expensePayload(parsed, { kind: "remove" }, "update").proofUrl).toBe("");
  });
});
