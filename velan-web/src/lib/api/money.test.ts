import { describe, expect, it } from "vitest";
import {
  MAX_AMOUNT,
  budgetPaths,
  categoryLabel,
  formatAmountInput,
  isValidDateKey,
  meterGeometry,
  normalizeExpense,
  normalizeSettlement,
  parseAmount,
  sumAmounts,
  toBudgetHealth,
  toDateKey,
  todayIST,
  type BudgetSummaryRow,
  type ExpenseRow,
  type SettlementRow,
} from "./money";

const PID = "5b91891e-1c5c-4f50-a8dc-f57c56d1458c";

describe("parseAmount", () => {
  it("accepts plain digits", () => {
    expect(parseAmount("1500")).toEqual({ ok: true, value: 1500 });
  });

  it("strips the rupee sign, Indian and western grouping commas and spaces", () => {
    expect(parseAmount("₹15,00,000")).toEqual({ ok: true, value: 1_500_000 });
    expect(parseAmount("₹ 1,500,000")).toEqual({ ok: true, value: 1_500_000 });
    expect(parseAmount("  2 500 ")).toEqual({ ok: true, value: 2500 });
    expect(parseAmount("12 000")).toEqual({ ok: true, value: 12000 });
  });

  it("accepts Rs / INR prefixes and the /- suffix used on Indian receipts", () => {
    expect(parseAmount("Rs. 450")).toEqual({ ok: true, value: 450 });
    expect(parseAmount("INR 99.5")).toEqual({ ok: true, value: 99.5 });
    expect(parseAmount("₹500/-")).toEqual({ ok: true, value: 500 });
  });

  it("accepts up to two decimal places", () => {
    expect(parseAmount("1,234.56")).toEqual({ ok: true, value: 1234.56 });
    expect(parseAmount("0.01")).toEqual({ ok: true, value: 0.01 });
    expect(parseAmount(".5")).toEqual({ ok: true, value: 0.5 });
    expect(parseAmount("10.")).toEqual({ ok: true, value: 10 });
  });

  it("rejects more than two decimal places", () => {
    const r = parseAmount("10.005");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/2 decimal/);
  });

  it("rejects empty input", () => {
    const r = parseAmount("   ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/enter an amount/i);
  });

  it("rejects zero and negative amounts", () => {
    expect(parseAmount("0").ok).toBe(false);
    expect(parseAmount("0.00").ok).toBe(false);
    const neg = parseAmount("-50");
    expect(neg.ok).toBe(false);
    if (!neg.ok) expect(neg.error).toMatch(/more than ₹0/);
  });

  it("rejects text that isn't a number", () => {
    for (const bad of ["abc", "12abc", "1.2.3", "₹", "1e5", "Infinity", "0x10"]) {
      expect(parseAmount(bad).ok, bad).toBe(false);
    }
  });

  it("enforces the API's numeric(14,2) upper bound", () => {
    expect(parseAmount(String(MAX_AMOUNT))).toEqual({ ok: true, value: MAX_AMOUNT });
    const r = parseAmount("1000000000000");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/can't exceed/);
  });

  it("accepts finite numbers directly", () => {
    expect(parseAmount(250.5)).toEqual({ ok: true, value: 250.5 });
    expect(parseAmount(0.1 + 0.2)).toEqual({ ok: true, value: 0.3 });
    expect(parseAmount(1.005).ok).toBe(false);
    expect(parseAmount(Number.NaN).ok).toBe(false);
  });
});

describe("sumAmounts", () => {
  it("adds money without float drift", () => {
    expect(sumAmounts([0.1, 0.2])).toBe(0.3);
    expect(sumAmounts([1999.99, 0.01, 100])).toBe(2100);
    expect(sumAmounts([])).toBe(0);
  });
});

describe("formatAmountInput", () => {
  it("groups the Indian way without the symbol", () => {
    expect(formatAmountInput(1_500_000)).toBe("15,00,000");
    expect(formatAmountInput(999)).toBe("999");
  });

  it("shows paise only when present", () => {
    expect(formatAmountInput(1500.5)).toBe("1,500.50");
    expect(formatAmountInput(1500)).toBe("1,500");
  });

  it("round-trips through parseAmount", () => {
    const n = 12_34_567.89;
    expect(parseAmount(formatAmountInput(n))).toEqual({ ok: true, value: n });
  });
});

describe("ledger dates", () => {
  it("todayIST flips at Indian midnight, not UTC midnight", () => {
    // 2026-10-14 19:00 UTC = 2026-10-15 00:30 IST
    expect(todayIST(new Date("2026-10-14T19:00:00Z"))).toBe("2026-10-15");
    expect(todayIST(new Date("2026-10-14T18:00:00Z"))).toBe("2026-10-14");
  });

  it("validates yyyy-mm-dd keys including real calendar days", () => {
    expect(isValidDateKey("2026-02-28")).toBe(true);
    expect(isValidDateKey("2028-02-29")).toBe(true);
    expect(isValidDateKey("2026-02-29")).toBe(false);
    expect(isValidDateKey("2026-13-01")).toBe(false);
    expect(isValidDateKey("14-10-2026")).toBe(false);
    expect(isValidDateKey("")).toBe(false);
    expect(isValidDateKey(null)).toBe(false);
  });

  it("toDateKey keeps date-only values and converts timestamps to the IST day", () => {
    expect(toDateKey("2026-10-14")).toBe("2026-10-14");
    expect(toDateKey("2026-10-14T20:00:00Z")).toBe("2026-10-15");
    expect(toDateKey(null)).toBe("");
    expect(toDateKey("garbage")).toBe("");
  });
});

describe("normalizeExpense", () => {
  const row: ExpenseRow = {
    id: "e1",
    projectId: PID,
    type: "debit",
    amount: "15000.50",
    expenseDate: "2026-10-01",
    category: "material",
    paymentMethod: " UPI ",
    accountDetails: null,
    proofUrl: "https://x.supabase.co/storage/v1/object/sign/project-files/a.jpg?token=t",
    createdBy: "u1",
    createdAt: "2026-10-01T10:00:00Z",
  };

  it("parses numeric strings and trims text", () => {
    const e = normalizeExpense(row);
    expect(e.amount).toBe(15000.5);
    expect(e.paymentMethod).toBe("UPI");
    expect(e.accountDetails).toBe("");
    expect(e.date).toBe("2026-10-01");
    expect(e.type).toBe("debit");
  });

  it("treats anything but 'credit' as money spent", () => {
    expect(normalizeExpense({ ...row, type: "credit" }).type).toBe("credit");
    expect(normalizeExpense({ ...row, type: "weird" }).type).toBe("debit");
  });

  it("falls back to the creation day (IST) when a legacy row has no date", () => {
    expect(normalizeExpense({ ...row, expenseDate: null, createdAt: "2026-10-01T20:00:00Z" }).date).toBe("2026-10-02");
  });

  it("defaults a blank category to other and keeps createdByName when the API adds it", () => {
    const e = normalizeExpense({ ...row, category: "", createdByName: "Asha" });
    expect(e.category).toBe("other");
    expect(e.createdByName).toBe("Asha");
  });
});

describe("normalizeSettlement", () => {
  it("maps the API row", () => {
    const row: SettlementRow = {
      id: "s1",
      projectId: PID,
      description: "Advance",
      amount: 2500,
      settlementDate: "2026-09-30",
      paidToName: "Ravi Tiles",
      mode: "Bank transfer",
      proofUrl: null,
      createdBy: "u1",
      createdByName: "Kalyan",
      createdAt: "2026-09-30T05:00:00Z",
    };
    expect(normalizeSettlement(row)).toEqual({
      id: "s1",
      amount: 2500,
      date: "2026-09-30",
      paidTo: "Ravi Tiles",
      description: "Advance",
      mode: "Bank transfer",
      proofUrl: null,
      createdBy: "u1",
      createdByName: "Kalyan",
      createdAt: "2026-09-30T05:00:00Z",
    });
  });
});

describe("categoryLabel", () => {
  it("labels known categories and title-cases legacy ones", () => {
    expect(categoryLabel("labour")).toBe("Labour");
    expect(categoryLabel("electrical_work")).toBe("Electrical work");
    expect(categoryLabel("")).toBe("Other");
  });
});

describe("toBudgetHealth (summary mapping)", () => {
  const base: BudgetSummaryRow = {
    budget: "1000000",
    estimatedCost: "900000",
    settlementsTotal: "300000",
    expenseTotal: "200000",
    incomeTotal: "400000",
    currentSpend: "500000",
    remaining: "500000",
  };

  it("maps money strings to numbers", () => {
    const h = toBudgetHealth(base);
    expect(h).toMatchObject({
      budget: 1_000_000,
      estimatedCost: 900_000,
      spent: 500_000,
      remaining: 500_000,
      settlementsTotal: 300_000,
      expenseTotal: 200_000,
      incomeTotal: 400_000,
      overBy: 0,
      usedPercent: 50,
      status: "on-track",
    });
  });

  it("never subtracts income from spend", () => {
    const h = toBudgetHealth({ ...base, incomeTotal: "900000" });
    expect(h.spent).toBe(500_000);
    expect(h.remaining).toBe(500_000);
  });

  it("flags over budget when remaining is negative", () => {
    const h = toBudgetHealth({ ...base, currentSpend: "1200000", remaining: "-200000" });
    expect(h.status).toBe("over-budget");
    expect(h.remaining).toBe(-200_000);
    expect(h.overBy).toBe(200_000);
    expect(h.usedPercent).toBe(120);
  });

  it("warns when 85% or more is used", () => {
    expect(toBudgetHealth({ ...base, currentSpend: "849999", remaining: "150001" }).status).toBe("on-track");
    expect(toBudgetHealth({ ...base, currentSpend: "850000", remaining: "150000" }).status).toBe("near-limit");
    expect(toBudgetHealth({ ...base, currentSpend: "1000000", remaining: "0" }).status).toBe("near-limit");
  });

  it("reports no budget instead of 'over budget' when the budget is unset", () => {
    const h = toBudgetHealth({ ...base, budget: 0, currentSpend: 5000, remaining: -5000 });
    expect(h.status).toBe("no-budget");
    expect(h.usedPercent).toBeNull();
    expect(h.overBy).toBe(0);
  });

  it("computes remaining when the API omits it", () => {
    const { remaining: _omit, ...rest } = base;
    void _omit;
    expect(toBudgetHealth(rest as BudgetSummaryRow).remaining).toBe(500_000);
  });
});

describe("meterGeometry", () => {
  it("scales to the budget when under budget", () => {
    const g = meterGeometry({ budget: 1000, spent: 250 });
    expect(g).toEqual({ fillPercent: 25, budgetMarkPercent: 100 });
  });

  it("scales to spend when over budget so the budget line sits inside the bar", () => {
    const g = meterGeometry({ budget: 1000, spent: 1250 });
    expect(g.fillPercent).toBe(100);
    expect(g.budgetMarkPercent).toBe(80);
  });

  it("is empty when there is nothing to show", () => {
    expect(meterGeometry({ budget: 0, spent: 0 })).toEqual({ fillPercent: 0, budgetMarkPercent: null });
  });
});

describe("budgetPaths", () => {
  it("builds the §9 contract routes (never budget/transactions)", () => {
    expect(budgetPaths.summary(PID)).toBe(`projects/${PID}/budget/summary`);
    expect(budgetPaths.expenses(PID)).toBe(`projects/${PID}/expenses`);
    expect(budgetPaths.expense(PID, "e1")).toBe(`projects/${PID}/expenses/e1`);
    expect(budgetPaths.settlements(PID)).toBe(`projects/${PID}/settlements`);
    expect(budgetPaths.settlement(PID, "s1")).toBe(`projects/${PID}/settlements/s1`);
    expect(Object.values(budgetPaths).map((f) => f(PID, "x")).join(" ")).not.toContain("transactions");
  });
});
