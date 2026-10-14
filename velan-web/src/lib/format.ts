/**
 * The one place for Indian number/date formatting (R-A5).
 * ₹ with lakh/crore grouping, dates as DD MMM YYYY in Asia/Kolkata.
 */

export const TIME_ZONE = "Asia/Kolkata";
const DASH = "—";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parses numbers and numeric strings (Postgres `numeric` arrives as a string). */
export function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "string") {
    const cleaned = value.replace(/[,\s]/g, "");
    if (cleaned === "") return fallback;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const inrPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹15,00,000 — paise are shown only when the amount has them. */
export function formatINR(value: unknown): string {
  const n = toNumber(value);
  const hasPaise = Math.round(n * 100) % 100 !== 0;
  return (hasPaise ? inrPaise : inrWhole).format(n);
}

function trimDecimals(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** ₹15 L, ₹1.2 Cr. Below one lakh the full amount is shown. */
export function formatINRCompact(value: unknown): string {
  const n = toNumber(value);
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  if (abs < 1e5) return formatINR(n);

  const lakhs = Math.round((abs / 1e5) * 100) / 100;
  if (abs < 1e7 && lakhs < 100) return `${sign}₹${trimDecimals(lakhs)} L`;
  return `${sign}₹${trimDecimals(abs / 1e7)} Cr`;
}

/** 43% — clamped to 0..100. */
export function formatPercent(value: unknown): string {
  const n = Math.min(100, Math.max(0, toNumber(value)));
  return `${Math.round(n)}%`;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const istParts = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    if (value === "") return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function pad2(n: number | string): string {
  return String(n).padStart(2, "0");
}

type IstParts = { day: string; month: number; year: string; hour: string; minute: string; dayPeriod: string };

function partsInIst(d: Date): IstParts {
  const map: Record<string, string> = {};
  for (const p of istParts.formatToParts(d)) map[p.type] = p.value;
  return {
    day: pad2(map.day),
    month: Number(map.month),
    year: map.year,
    hour: map.hour,
    minute: map.minute,
    dayPeriod: (map.dayPeriod ?? "").toUpperCase(),
  };
}

/** 14 Oct 2026 (IST). Date-only strings (Postgres `date`) are shown as-is, never shifted. */
export function formatDate(value: unknown): string {
  if (typeof value === "string") {
    const m = DATE_ONLY.exec(value);
    if (m) {
      const month = Number(m[2]);
      if (month >= 1 && month <= 12) return `${m[3]} ${MONTHS[month - 1]} ${m[1]}`;
      return DASH;
    }
  }
  const d = toDate(value);
  if (!d) return DASH;
  const p = partsInIst(d);
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}`;
}

/** 14 Oct 2026, 3:00 PM (IST). */
export function formatDateTime(value: unknown): string {
  const d = toDate(value);
  if (!d) return DASH;
  const p = partsInIst(d);
  return `${p.day} ${MONTHS[p.month - 1]} ${p.year}, ${p.hour}:${p.minute} ${p.dayPeriod}`;
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "5 minutes ago", "yesterday"; falls back to the date after 30 days. */
export function formatRelative(value: unknown, now: Date = new Date()): string {
  const d = toDate(value);
  if (!d) return DASH;
  const seconds = Math.round((d.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(seconds);

  if (abs < 60) return "just now";
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), "hour");
  if (abs < 30 * 86_400) return relative.format(Math.round(seconds / 86_400), "day");
  return formatDate(d);
}
