import {
  computeQuoteTotals,
  budgetBreakdown,
  clientPaymentsSummary,
  computeSpend,
  quoteBreakdown,
} from './calc';

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

describe('budgetBreakdown', () => {
  it('spend = settlements + expense debits; credits are income', () => {
    const b = budgetBreakdown(
      [{ amount: 1000 }, { amount: '250.50' }],
      [
        { type: 'debit', amount: 400 },
        { type: 'credit', amount: 5000 },
        { type: 'debit', amount: '99.99' },
      ],
    );
    expect(b).toEqual({
      settlementsTotal: 1250.5,
      expenseTotal: 499.99,
      incomeTotal: 5000,
      currentSpend: 1750.49,
    });
  });

  it('handles empty input', () => {
    expect(budgetBreakdown([], []).currentSpend).toBe(0);
  });
});

describe('quoteBreakdown', () => {
  const sections = [{ items: [{ amount: 1000 }, { amount: 500.5 }] }];

  it('splits discount, GST and round-off so the lines add up', () => {
    const b = quoteBreakdown(sections, 'percent', 10, 18, true);
    expect(b.subtotal).toBe(1500.5);
    expect(b.discount).toBe(150.05);
    expect(b.taxable).toBe(1350.45);
    expect(b.grandTotal).toBe(computeQuoteTotals(sections, 'percent', 10, 18).grandTotal);
    expect(b.grandTotal).toBe(1593.53);
    expect(b.gstAmount).toBe(243.08);
    expect(b.payable).toBe(1594);
    expect(b.roundOff).toBe(0.47);
    expect(b.taxable + b.gstAmount).toBeCloseTo(b.grandTotal, 2);
  });

  it('does not round when roundAmounts is off', () => {
    const b = quoteBreakdown(sections, 'amount', 0.5, 0, false);
    expect(b.payable).toBe(1500);
    expect(b.roundOff).toBe(0);
    expect(b.gstAmount).toBe(0);
  });
});

describe('clientPaymentsSummary', () => {
  it('sums payments received against the budget', () => {
    expect(clientPaymentsSummary('1500000.00', [{ amount: '300000.00' }, { amount: 200000 }])).toEqual({
      budget: 1500000,
      received: 500000,
      balance: 1000000,
      receivedPercent: 33.33,
    });
  });

  it('reports a negative balance and caps the percent when the client paid ahead', () => {
    const s = clientPaymentsSummary(100000, [{ amount: 120000 }]);
    expect(s.balance).toBe(-20000);
    expect(s.receivedPercent).toBe(100);
  });

  it('has no percent when no budget is set', () => {
    expect(clientPaymentsSummary(null, [{ amount: 5000 }])).toEqual({
      budget: 0,
      received: 5000,
      balance: -5000,
      receivedPercent: null,
    });
  });

  it('handles no payments yet', () => {
    expect(clientPaymentsSummary(800000, []).receivedPercent).toBe(0);
  });
});
