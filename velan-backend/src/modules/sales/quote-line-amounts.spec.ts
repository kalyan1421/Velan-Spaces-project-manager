import { lineAmountFor, QuoteItemData, withLineAmounts } from './quote-sections';

const item = (over: Partial<QuoteItemData>): QuoteItemData => ({
  catalogItemId: null,
  name: 'Line',
  description: '',
  itemType: 'component',
  variantLabel: '',
  lengthMm: null,
  heightMm: null,
  qty: null,
  uom: '',
  rate: 0,
  amount: 0,
  ...over,
});

describe('lineAmountFor', () => {
  it('prices components by face area (L x H mm -> sq.ft) x rate', () => {
    // 3000 x 850 mm = 27.4479 sq.ft x 1650 = 45,289.15
    const line = item({ lengthMm: 3000, heightMm: 850, rate: 1650, amount: 1 });
    expect(lineAmountFor(line, true)).toBe(45289);
    expect(lineAmountFor(line, false)).toBe(45289.15);
  });

  it('prices accessories and services by qty x rate', () => {
    expect(lineAmountFor(item({ itemType: 'accessory', qty: 12, rate: 350 }), true)).toBe(4200);
    expect(lineAmountFor(item({ itemType: 'service', qty: 180, rate: 95 }), true)).toBe(17100);
    expect(lineAmountFor(item({ itemType: 'service', qty: 2.5, rate: 99.99 }), false)).toBe(249.98);
  });

  it('ignores a sent amount that disagrees with the inputs', () => {
    expect(lineAmountFor(item({ itemType: 'accessory', qty: 2, rate: 100, amount: 999999 }), true)).toBe(200);
  });

  it('keeps the sent amount when the size or qty is missing (half-filled draft)', () => {
    expect(lineAmountFor(item({ lengthMm: 1000, rate: 1650, amount: 500 }), true)).toBe(500);
    expect(lineAmountFor(item({ itemType: 'service', rate: 95, amount: 70 }), true)).toBe(70);
  });

  it('treats negative inputs as zero', () => {
    expect(lineAmountFor(item({ itemType: 'accessory', qty: 3, rate: -10 }), true)).toBe(0);
  });
});

describe('withLineAmounts', () => {
  it('recomputes every line in every section', () => {
    const out = withLineAmounts(
      [
        { title: 'Kitchen', type: 'component', items: [item({ lengthMm: 3000, heightMm: 850, rate: 1650, amount: 45281.16 })] },
        { title: 'Hardware', type: 'accessory', items: [item({ itemType: 'accessory', qty: 12, rate: 350, amount: 1 })] },
      ],
      true,
    );
    expect(out.map((s) => s.items[0].amount)).toEqual([45289, 4200]);
  });
});
