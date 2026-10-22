/**
 * Pure money calculations. Kept free of NestJS/Supabase so they are trivially
 * unit-testable and reused across modules. Never trust client-sent totals.
 */

export interface QuoteItemLike {
  amount?: number | string;
}
export interface QuoteSectionLike {
  items?: QuoteItemLike[];
}

export type DiscountType = 'amount' | 'percent';

export interface QuoteTotals {
  subtotal: number;
  grandTotal: number;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** subtotal = Σ item.amount; grand = (subtotal − discount) × (1 + gst%). */
export function computeQuoteTotals(
  sections: QuoteSectionLike[],
  discountType: DiscountType,
  discountValue: number,
  gstPercent: number,
): QuoteTotals {
  let subtotal = 0;
  for (const section of sections ?? []) {
    for (const item of section.items ?? []) {
      subtotal += Number(item.amount) || 0;
    }
  }
  const discount =
    discountType === 'percent'
      ? (subtotal * (discountValue || 0)) / 100
      : discountValue || 0;
  const grandTotal = (subtotal - discount) * (1 + (gstPercent || 0) / 100);
  return { subtotal: round2(subtotal), grandTotal: round2(grandTotal) };
}

export interface TxnLike {
  type: string;
  amount: number | string;
}

/** current_spend = Σ debits − Σ credits. */
export function computeSpend(transactions: TxnLike[]): number {
  const spend = (transactions ?? []).reduce((acc, t) => {
    const amt = Number(t.amount) || 0;
    return t.type === 'credit' ? acc - amt : acc + amt;
  }, 0);
  return round2(spend);
}

export interface BudgetBreakdown {
  settlementsTotal: number;
  /** Expense debits (money spent). */
  expenseTotal: number;
  /** Expense credits (money received, e.g. client payments). Not netted from spend. */
  incomeTotal: number;
  /** settlements + expense debits — same rule as SQL recompute_project_spend. */
  currentSpend: number;
}

export function budgetBreakdown(
  settlements: { amount: number | string }[],
  expenses: TxnLike[],
): BudgetBreakdown {
  const sum = (xs: { amount: number | string }[]) =>
    xs.reduce((acc, x) => acc + (Number(x.amount) || 0), 0);
  const settlementsTotal = round2(sum(settlements ?? []));
  const expenseTotal = round2(sum((expenses ?? []).filter((e) => e.type === 'debit')));
  const incomeTotal = round2(sum((expenses ?? []).filter((e) => e.type === 'credit')));
  return {
    settlementsTotal,
    expenseTotal,
    incomeTotal,
    currentSpend: round2(settlementsTotal + expenseTotal),
  };
}

export interface ClientPaymentsSummary {
  /** Agreed project budget (0 when not set). */
  budget: number;
  /** Σ expense credits — payments received from the client. */
  received: number;
  /** budget − received; negative when the client has paid ahead. */
  balance: number;
  /** received / budget as 0–100 (capped), or null when no budget is set. */
  receivedPercent: number | null;
}

/** What the client portal shows about money: budget vs payments received, nothing else. */
export function clientPaymentsSummary(
  budget: number | string | null | undefined,
  credits: { amount: number | string }[],
): ClientPaymentsSummary {
  const b = round2(Number(budget) || 0);
  const received = round2((credits ?? []).reduce((acc, c) => acc + (Number(c.amount) || 0), 0));
  return {
    budget: b,
    received,
    balance: round2(b - received),
    receivedPercent: b > 0 ? Math.min(100, round2((received / b) * 100)) : null,
  };
}

export interface QuoteBreakdown {
  /** Σ item.amount (same as computeQuoteTotals). */
  subtotal: number;
  /** Discount in ₹ (a percent discount resolved against the subtotal). */
  discount: number;
  /** subtotal − discount. */
  taxable: number;
  /** GST in ₹, taken as grandTotal − taxable so the lines always add up. */
  gstAmount: number;
  /** Same value computeQuoteTotals returns (what the quotes row stores). */
  grandTotal: number;
  /** payable − grandTotal (0 unless roundAmounts). */
  roundOff: number;
  /** grandTotal rounded to whole rupees when roundAmounts, else grandTotal. */
  payable: number;
}

/**
 * Totals block for a quote document: subtotal → discount → GST → round-off →
 * payable. Built on computeQuoteTotals so the stored grand total and the
 * document never disagree by more than the round-off line.
 */
export function quoteBreakdown(
  sections: QuoteSectionLike[],
  discountType: DiscountType,
  discountValue: number,
  gstPercent: number,
  roundAmounts = false,
): QuoteBreakdown {
  const { subtotal, grandTotal } = computeQuoteTotals(
    sections,
    discountType,
    discountValue,
    gstPercent,
  );
  const discount = round2(
    discountType === 'percent' ? (subtotal * (discountValue || 0)) / 100 : discountValue || 0,
  );
  const taxable = round2(subtotal - discount);
  const gstAmount = round2(grandTotal - taxable);
  const payable = roundAmounts ? Math.round(grandTotal) : grandTotal;
  return {
    subtotal,
    discount,
    taxable,
    gstAmount,
    grandTotal,
    roundOff: round2(payable - grandTotal),
    payable,
  };
}
