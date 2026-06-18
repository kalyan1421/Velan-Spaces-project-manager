import { computeQuoteTotals, computeSpend } from './calc';

describe('computeQuoteTotals', () => {
  const sections = [
    { items: [{ amount: 1000 }, { amount: 500 }] },
    { items: [{ amount: 250 }] },
  ];

  it('sums item amounts into subtotal', () => {
    const { subtotal } = computeQuoteTotals(sections, 'amount', 0, 0);
    expect(subtotal).toBe(1750);
  });

  it('applies a flat-amount discount', () => {
    const { grandTotal } = computeQuoteTotals(sections, 'amount', 250, 0);
    expect(grandTotal).toBe(1500);
  });

  it('applies a percentage discount', () => {
    const { grandTotal } = computeQuoteTotals(sections, 'percent', 10, 0);
    expect(grandTotal).toBe(1575); // 1750 - 10%
  });

  it('applies GST after discount', () => {
    const { grandTotal } = computeQuoteTotals(sections, 'amount', 0, 18);
    expect(grandTotal).toBe(2065); // 1750 * 1.18
  });

  it('coerces string amounts and tolerates empty sections', () => {
    const { subtotal, grandTotal } = computeQuoteTotals(
      [{ items: [{ amount: '99.5' }] }, {}],
      'amount',
      0,
      0,
    );
    expect(subtotal).toBe(99.5);
    expect(grandTotal).toBe(99.5);
  });
});

describe('computeSpend', () => {
  it('sums debits minus credits', () => {
    expect(
      computeSpend([
        { type: 'debit', amount: 1000 },
        { type: 'debit', amount: 250 },
        { type: 'credit', amount: 300 },
      ]),
    ).toBe(950);
  });

  it('returns 0 for no transactions', () => {
    expect(computeSpend([])).toBe(0);
  });

  it('coerces string amounts', () => {
    expect(computeSpend([{ type: 'debit', amount: '12.5' }])).toBe(12.5);
  });
});
