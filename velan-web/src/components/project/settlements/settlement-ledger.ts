/** Settlements ledger logic: URL filters → visible rows → totals → CSV. */

import { sumAmounts, type Settlement } from "@/lib/api/money";
import { toCsv, type CsvColumn } from "@/components/project/budget/csv";
import {
  ALL_DATES,
  dateRangeParams,
  inDateRange,
  parseDateRange,
  resolveDateRange,
  type DateRangeValue,
  type ParamsLike,
} from "@/components/project/budget/date-range";
import type { CurrentPerson } from "@/components/project/budget/expense-ledger";
import { parseSort, sortParam, type SortSpec } from "@/components/project/budget/sort";

export type SettlementFilters = { q: string; range: DateRangeValue };

export const DEFAULT_SETTLEMENT_FILTERS: SettlementFilters = { q: "", range: ALL_DATES };

export const SETTLEMENT_SORT_COLUMNS = ["date", "paidTo", "description", "mode", "amount", "proof", "createdBy"] as const;
export const DEFAULT_SETTLEMENT_SORT: SortSpec = { id: "date", desc: true };

const MAX_QUERY = 100;

export function parseSettlementFilters(params: ParamsLike): SettlementFilters {
  return { q: (params.get("q") ?? "").trim().slice(0, MAX_QUERY), range: parseDateRange(params) };
}

export function parseSettlementSort(params: ParamsLike): SortSpec {
  return parseSort(params, SETTLEMENT_SORT_COLUMNS, DEFAULT_SETTLEMENT_SORT);
}

export function settlementFilterParams(filters: SettlementFilters, sort: SortSpec): Record<string, string | null> {
  const q = filters.q.trim();
  return { q: q || null, ...dateRangeParams(filters.range), sort: sortParam(sort, DEFAULT_SETTLEMENT_SORT) };
}

export function hasActiveSettlementFilters(filters: SettlementFilters): boolean {
  return filters.q.trim() !== "" || filters.range.preset !== "all";
}

export function filterSettlements(
  rows: readonly Settlement[],
  filters: SettlementFilters,
  now: Date = new Date(),
): Settlement[] {
  const bounds = resolveDateRange(filters.range, now);
  const needle = filters.q.trim().toLowerCase();
  return rows.filter(
    (r) =>
      inDateRange(r.date, bounds) &&
      (!needle || [r.paidTo, r.description, r.mode].some((f) => f.toLowerCase().includes(needle))),
  );
}

export function summarizeSettlements(rows: readonly Settlement[]): { count: number; total: number } {
  return { count: rows.length, total: sumAmounts(rows.map((r) => r.amount)) };
}

/** "Created by": the API's name, "You" for the viewer, else a dash. */
export function createdByLabel(row: Pick<Settlement, "createdBy" | "createdByName">, currentUserId: string | null): string {
  if (row.createdByName) return row.createdByName;
  if (row.createdBy && row.createdBy === currentUserId) return "You";
  return "—";
}

export function settlementsCsv(rows: readonly Settlement[], me: CurrentPerson | null): string {
  const columns: CsvColumn<Settlement>[] = [
    { header: "Date", value: (r) => r.date },
    { header: "Paid to", value: (r) => r.paidTo },
    { header: "Description", value: (r) => r.description },
    { header: "Mode", value: (r) => r.mode },
    { header: "Amount (₹)", value: (r) => r.amount, money: true },
    { header: "Proof", value: (r) => (r.proofUrl ? "Attached" : "") },
    { header: "Created by", value: (r) => r.createdByName ?? (me && r.createdBy === me.id ? me.name : "") },
  ];
  return toCsv(columns, rows);
}
