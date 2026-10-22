import { describe, expect, it } from "vitest";
import type { Expense } from "@/lib/api/money";
import { UTF8_BOM } from "./csv";
import {
  DEFAULT_EXPENSE_FILTERS,
  DEFAULT_EXPENSE_SORT,
  addedByLabel,
  expenseFilterParams,
  expensesCsv,
  filterExpenses,
  hasActiveExpenseFilters,
  parseExpenseFilters,
  parseExpenseSort,
  summarizeExpenses,
} from "./expense-ledger";

const NOW = new Date("2026-10-14T04:30:00Z");

function expense(partial: Partial<Expense> & Pick<Expense, "id">): Expense {
  return {
    type: "debit",
    amount: 100,
    date: "2026-10-01",
    category: "material",
    paymentMethod: "",
    accountDetails: "",
    proofUrl: null,
    createdBy: null,
    createdByName: null,
    createdAt: "2026-10-01T05:00:00Z",
    ...partial,
  };
}

const ROWS: Expense[] = [
  expense({ id: "a", type: "debit", amount: 1000.1, date: "2026-09-20", category: "material" }),
  expense({ id: "b", type: "debit", amount: 2000.2, date: "2026-10-02", category: "labour" }),
  expense({ id: "c", type: "credit", amount: 50000, date: "2026-10-05", category: "other" }),
  expense({ id: "d", type: "debit", amount: 300, date: "2026-10-10", category: "transport" }),
  expense({ id: "e", type: "credit", amount: 0.3, date: "2025-12-31", category: "other" }),
];

const q = (s: string) => new URLSearchParams(s);
const ids = (rows: Expense[]) => rows.map((r) => r.id);

describe("parseExpenseFilters", () => {
  it("defaults to everything", () => {
    expect(parseExpenseFilters(q(""))).toEqual(DEFAULT_EXPENSE_FILTERS);
  });

  it("reads type, category and date range", () => {
    expect(parseExpenseFilters(q("type=income&category=labour&range=this-month"))).toEqual({
      type: "income",
      category: "labour",
      range: { preset: "this-month", from: null, to: null },
    });
  });

  it("ignores unknown values instead of failing", () => {
    expect(parseExpenseFilters(q("type=refund&category=food"))).toEqual(DEFAULT_EXPENSE_FILTERS);
  });
});

describe("expenseFilterParams", () => {
  it("omits defaults so clean URLs stay clean", () => {
    expect(expenseFilterParams(DEFAULT_EXPENSE_FILTERS, DEFAULT_EXPENSE_SORT)).toEqual({
      type: null,
      category: null,
      range: null,
      from: null,
      to: null,
      sort: null,
    });
  });

  it("round-trips filters and sort through the URL", () => {
    const filters = {
      type: "expense" as const,
      category: "transport" as const,
      range: { preset: "custom" as const, from: "2026-10-01", to: "2026-10-31" },
    };
    const sort = { id: "amount", desc: false };
    const p = expenseFilterParams(filters, sort);
    const qs = new URLSearchParams(Object.entries(p).filter((e): e is [string, string] => e[1] !== null));
    expect(parseExpenseFilters(qs)).toEqual(filters);
    expect(parseExpenseSort(qs)).toEqual(sort);
  });
});

describe("parseExpenseSort", () => {
  it("defaults to newest first", () => {
    expect(parseExpenseSort(q(""))).toEqual({ id: "date", desc: true });
  });

  it("reads column.direction and rejects unknown columns", () => {
    expect(parseExpenseSort(q("sort=amount.asc"))).toEqual({ id: "amount", desc: false });
    expect(parseExpenseSort(q("sort=category.desc"))).toEqual({ id: "category", desc: true });
    expect(parseExpenseSort(q("sort=password.asc"))).toEqual(DEFAULT_EXPENSE_SORT);
    expect(parseExpenseSort(q("sort=amount"))).toEqual({ id: "amount", desc: false });
  });
});

describe("filterExpenses → summarizeExpenses", () => {
  it("returns everything with no filters", () => {
    expect(ids(filterExpenses(ROWS, DEFAULT_EXPENSE_FILTERS, NOW))).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("filters by type", () => {
    const income = filterExpenses(ROWS, { ...DEFAULT_EXPENSE_FILTERS, type: "income" }, NOW);
    expect(ids(income)).toEqual(["c", "e"]);
    const spent = filterExpenses(ROWS, { ...DEFAULT_EXPENSE_FILTERS, type: "expense" }, NOW);
    expect(ids(spent)).toEqual(["a", "b", "d"]);
  });

  it("filters by category", () => {
    const rows = filterExpenses(ROWS, { ...DEFAULT_EXPENSE_FILTERS, category: "labour" }, NOW);
    expect(ids(rows)).toEqual(["b"]);
  });

  it("filters by date range preset", () => {
    const rows = filterExpenses(
      ROWS,
      { ...DEFAULT_EXPENSE_FILTERS, range: { preset: "this-month", from: null, to: null } },
      NOW,
    );
    expect(ids(rows)).toEqual(["b", "c", "d"]);
  });

  it("combines filters", () => {
    const rows = filterExpenses(
      ROWS,
      { type: "expense", category: "all", range: { preset: "custom", from: "2026-10-01", to: "2026-10-05" } },
      NOW,
    );
    expect(ids(rows)).toEqual(["b"]);
  });

  it("totals spent and income separately, without float drift", () => {
    expect(summarizeExpenses(ROWS)).toEqual({
      count: 5,
      expenseCount: 3,
      incomeCount: 2,
      expenseTotal: 3300.3,
      incomeTotal: 50000.3,
    });
  });

  it("totals only the filtered rows", () => {
    const rows = filterExpenses(ROWS, { ...DEFAULT_EXPENSE_FILTERS, range: { preset: "this-month", from: null, to: null } }, NOW);
    expect(summarizeExpenses(rows)).toEqual({
      count: 3,
      expenseCount: 2,
      incomeCount: 1,
      expenseTotal: 2300.2,
      incomeTotal: 50000,
    });
  });

  it("totals nothing for an empty list", () => {
    expect(summarizeExpenses([])).toEqual({ count: 0, expenseCount: 0, incomeCount: 0, expenseTotal: 0, incomeTotal: 0 });
  });
});

describe("hasActiveExpenseFilters", () => {
  it("is false only for the defaults", () => {
    expect(hasActiveExpenseFilters(DEFAULT_EXPENSE_FILTERS)).toBe(false);
    expect(hasActiveExpenseFilters({ ...DEFAULT_EXPENSE_FILTERS, type: "income" })).toBe(true);
  });
});

describe("addedByLabel", () => {
  it("prefers the API name, then 'You', then a dash", () => {
    expect(addedByLabel(expense({ id: "x", createdBy: "u2", createdByName: "Asha" }), "u1")).toBe("Asha");
    expect(addedByLabel(expense({ id: "x", createdBy: "u1" }), "u1")).toBe("You");
    expect(addedByLabel(expense({ id: "x", createdBy: "u2" }), "u1")).toBe("—");
  });
});

describe("expensesCsv", () => {
  it("exports the given rows with plain-number amounts and names", () => {
    const rows = [
      expense({
        id: "a",
        date: "2026-10-02",
        type: "debit",
        category: "labour",
        amount: 15000,
        paymentMethod: "UPI",
        accountDetails: "Mason, week 2",
        proofUrl: "https://signed",
        createdBy: "u1",
      }),
      expense({ id: "b", date: "2026-10-05", type: "credit", category: "other", amount: 50000.5 }),
    ];
    const csv = expensesCsv(rows, { id: "u1", name: "Kalyan" });
    expect(csv).toBe(
      UTF8_BOM +
        "Date,Type,Category,Amount (₹),Payment method,Account details,Proof,Added by\r\n" +
        '2026-10-02,Expense,Labour,15000.00,UPI,"Mason, week 2",Attached,Kalyan\r\n' +
        "2026-10-05,Income,Other,50000.50,,,,\r\n",
    );
  });
});
