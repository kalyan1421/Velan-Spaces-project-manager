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
