/**
 * Client-side CSV export (spec R-D17, pulled forward). Excel-friendly:
 * UTF-8 BOM (so "₹" renders), CRLF line endings, RFC 4180 quoting, money as
 * plain numbers with 2 decimals, and user text guarded against formula injection.
 */

export const UTF8_BOM = "﻿";

const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;
const FORMULA_START = /^[=+\-@\t\r]/;

/** A text cell: escaped, and prefixed with ' when a spreadsheet would treat it as a formula. */
export function csvText(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const guarded = FORMULA_START.test(value) ? `'${value}` : value;
  return NEEDS_QUOTES.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** A money cell: 1500000.00 — no symbol, no grouping, so spreadsheets can sum it. */
export function csvMoney(value: number): string {
  if (!Number.isFinite(value)) return "";
  return (Math.round(value * 100) / 100).toFixed(2);
}

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
  /** Write as a plain 2-decimal number instead of text. */
  money?: boolean;
};

export function toCsv<T>(columns: CsvColumn<T>[], rows: readonly T[]): string {
  const lines = [columns.map((c) => csvText(c.header)).join(",")];
  for (const row of rows) {
    lines.push(
      columns
        .map((c) => {
          const v = c.value(row);
          if (c.money) return typeof v === "number" ? csvMoney(v) : "";
          return csvText(v === null || v === undefined ? null : String(v));
        })
        .join(","),
    );
  }
  return `${UTF8_BOM}${lines.join("\r\n")}\r\n`;
}

/** `vs-001-expenses-2026-10-14.csv` */
export function csvFileName(parts: string[], dateKey: string): string {
  const slug = [...parts, dateKey]
    .map((p) =>
      p
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter(Boolean)
    .join("-");
  return `${slug || "export"}.csv`;
}

/** Browser-only: saves the CSV via a temporary object URL. */
export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
