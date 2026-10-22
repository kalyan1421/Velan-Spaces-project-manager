import { formatInr, formatPdfDate, QuotePdfQuote, QuotePdfSettings, renderQuotePdf } from './quote-pdf';
import { loadStaticAssets, resolveAssetsDir } from './quote-pdf.service';

const quote: QuotePdfQuote = {
  quote_number: 'QUO-2026-0007',
  status: 'draft',
  prepared_for_name: 'Asha Raman',
  prepared_for_phone: '+919876543210',
  prepared_for_email: null,
  prepared_for_address: 'Adyar, Chennai',
  handled_by: 'Manager',
  designed_by: null,
  quote_date: '2026-10-22T06:00:00Z',
  valid_until: '2026-11-06T06:00:00Z',
  enquiry_date: null,
  enquiry_no: null,
  site_location: 'Adyar',
  project_type: 'Residential',
  not_included: ['Civil work'],
  sections: [
    {
      title: 'Kitchen',
      type: 'component',
      items: Array.from({ length: 40 }, (_, i) => ({
        catalogItemId: null, name: `Unit ${i}`, description: 'Ply + laminate', itemType: 'component' as const,
        variantLabel: 'Premium', lengthMm: 2400, heightMm: 900, qty: null, uom: '', rate: 1450, amount: 33717.5,
      })),
    },
    {
      title: 'Hardware',
      type: 'accessory',
      items: [{ catalogItemId: null, name: 'Hinge', description: '', itemType: 'accessory', variantLabel: 'Hettich', lengthMm: null, heightMm: null, qty: 12, uom: '', rate: 250, amount: 3000 }],
    },
    {
      title: 'Painting',
      type: 'service',
      items: [{ catalogItemId: null, name: 'Wall paint', description: '', itemType: 'service', variantLabel: '', lengthMm: null, heightMm: null, qty: 1200.5, uom: 'Sq.Ft', rate: 30, amount: 36015 }],
    },
  ],
  discount_type: 'percent',
  discount_value: 5,
  gst_percent: 18,
};

const settings: QuotePdfSettings = {
  company_name: 'Velan Spaces',
  phone: null,
  email: 'hello@example.com',
  address: null,
  footer_text: null,
  default_terms: 'Payment: 50% advance.\nValidity as stated above.',
  round_amounts: true,
};

const isPdf = (b: Buffer) => b.subarray(0, 5).toString('latin1') === '%PDF-';
const pageCount = (b: Buffer) => (b.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

describe('renderQuotePdf (smoke)', () => {
  const assets = loadStaticAssets();

  it('finds the bundled fonts and logo', () => {
    expect(resolveAssetsDir()).toMatch(/assets$/);
    expect(assets.fontRegular).not.toBeNull();
    expect(assets.fontBold).not.toBeNull();
    expect(assets.logo).not.toBeNull();
  });

  it('renders a multi-page PDF with NotoSans, logo, watermark and cover', async () => {
    const pdf = await renderQuotePdf(quote, settings, {
      fontRegular: assets.fontRegular,
      fontBold: assets.fontBold,
      logo: assets.logo,
      watermark: assets.logo,
      cover: assets.logo,
    });
    expect(isPdf(pdf)).toBe(true);
    expect(pageCount(pdf)).toBeGreaterThanOrEqual(3); // cover + 40-row table spills over
    expect(pdf.toString('latin1')).toContain('NotoSans');
  });

  it('skips unusable images and falls back to Helvetica without fonts', async () => {
    const pdf = await renderQuotePdf({ ...quote, sections: [] }, { ...settings, default_terms: null }, {
      logo: Buffer.from('definitely not an image'),
      watermark: Buffer.from('RIFF....WEBPVP8 '),
    });
    expect(isPdf(pdf)).toBe(true);
    expect(pageCount(pdf)).toBe(1);
  });

  it('handles an empty quote', async () => {
    const empty: QuotePdfQuote = Object.fromEntries(Object.keys(quote).map((k) => [k, null])) as unknown as QuotePdfQuote;
    const blank: QuotePdfSettings = Object.fromEntries(Object.keys(settings).map((k) => [k, null])) as unknown as QuotePdfSettings;
    expect(isPdf(await renderQuotePdf(empty, blank))).toBe(true);
  });
});

describe('PDF formatting', () => {
  it('formats rupees with Indian grouping, paise only when present', () => {
    expect(formatInr(123456)).toBe('₹1,23,456');
    expect(formatInr(1234.5)).toBe('₹1,234.50');
  });

  it('formats dates as DD Mon YYYY in IST', () => {
    expect(formatPdfDate('2026-09-30T20:00:00Z')).toBe('01 Oct 2026');
    expect(formatPdfDate('2026-09-15T00:00:00Z')).toBe('15 Sep 2026');
    expect(formatPdfDate(null)).toBe('');
    expect(formatPdfDate('nope')).toBe('');
  });
});
