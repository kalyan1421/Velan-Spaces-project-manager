/**
 * Client-portal money view: the agreed budget vs payments received from the
 * client (`GET /projects/:id/client-payments`). Never spend, expenses,
 * settlements or estimated cost. Plain module so server and client code and
 * tests can share it.
 */
import { toNumber } from "@/lib/format";

export type ClientPayment = {
  id: string;
  amount: number;
  /** ISO date (payment date, else when it was recorded). */
  date: string | null;
  paymentMethod: string | null;
};

export type ClientPayments = {
  budget: number;
  received: number;
  /** budget − received; negative when the client paid ahead. */
  balance: number;
  /** 0–100, or null when no budget is set. */
  receivedPercent: number | null;
  payments: ClientPayment[];
};

type Raw = Record<string, unknown>;
const asObject = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);

export function normalizeClientPayments(raw: unknown): ClientPayments {
  const o = asObject(raw);
  const pct = o.receivedPercent;
  return {
    budget: toNumber(o.budget),
    received: toNumber(o.received),
    balance: toNumber(o.balance),
    receivedPercent: pct === null || pct === undefined ? null : Math.min(100, Math.max(0, toNumber(pct))),
    payments: (Array.isArray(o.payments) ? o.payments : [])
      .map(asObject)
      .filter((p) => typeof p.id === "string")
      .map((p) => ({
        id: p.id as string,
        amount: toNumber(p.amount),
        date: str(p.date),
        paymentMethod: str(p.paymentMethod),
      })),
  };
}

export type PaymentStanding =
  | { kind: "no-budget" }
  | { kind: "not-started" }
  | { kind: "partial"; due: number }
  | { kind: "paid" }
  | { kind: "ahead"; ahead: number };

/** How the client stands against the budget, for the card's badge and balance line. */
export function paymentStanding(p: Pick<ClientPayments, "budget" | "received" | "balance">): PaymentStanding {
  if (p.budget <= 0) return { kind: "no-budget" };
  if (p.received <= 0) return { kind: "not-started" };
  if (p.balance > 0) return { kind: "partial", due: p.balance };
  if (p.balance === 0) return { kind: "paid" };
  return { kind: "ahead", ahead: -p.balance };
}
