/**
 * Budget & settlements contract (WEB_APP_PLAN.md §9) — types, mapping and
 * money input rules shared by the staff app's Budget and Settlements tabs.
 *
 * Access: head, or a manager with budget access on the project; everyone else
 * gets 403. "Spent" = settlements + expense debits, computed by the server.
 * Income (expense credits) is reported, never subtracted. The legacy
 * `budget/transactions` endpoint is intentionally absent here.
 *
 * Isomorphic: safe to import from Server and Client Components.
 */

import { TIME_ZONE, toNumber } from "@/lib/format";
import type { Money } from "./types";

// ------------------------------------------------------------------ limits

/** numeric(14,2) bounds enforced by the API's DTOs. */
export const MIN_AMOUNT = 0.01;
export const MAX_AMOUNT = 999_999_999_999.99;

// ------------------------------------------------------------------ categories

export type ExpenseType = "debit" | "credit";

export const EXPENSE_CATEGORIES = ["material", "labour", "transport", "other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  material: "Material",
  labour: "Labour",
  transport: "Transport",
  other: "Other",
};

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === "string" && (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

/** Known categories get their label; legacy free-text ones are sentence-cased. */
export function categoryLabel(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return EXPENSE_CATEGORY_LABELS.other;
  if (isExpenseCategory(v)) return EXPENSE_CATEGORY_LABELS[v];
  const words = v.replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = { debit: "Expense", credit: "Income" };

/** Suggestions only — the API stores free text (max 60 chars). */
export const PAYMENT_METHOD_SUGGESTIONS = ["Cash", "UPI", "Bank transfer", "Cheque", "Card"] as const;

// ------------------------------------------------------------------ API rows (camelCase)

export type ExpenseRow = {
  id: string;
  projectId: string;
  /** 'debit' = money spent, 'credit' = income received. */
  type: ExpenseType | string;
  amount: Money;
  expenseDate: string | null;
  category: string | null;
  paymentMethod: string | null;
  accountDetails: string | null;
  /** Short-lived signed URL (the API signs `sb://` refs in responses). */
  proofUrl: string | null;
  createdBy: string | null;
  /** Not in the contract yet; used when the API starts sending it. */
  createdByName?: string | null;
  createdAt: string;
};

export type SettlementRow = {
  id: string;
  projectId: string;
  description: string | null;
  amount: Money;
  settlementDate: string | null;
  paidToName: string | null;
  mode: string | null;
  proofUrl: string | null;
  createdBy: string | null;
  createdByName?: string | null;
  createdAt: string;
};

export type BudgetSummaryRow = {
  budget: Money;
  estimatedCost: Money;
  settlementsTotal: Money;
  /** Expense debits only. */
  expenseTotal: Money;
  /** Expense credits (income received). */
  incomeTotal: Money;
  /** settlementsTotal + expenseTotal. */
  currentSpend: Money;
  /** budget − currentSpend; negative = over budget. */
  remaining?: Money | null;
};

export type ExpenseBody = {
  type?: ExpenseType;
  amount?: number;
  date?: string;
  category?: ExpenseCategory;
  paymentMethod?: string;
  accountDetails?: string;
  /** `sb://project-files/<path>` to set, "" to clear. */
  proofUrl?: string;
};

export type SettlementBody = {
  amount?: number;
  date?: string;
  paidToName?: string;
  description?: string;
  mode?: string;
  proofUrl?: string;
};

// ------------------------------------------------------------------ endpoints

export const budgetPaths = {
  summary: (projectId: string) => `projects/${projectId}/budget/summary`,
  expenses: (projectId: string) => `projects/${projectId}/expenses`,
  expense: (projectId: string, id: string) => `projects/${projectId}/expenses/${id}`,
  settlements: (projectId: string) => `projects/${projectId}/settlements`,
  settlement: (projectId: string, id: string) => `projects/${projectId}/settlements/${id}`,
} as const;

/** Upload areas under `projects/<id>/` for proofs (bucket `project-files`). */
export const PROOF_BUCKET = "project-files" as const;
export const PROOF_AREAS = { expense: "expense_proofs", settlement: "settlement_proofs" } as const;

// ------------------------------------------------------------------ dates (yyyy-mm-dd, IST)

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

const istDateKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's date as `yyyy-mm-dd` in India, so "today" flips at Indian midnight. */
export function todayIST(now: Date = new Date()): string {
  return istDateKey.format(now);
}

/** True for real calendar days written as `yyyy-mm-dd`. */
export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_KEY.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Date-only strings pass through; timestamps become their IST day; anything else is "". */
export function toDateKey(value: unknown): string {
  if (typeof value !== "string" || value === "") return "";
  if (isValidDateKey(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : todayIST(d);
}

// ------------------------------------------------------------------ normalized rows

export type Expense = {
  id: string;
  type: ExpenseType;
  amount: number;
  /** `yyyy-mm-dd`; legacy rows without a date use their creation day. */
  date: string;
  category: string;
  paymentMethod: string;
  accountDetails: string;
  proofUrl: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
};

export type Settlement = {
  id: string;
  amount: number;
  date: string;
  paidTo: string;
  description: string;
  mode: string;
  proofUrl: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
};

const text = (v: string | null | undefined) => (v ?? "").trim();

export function normalizeExpense(row: ExpenseRow): Expense {
  return {
    id: row.id,
    type: row.type === "credit" ? "credit" : "debit",
    amount: toNumber(row.amount),
    date: toDateKey(row.expenseDate) || toDateKey(row.createdAt),
    category: text(row.category) || "other",
    paymentMethod: text(row.paymentMethod),
    accountDetails: text(row.accountDetails),
    proofUrl: row.proofUrl || null,
    createdBy: row.createdBy ?? null,
    createdByName: text(row.createdByName) || null,
    createdAt: row.createdAt,
  };
}

export function normalizeSettlement(row: SettlementRow): Settlement {
  return {
    id: row.id,
    amount: toNumber(row.amount),
    date: toDateKey(row.settlementDate) || toDateKey(row.createdAt),
    paidTo: text(row.paidToName),
    description: text(row.description),
    mode: text(row.mode),
    proofUrl: row.proofUrl || null,
    createdBy: row.createdBy ?? null,
    createdByName: text(row.createdByName) || null,
    createdAt: row.createdAt,
  };
}

// ------------------------------------------------------------------ amount input

export type AmountResult = { ok: true; value: number } | { ok: false; error: string };

const PREFIX = /^(?:₹|rs\.?|inr)\s*/i;
const SUFFIX = /\/-$/;
const SEPARATORS = /[,\s   ]/g;
const PLAIN_NUMBER = /^(?:\d+\.?\d*|\.\d+)$/;

const maxLabel = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
}).format(MAX_AMOUNT);

/**
 * Reads a typed amount: digits with optional ₹ / Rs / INR, commas (Indian or
 * western grouping), spaces and a trailing "/-". At most 2 decimals; must be
 * within the API's 0.01 – 999,999,999,999.99.
 */
export function parseAmount(input: unknown): AmountResult {
  let value: number;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return { ok: false, error: "Enter a number, like 15,000 or 1500.50." };
    value = input;
    if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-6) {
      return { ok: false, error: "Use at most 2 decimal places." };
    }
  } else {
    const raw = typeof input === "string" ? input.trim() : "";
    if (!raw) return { ok: false, error: "Enter an amount." };
    const cleaned = raw.replace(PREFIX, "").replace(SUFFIX, "").replace(SEPARATORS, "");
    if (cleaned.startsWith("-")) return { ok: false, error: "Amount must be more than ₹0." };
    if (!PLAIN_NUMBER.test(cleaned)) return { ok: false, error: "Enter a number, like 15,000 or 1500.50." };
    const decimals = cleaned.includes(".") ? cleaned.split(".")[1].length : 0;
    if (decimals > 2) return { ok: false, error: "Use at most 2 decimal places." };
    value = Number(cleaned);
  }

  if (!(value > 0)) return { ok: false, error: "Amount must be more than ₹0." };
  if (value > MAX_AMOUNT) return { ok: false, error: `Amount can't exceed ${maxLabel}.` };
  return { ok: true, value: Math.round(value * 100) / 100 };
}

const groupWhole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const groupPaise = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 15,00,000 / 1,500.50 — what an amount field shows for an existing value. */
export function formatAmountInput(value: number): string {
  const hasPaise = Math.round(value * 100) % 100 !== 0;
  return (hasPaise ? groupPaise : groupWhole).format(value);
}

/** Exact sum of money values (accumulates whole paise to avoid float drift). */
export function sumAmounts(values: Iterable<number>): number {
  let paise = 0;
  for (const v of values) paise += Math.round(v * 100);
  return paise / 100;
}

// ------------------------------------------------------------------ summary → health

export type BudgetStatus = "no-budget" | "on-track" | "near-limit" | "over-budget";

/** From this share of the budget onwards the status warns. */
export const NEAR_LIMIT_RATIO = 0.85;

export type BudgetHealth = {
  budget: number;
  estimatedCost: number;
  spent: number;
  /** budget − spent; negative when over budget. */
  remaining: number;
  /** How far over budget (0 unless over). */
  overBy: number;
  /** spent / budget × 100, one decimal; null when no budget is set. */
  usedPercent: number | null;
  status: BudgetStatus;
  settlementsTotal: number;
  expenseTotal: number;
  incomeTotal: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function toBudgetHealth(row: BudgetSummaryRow): BudgetHealth {
  const budget = toNumber(row.budget);
  const spent = toNumber(row.currentSpend);
  const remaining =
    row.remaining === undefined || row.remaining === null ? round2(budget - spent) : toNumber(row.remaining);
  const hasBudget = budget > 0;

  let status: BudgetStatus;
  if (!hasBudget) status = "no-budget";
  else if (remaining < 0) status = "over-budget";
  else if (spent >= budget * NEAR_LIMIT_RATIO) status = "near-limit";
  else status = "on-track";

  return {
    budget,
    estimatedCost: toNumber(row.estimatedCost),
    spent,
    remaining,
    overBy: status === "over-budget" ? round2(-remaining) : 0,
    usedPercent: hasBudget ? Math.round((spent / budget) * 1000) / 10 : null,
    status,
    settlementsTotal: toNumber(row.settlementsTotal),
    expenseTotal: toNumber(row.expenseTotal),
    incomeTotal: toNumber(row.incomeTotal),
  };
}

/**
 * Bar geometry for the budget meter. The scale is max(budget, spent), so when
 * spending passes the budget the bar fills and the budget line moves inside it.
 */
export function meterGeometry({ budget, spent }: { budget: number; spent: number }): {
  fillPercent: number;
  budgetMarkPercent: number | null;
} {
  const b = Math.max(0, budget);
  const s = Math.max(0, spent);
  const scale = Math.max(b, s);
  if (scale === 0) return { fillPercent: 0, budgetMarkPercent: null };
  const pct = (n: number) => Math.round((n / scale) * 10_000) / 100;
  return { fillPercent: pct(s), budgetMarkPercent: b > 0 ? pct(b) : null };
}
