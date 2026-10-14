/**
 * Date-range filter shared by the Budget and Settlements tables.
 * Dates are `yyyy-mm-dd` keys; "today" is the Indian calendar day.
 * URL shape: `?range=<preset>` or `?range=custom&from=…&to=…`.
 */

import { isValidDateKey, todayIST } from "@/lib/api/money";
import { formatDate } from "@/lib/format";

export const DATE_PRESETS = [
  "all",
  "this-month",
  "last-month",
  "last-30-days",
  "last-90-days",
  "this-fy",
  "last-fy",
  "custom",
] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export const DATE_PRESET_LABELS: Record<DatePreset, string> = {
  all: "All dates",
  "this-month": "This month",
  "last-month": "Last month",
  "last-30-days": "Last 30 days",
  "last-90-days": "Last 90 days",
  "this-fy": "This financial year",
  "last-fy": "Last financial year",
  custom: "Custom range",
};

/** `from`/`to` are only meaningful for the custom preset. */
export type DateRangeValue = { preset: DatePreset; from: string | null; to: string | null };
export type DateBounds = { from: string | null; to: string | null };

export const ALL_DATES: DateRangeValue = { preset: "all", from: null, to: null };

/** Anything with `get` — URLSearchParams or Next's ReadonlyURLSearchParams. */
export type ParamsLike = { get(name: string): string | null };

function isPreset(value: unknown): value is DatePreset {
  return typeof value === "string" && (DATE_PRESETS as readonly string[]).includes(value);
}

export function parseDateRange(params: ParamsLike): DateRangeValue {
  const raw = params.get("range");
  const from = isValidDateKey(params.get("from")) ? params.get("from") : null;
  const to = isValidDateKey(params.get("to")) ? params.get("to") : null;

  if (isPreset(raw) && raw !== "custom") return { preset: raw, from: null, to: null };
  // `custom`, a missing range or an unknown one: use whichever valid bounds exist.
  if (from || to) {
    if (from && to && from > to) return { preset: "custom", from: to, to: from };
    return { preset: "custom", from, to };
  }
  // An explicit custom range without dates yet keeps the inputs open.
  return raw === "custom" ? { preset: "custom", from: null, to: null } : ALL_DATES;
}

/** URL entries for a range; `null` means "remove the param". */
export function dateRangeParams(value: DateRangeValue): Record<"range" | "from" | "to", string | null> {
  if (value.preset === "all") return { range: null, from: null, to: null };
  if (value.preset !== "custom") return { range: value.preset, from: null, to: null };
  return { range: "custom", from: value.from, to: value.to };
}

function key(y: number, monthIndex: number, day: number): string {
  const d = new Date(Date.UTC(y, monthIndex, day));
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

/** Inclusive `yyyy-mm-dd` bounds for a range, computed from today's date in India. */
export function resolveDateRange(value: DateRangeValue, now: Date = new Date()): DateBounds {
  const [y, m, d] = todayIST(now).split("-").map(Number);
  const mi = m - 1;
  const fyStart = m >= 4 ? y : y - 1;

  switch (value.preset) {
    case "all":
      return { from: null, to: null };
    case "this-month":
      return { from: key(y, mi, 1), to: key(y, mi + 1, 0) };
    case "last-month":
      return { from: key(y, mi - 1, 1), to: key(y, mi, 0) };
    case "last-30-days":
      return { from: key(y, mi, d - 29), to: key(y, mi, d) };
    case "last-90-days":
      return { from: key(y, mi, d - 89), to: key(y, mi, d) };
    case "this-fy":
      return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31` };
    case "last-fy":
      return { from: `${fyStart - 1}-04-01`, to: `${fyStart}-03-31` };
    case "custom":
      return { from: value.from, to: value.to };
  }
}

/** Inclusive check on `yyyy-mm-dd` keys (they compare correctly as strings). */
export function inDateRange(dateKey: string, { from, to }: DateBounds): boolean {
  if (!from && !to) return true;
  if (!dateKey) return false;
  if (from && dateKey < from) return false;
  if (to && dateKey > to) return false;
  return true;
}

/** Human description, e.g. for table captions: "This month (01 Oct 2026 – 31 Oct 2026)". */
export function describeDateRange(value: DateRangeValue, now: Date = new Date()): string {
  if (value.preset === "all") return DATE_PRESET_LABELS.all;
  const { from, to } = resolveDateRange(value, now);
  const span =
    from && to ? `${formatDate(from)} – ${formatDate(to)}` : from ? `From ${formatDate(from)}` : to ? `Up to ${formatDate(to)}` : "";
  if (value.preset === "custom") return span || DATE_PRESET_LABELS.all;
  return `${DATE_PRESET_LABELS[value.preset]} (${span})`;
}
