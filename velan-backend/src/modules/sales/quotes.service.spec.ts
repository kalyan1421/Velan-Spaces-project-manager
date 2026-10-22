import { BadRequestException } from '@nestjs/common';
import { computeQuoteTotals } from '../../common/calc';
import { QuoteDto } from './dto/quote.dto';
import { DEFAULT_SETTINGS, QuotationSettingsService } from './quotation-settings.service';
import { quoteTotalsForRow, QuoteRow, QuotesService } from './quotes.service';
import { quoteYear } from './quote-number';

type Op = [string, unknown[]];
type Result = { data: unknown; error: { message: string } | null };

/** Minimal thenable stand-in for a supabase-js query builder. */
class FakeQuery {
  ops: Op[] = [];
  constructor(
    readonly table: string,
    private readonly resolve: (q: FakeQuery) => Result,
  ) {}
  private rec(name: string, args: unknown[]) {
    this.ops.push([name, args]);
    return this;
  }
  select(...a: unknown[]) { return this.rec('select', a); }
  insert(...a: unknown[]) { return this.rec('insert', a); }
  update(...a: unknown[]) { return this.rec('update', a); }
  delete(...a: unknown[]) { return this.rec('delete', a); }
  eq(...a: unknown[]) { return this.rec('eq', a); }
  order(...a: unknown[]) { return this.rec('order', a); }
  limit(...a: unknown[]) { return this.rec('limit', a); }
  single() { return this.rec('single', []); }
  maybeSingle() { return this.rec('maybeSingle', []); }
  has(name: string) { return this.ops.some(([n]) => n === name); }
  arg(name: string) { return this.ops.find(([n]) => n === name)?.[1][0]; }
  then<T>(ok: (r: Result) => T, fail?: (e: unknown) => T) {
    return Promise.resolve(this.resolve(this)).then(ok, fail);
  }
}

const existing: QuoteRow = {
  id: 'q1',
  lead_id: null,
  quote_number: 'QUO-2026-0003',
  status: 'draft',
  prepared_for_name: 'Asha',
  prepared_for_phone: null,
  prepared_for_email: null,
  prepared_for_address: null,
  pdf_url: 'sb://quotations/quotation/sent/QUO-2026-0003.pdf',
  handled_by: null,
  designed_by: null,
  quote_date: '2026-10-01T00:00:00.000Z',
  valid_until: '2026-10-16T00:00:00.000Z',
  enquiry_date: null,
  enquiry_no: null,
  site_location: null,
  project_type: 'Residential',
  not_included: [],
  sections: [
    {
      title: 'Kitchen',
      type: 'component',
      items: [
        {
          catalogItemId: null, name: 'Base', description: '', itemType: 'component', variantLabel: '',
          lengthMm: null, heightMm: null, qty: null, uom: '', rate: 0, amount: 1000,
        },
      ],
    },
  ],
  discount_type: 'percent',
  discount_value: 10,
  gst_percent: 18,
  subtotal: 1000,
  grand_total: 1062,
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
};

function setup(opts: { seq?: number; settings?: Partial<typeof DEFAULT_SETTINGS> } = {}) {
  const queries: FakeQuery[] = [];
  const rpc = jest.fn(async () => ({ data: opts.seq ?? 7, error: null }));
  const resolve = (q: FakeQuery): Result => {
    if (q.table === 'leads') {
      return { data: { id: 'lead-1', client_name: 'Lead Name', client_phone: '+91900', area: 'Adyar', project_type: null, created_at: '2026-10-20T00:00:00.000Z' }, error: null };
    }
    if (q.has('insert')) return { data: { id: 'new', ...(q.arg('insert') as object) }, error: null };
    if (q.has('update')) return { data: { ...existing, ...(q.arg('update') as object) }, error: null };
    return { data: existing, error: null };
  };
  const db = {
    from: (t: string) => {
      const q = new FakeQuery(t, resolve);
      queries.push(q);
      return q;
    },
    rpc,
  };
  const supabase = { admin: () => db };
  const settings = {
    getEffective: async () => ({ ...DEFAULT_SETTINGS, ...opts.settings }),
    normalizeRef: (_f: string, v: unknown) => (v === '' ? null : v),
  } as unknown as QuotationSettingsService;
  const svc = new QuotesService(supabase as never, settings);
  const written = (op: 'insert' | 'update') =>
    queries.find((q) => q.table === 'quotes' && q.has(op))?.arg(op) as Record<string, unknown>;
  return { svc, rpc, written };
}

const body = (b: Record<string, unknown>) => b as QuoteDto;

describe('QuotesService.update — totals', () => {
  it('recomputes totals from new sections and ignores client totals/number', async () => {
    const { svc, written } = setup();
    const sections = [{ title: 'K', type: 'component', items: [{ name: 'a', amount: 2000 }, { name: 'b', amount: '500' }] }];
    await svc.update('q1', body({ sections, subtotal: 1, grandTotal: 1, quoteNumber: 'X-1' }));
    const patch = written('update');
    // existing discount 10% + GST 18% still apply
    const expected = computeQuoteTotals([{ items: [{ amount: 2000 }, { amount: 500 }] }], 'percent', 10, 18);
    expect(patch.subtotal).toBe(2500);
    expect(patch.grand_total).toBe(expected.grandTotal);
    expect(patch.grand_total).toBe(2655);
    expect(patch).not.toHaveProperty('quote_number');
    expect((patch.sections as { items: { amount: number }[] }[])[0].items[1].amount).toBe(500);
  });

  it('recomputes from stored sections when only discount/GST change', async () => {
    const { svc, written } = setup();
    await svc.update('q1', body({ discountType: 'flat', discountValue: 100, gstPercent: 0 }));
    const patch = written('update');
    expect(patch.discount_type).toBe('amount');
    expect(patch.subtotal).toBe(1000);
    expect(patch.grand_total).toBe(900);
  });

  it('rejects a percent discount over 100 against the stored type', async () => {
    const { svc } = setup();
    await expect(svc.update('q1', body({ discountValue: 150 }))).rejects.toBeInstanceOf(BadRequestException);
  });

  it('never stores a negative grand total', () => {
    expect(quoteTotalsForRow([{ title: '', type: 'component', items: [] }], 'amount', 50, 0)).toEqual({
      subtotal: 0,
      grand_total: 0,
    });
  });
});

describe('QuotesService.create — numbering and defaults', () => {
  it('assigns <prefix>-<YYYY>-<seq> from the SQL counter, ignoring a client number', async () => {
    const { svc, rpc, written } = setup({ seq: 42, settings: { quote_number_prefix: 'VS-' } });
    await svc.create(body({ quoteNumber: 'CLIENT-9', sections: [] }));
    const year = quoteYear();
    expect(rpc).toHaveBeenCalledWith('next_quote_seq', { p_year: year });
    expect(written('insert').quote_number).toBe(`VS-${year}-0042`);
  });

  it('fills defaults from settings and the lead', async () => {
    const { svc, written } = setup({
      settings: { default_gst_percent: 18, quote_validity_days: 30, default_not_included: ['Civil work'] },
    });
    await svc.create(
      body({
        leadId: '6f1c2f5e-3c1b-4d55-9a31-0d9f1f0b7a11',
        quoteDate: '2026-10-01T00:00:00.000Z',
        sections: [{ title: 'K', items: [{ name: 'a', amount: 1000 }] }],
      }),
    );
    const row = written('insert');
    expect(row).toMatchObject({
      status: 'draft',
      prepared_for_name: 'Lead Name',
      prepared_for_phone: '+91900',
      site_location: 'Adyar',
      project_type: 'Residential',
      gst_percent: 18,
      not_included: ['Civil work'],
      valid_until: '2026-10-31T00:00:00.000Z',
      subtotal: 1000,
      grand_total: 1180,
    });
  });
});

describe('QuotesService.duplicate', () => {
  it('copies as a new draft with a new number and no hosted PDF', async () => {
    const { svc, written } = setup({ seq: 8 });
    await svc.duplicate('q1');
    const row = written('insert');
    expect(row.status).toBe('draft');
    expect(row.pdf_url).toBeNull();
    expect(row.quote_number).toBe(`QUO-${quoteYear()}-0008`);
    expect(row.sections).toEqual(existing.sections);
    expect(row.grand_total).toBe(1062);
  });
});
