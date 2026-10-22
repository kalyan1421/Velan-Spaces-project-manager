/**
 * Expenses & income ledger logic: URL filters → visible rows → totals → CSV.
 * Pure (no React) so it is unit-tested and shared by the table and the export.
 */

import {
  EXPENSE_TYPE_LABELS,
  categoryLabel,
  isExpenseCategory,
  sumAmounts,
  type Expense,
  type ExpenseCategory,
} from "@/lib/api/money";
import { toCsv, type CsvColumn } from "./csv";
import {
  ALL_DATES,
  dateRangeParams,
  inDateRange,
  parseDateRange,
  resolveDateRange,
  type DateRangeValue,
  type ParamsLike,
} from "./date-range";
import { parseSort, sortParam, type SortSpec } from "./sort";

export type ExpenseTypeFilter = "all" | "expense" | "income";

export type ExpenseFilters = {
  type: ExpenseTypeFilter;
  category: ExpenseCategory | "all";
  range: DateRangeValue;
};

export const DEFAULT_EXPENSE_FILTERS: ExpenseFilters = { type: "all", category: "all", range: ALL_DATES };

/** Sortable column ids (also the TanStack column ids). */
export const EXPENSE_SORT_COLUMNS = [
  "date",
  "type",
  "category",
  "amount",
  "paymentMethod",
  "accountDetails",
  "proof",
  "addedBy",
] as const;

export const DEFAULT_EXPENSE_SORT: SortSpec = { id: "date", desc: true };

export function parseExpenseFilters(params: ParamsLike): ExpenseFilters {
  const type = params.get("type");
  const category = params.get("category");
  return {
    type: type === "expense" || type === "income" ? type : "all",
    category: isExpenseCategory(category) ? category : "all",
    range: parseDateRange(params),
  };
}

export function parseExpenseSort(params: ParamsLike): SortSpec {
  return parseSort(params, EXPENSE_SORT_COLUMNS, DEFAULT_EXPENSE_SORT);
}

/** URL entries for the current view; `null` removes a param. */
export function expenseFilterParams(filters: ExpenseFilters, sort: SortSpec): Record<string, string | null> {
  return {
    type: filters.type === "all" ? null : filters.type,
    category: filters.category === "all" ? null : filters.category,
    ...dateRangeParams(filters.range),
    sort: sortParam(sort, DEFAULT_EXPENSE_SORT),
  };
}

export function hasActiveExpenseFilters(filters: ExpenseFilters): boolean {
  return filters.type !== "all" || filters.category !== "all" || filters.range.preset !== "all";
}

export function filterExpenses(rows: readonly Expense[], filters: ExpenseFilters, now: Date = new Date()): Expense[] {
  const bounds = resolveDateRange(filters.range, now);
  const wantType = filters.type === "expense" ? "debit" : filters.type === "income" ? "credit" : null;
  return rows.filter(
    (r) =>
      (wantType === null || r.type === wantType) &&
      (filters.category === "all" || r.category === filters.category) &&
      inDateRange(r.date, bounds),
  );
}

export type ExpenseTotals = {
  count: number;
  expenseCount: number;
  incomeCount: number;
  /** Money spent (debits). */
  expenseTotal: number;
  /** Money received (credits). Never netted against spend. */
  incomeTotal: number;
};

export function summarizeExpenses(rows: readonly Expense[]): ExpenseTotals {
  const spent = rows.filter((r) => r.type === "debit");
  const income = rows.filter((r) => r.type === "credit");
  return {
    count: rows.length,
    expenseCount: spent.length,
    incomeCount: income.length,
    expenseTotal: sumAmounts(spent.map((r) => r.amount)),
    incomeTotal: sumAmounts(income.map((r) => r.amount)),
  };
}

/** "Added by" text: the API's name when sent, "You" for the viewer, else a dash. */
export function addedByLabel(row: Pick<Expense, "createdBy" | "createdByName">, currentUserId: string | null): string {
  if (row.createdByName) return row.createdByName;
  if (row.createdBy && row.createdBy === currentUserId) return "You";
  return "—";
}

export type CurrentPerson = { id: string; name: string };

/** CSV of the given (already filtered and sorted) rows. */
export function expensesCsv(rows: readonly Expense[], me: CurrentPerson | null): string {
  const columns: CsvColumn<Expense>[] = [
    { header: "Date", value: (r) => r.date },
    { header: "Type", value: (r) => EXPENSE_TYPE_LABELS[r.type] },
    { header: "Category", value: (r) => categoryLabel(r.category) },
    { header: "Amount (₹)", value: (r) => r.amount, money: true },
    { header: "Payment method", value: (r) => r.paymentMethod },
    { header: "Account details", value: (r) => r.accountDetails },
    // Signed proof URLs expire within the hour, so the export only says whether one exists.
    { header: "Proof", value: (r) => (r.proofUrl ? "Attached" : "") },
    {
      header: "Added by",
      value: (r) => r.createdByName ?? (me && r.createdBy === me.id ? me.name : ""),
    },
  ];
  return toCsv(columns, rows);
}
