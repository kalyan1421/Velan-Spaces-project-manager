import PDFDocument from 'pdfkit';
import { quoteBreakdown } from '../../common/calc';
import { QuoteItemData, QuoteSectionData } from './quote-sections';
import { ItemType, SALES_TIME_ZONE } from './sales.constants';

/**
 * Server-side quotation PDF (pdfkit). Same layout as the mobile app's
 * QuotationPdfService: optional full-bleed cover page, "PROPOSAL" header with
 * logo, Prepared By / Prepared For blocks, metadata table, not-included list,
 * room-wise tables whose columns depend on the section type, totals
 * (subtotal → discount → GST → round-off → grand total), terms, signatures,
 * a low-opacity logo watermark behind every content page and a footer with
 * page numbers.
 *
 * Pure: takes the rows + already-loaded image/font bytes, returns the PDF.
 */

export interface QuotePdfQuote {
  quote_number: string | null;
  status?: string | null;
  prepared_for_name: string | null;
  prepared_for_phone: string | null;
  prepared_for_email: string | null;
  prepared_for_address: string | null;
  handled_by: string | null;
  designed_by: string | null;
  quote_date: string | null;
  valid_until: string | null;
  enquiry_date: string | null;
  enquiry_no: string | null;
  site_location: string | null;
  project_type: string | null;
  not_included: string[] | null;
  sections: QuoteSectionData[] | null;
  discount_type: string | null;
  discount_value: number | string | null;
  gst_percent: number | string | null;
}

export interface QuotePdfSettings {
  company_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  footer_text: string | null;
  default_terms: string | null;
  round_amounts: boolean | null;
}

export interface QuotePdfAssets {
  /** TTF bytes; without them the built-in Helvetica is used and ₹ prints as "Rs.". */
  fontRegular?: Buffer | null;
  fontBold?: Buffer | null;
  cover?: Buffer | null;
  logo?: Buffer | null;
  watermark?: Buffer | null;
}

// ---------------------------------------------------------------- layout
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = { top: 36, left: 32, right: 32, bottom: 64 };
const CONTENT_W = PAGE_W - MARGIN.left - MARGIN.right;
const BOTTOM = PAGE_H - MARGIN.bottom;
const L = MARGIN.left;

const MAROON = '#7A1F2B';
const MAROON_LIGHT = '#F3E9EA';
const GREY = '#6B7280';
const LINE_GREY = '#E5E7EB';
const MUTED_BG = '#FAFAFA';
const BLACK = '#111111';
const WHITE = '#FFFFFF';

const WATERMARK_WIDTH = 360;
const WATERMARK_OPACITY = 0.06;

const TYPE_LABEL: Record<ItemType, string> = {
  component: 'Component',
  accessory: 'Accessory',
  service: 'Service',
};
const COLUMN_LABELS: Record<ItemType, [string, string]> = {
  component: ['Type/Variant', 'Size (mm)'],
  accessory: ['Brand', 'Qty'],
  service: ['UOM', 'Qty'],
};

// ---------------------------------------------------------------- formatting
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "22 Oct 2026" in IST; '' for missing/invalid dates. */
export function formatPdfDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SALES_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return `${String(get('day')).padStart(2, '0')} ${MONTHS[get('month') - 1]} ${get('year')}`;
}

const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const inrPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,23,456 (paise only when present) — same rule as the web's formatINR. */
export function formatInr(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const hasPaise = Math.round(Math.abs(n) * 100) % 100 !== 0;
  return (hasPaise ? inrPaise : inrWhole).format(n);
}

const trimNum = (n: number) => String(Math.round(n * 100) / 100);

function qtyLabel(qty: number | null): string {
  if (qty === null || qty === undefined) return '';
  return Number.isInteger(qty) ? String(qty) : qty.toFixed(2);
}

function sizeLabel(i: QuoteItemData): string {
  return i.lengthMm !== null && i.heightMm !== null && i.lengthMm !== undefined && i.heightMm !== undefined
    ? `${Math.trunc(i.lengthMm)}(L) × ${Math.trunc(i.heightMm)}(H)`
    : '';
}

// ---------------------------------------------------------------- renderer
/**
 * An image opened by doc.openImage(). pdfkit's image() accepts it in place of
 * a Buffer (typed as Buffer for the call) and embeds it only once.
 */
type PdfImage = Buffer & { readonly __opened: true };
type FontKind = 'regular' | 'bold';
interface TextStyle {
  font?: FontKind;
  size: number;
  color?: string;
  align?: 'left' | 'right' | 'center';
  characterSpacing?: number;
}
interface Cell {
  text: string;
  width: number;
  style: TextStyle;
  /** Optional smaller second line (item description). */
  sub?: { text: string; style: TextStyle };
  fill?: string;
}

class QuotePdfWriter {
  readonly doc: PDFKit.PDFDocument;
  private y = MARGIN.top;
  private readonly fonts: Record<FontKind, string>;
  private readonly rupee: (s: string) => string;
  private watermark: PdfImage | null = null;
  private watermarkOn = false;

  constructor(private readonly assets: QuotePdfAssets) {
    this.doc = new PDFDocument({
      size: 'A4',
      margins: MARGIN,
      bufferPages: true,
      autoFirstPage: false,
    });
    let custom = false;
    if (assets.fontRegular && assets.fontBold) {
      try {
        this.doc.registerFont('VS-Regular', assets.fontRegular);
        this.doc.registerFont('VS-Bold', assets.fontBold);
        this.doc.font('VS-Regular');
        custom = true;
      } catch {
        custom = false;
      }
    }
    this.fonts = custom
      ? { regular: 'VS-Regular', bold: 'VS-Bold' }
      : { regular: 'Helvetica', bold: 'Helvetica-Bold' };
    // Helvetica (WinAnsi) has no ₹ glyph.
    this.rupee = custom ? (s) => s : (s) => s.replace(/₹/g, 'Rs. ');
    this.doc.on('pageAdded', () => this.drawWatermark());
  }

  /**
   * Opens an image once (PNG/JPEG) so every page reuses one embedded copy —
   * the watermark is drawn on each page. Null when corrupt or unsupported
   * (webp/heic/gif).
   */
  usableImage(buf: Buffer | null | undefined): PdfImage | null {
    if (!buf || buf.length < 8) return null;
    try {
      const img = (this.doc as unknown as { openImage(src: Buffer): unknown }).openImage(buf);
      return img as PdfImage;
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------ primitives
  private style(s: TextStyle) {
    this.doc
      .font(this.fonts[s.font ?? 'regular'])
      .fontSize(s.size)
      .fillColor(s.color ?? BLACK);
  }

  height(text: string, s: TextStyle, width: number): number {
    if (!text) return 0;
    this.style(s);
    return this.doc.heightOfString(this.rupee(text), {
      width,
      characterSpacing: s.characterSpacing,
    });
  }

  text(text: string, x: number, y: number, s: TextStyle, width: number, extra: PDFKit.Mixins.TextOptions = {}) {
    if (!text) return;
    this.style(s);
    this.doc.text(this.rupee(text), x, y, {
      width,
      align: s.align ?? 'left',
      characterSpacing: s.characterSpacing,
      ...extra,
    });
  }

  private ensure(h: number) {
    if (this.y + h > BOTTOM) this.newPage();
  }

  private newPage() {
    this.doc.addPage();
    this.y = MARGIN.top;
  }

  private drawWatermark() {
    if (!this.watermarkOn || !this.watermark) return;
    const d = this.doc;
    d.save();
    d.opacity(WATERMARK_OPACITY);
    d.image(this.watermark, (PAGE_W - WATERMARK_WIDTH) / 2, (PAGE_H - WATERMARK_WIDTH) / 2, {
      fit: [WATERMARK_WIDTH, WATERMARK_WIDTH],
      align: 'center',
      valign: 'center',
    });
    d.restore();
  }

  // ------------------------------------------------------------ document
  render(quote: QuotePdfQuote, settings: QuotePdfSettings): void {
    const cover = this.usableImage(this.assets.cover);
    const logo = this.usableImage(this.assets.logo);
    const { watermark } = this.assets;
    // Same bytes as the logo (the usual fallback) -> reuse the embedded logo.
    this.watermark = (watermark && watermark !== this.assets.logo ? this.usableImage(watermark) : null) ?? logo;

    if (cover) {
      this.doc.addPage({ size: 'A4', margin: 0 });
      this.doc.save();
      this.doc.rect(0, 0, PAGE_W, PAGE_H).clip();
      this.doc.image(cover, 0, 0, { cover: [PAGE_W, PAGE_H], align: 'center', valign: 'center' });
      this.doc.restore();
    }
    this.watermarkOn = true;
    this.newPage();

    const sections = quote.sections ?? [];
    this.titleRow(logo);
    this.preparedBlock('PREPARED BY', settings.company_name ?? '', [
      [settings.phone, settings.email].filter((v) => v && v.trim()).join('   •   '),
      settings.address ?? '',
    ]);
    this.preparedBlock('PREPARED FOR', quote.prepared_for_name ?? '', [
      [quote.prepared_for_phone, quote.prepared_for_email].filter((v) => v && v.trim()).join('   •   '),
      quote.prepared_for_address ?? '',
    ]);
    this.metadata(quote);
    if ((quote.not_included ?? []).length > 0) this.notIncluded(quote.not_included ?? []);
    for (const section of sections) this.section(section);
    this.totals(quote, settings);
    if (settings.default_terms && settings.default_terms.trim()) this.terms(settings.default_terms);
    this.signatures();
    this.footers(settings, cover !== null);
  }

  private titleRow(logo: PdfImage | null) {
    const y0 = this.y;
    const title: TextStyle = { font: 'bold', size: 30, color: MAROON };
    this.text('PROPOSAL', L, y0, title, 300);
    const titleH = this.height('PROPOSAL', title, 300);
    this.doc.rect(L, y0 + titleH + 2, 90, 3).fill(MAROON);
    this.text('Final Quote', L, y0 + titleH + 11, { size: 12, color: GREY }, 300);
    const leftH = titleH + 11 + this.height('Final Quote', { size: 12 }, 300);
    if (logo) {
      this.doc.image(logo, L + CONTENT_W - 200, y0, { fit: [200, 56], align: 'right' });
    }
    this.y = y0 + Math.max(leftH, logo ? 56 : 0) + 20;
  }

  private preparedBlock(label: string, name: string, lines: string[]) {
    const pad = 14;
    const w = CONTENT_W - pad * 2;
    const labelStyle: TextStyle = { font: 'bold', size: 9, color: MAROON, characterSpacing: 1 };
    const nameStyle: TextStyle = { font: 'bold', size: 16 };
    const lineStyle: TextStyle = { size: 10, color: GREY };
    const shown = lines.filter((l) => l.trim());
    const nameText = name.trim() || '—';
    const h =
      pad * 2 +
      this.height(label, labelStyle, w) +
      4 +
      this.height(nameText, nameStyle, w) +
      shown.reduce((acc, l) => acc + 2 + this.height(l, lineStyle, w), 0);
    this.ensure(h);
    this.doc.roundedRect(L, this.y, CONTENT_W, h, 6).lineWidth(1).fillAndStroke(WHITE, LINE_GREY);
    let y = this.y + pad;
    this.text(label, L + pad, y, labelStyle, w);
    y += this.height(label, labelStyle, w) + 4;
    this.text(nameText, L + pad, y, nameStyle, w);
    y += this.height(nameText, nameStyle, w);
    for (const l of shown) {
      y += 2;
      this.text(l, L + pad, y, lineStyle, w);
      y += this.height(l, lineStyle, w);
    }
    this.y += h + 14;
  }

  private metadata(q: QuotePdfQuote) {
    const unit = CONTENT_W / 6.8;
    const [w1, w2] = [unit * 1.4, unit * 2];
    const label = (t: string): Cell => ({ text: t, width: w1, style: { size: 10, color: GREY }, fill: MUTED_BG });
    const value = (t: string | null | undefined, width = w2): Cell => ({
      text: t && t.trim() ? t : '—',
      width,
      style: { font: 'bold', size: 10 },
      fill: WHITE,
    });
    const rows: Cell[][] = [
      [label('Quote No.'), value(q.quote_number), label('Project Type'), value(q.project_type)],
      [label('Date'), value(formatPdfDate(q.quote_date)), label('Handled By'), value(q.handled_by)],
      [label('Valid Until'), value(formatPdfDate(q.valid_until)), label('Designed By'), value(q.designed_by)],
      [label('Enquiry Date'), value(formatPdfDate(q.enquiry_date)), label('Enquiry No.'), value(q.enquiry_no)],
      [label('Site Location'), value(q.site_location, CONTENT_W - w1)],
    ];
    for (const r of rows) this.row(r, { padX: 10, padY: 8, border: LINE_GREY, borderWidth: 1 });
    this.y += 16;
  }

  private notIncluded(items: string[]) {
    const head: TextStyle = { font: 'bold', size: 12 };
    const item: TextStyle = { size: 10 };
    const first = this.height(`•  ${items[0]}`, item, CONTENT_W);
    this.ensure(this.height('Not Included Items:', head, CONTENT_W) + 6 + first);
    this.text('Not Included Items:', L, this.y, head, CONTENT_W);
    this.y += this.height('Not Included Items:', head, CONTENT_W) + 6;
    for (const e of items) {
      const h = this.height(`•  ${e}`, item, CONTENT_W);
      this.ensure(h);
      this.text(`•  ${e}`, L, this.y, item, CONTENT_W);
      this.y += h + 2;
    }
    this.y += 14;
  }

  private section(section: QuoteSectionData) {
    const type: ItemType = section.type ?? 'component';
    const titleStyle: TextStyle = { font: 'bold', size: 13, color: MAROON };
    const title = section.title?.trim() || TYPE_LABEL[type];
    const headerH = this.height(title, titleStyle, CONTENT_W - 24) + 16;

    const sno = 42;
    const unit = (CONTENT_W - sno) / 9.2;
    const widths = [sno, unit * 4, unit * 1.8, unit * 1.8, unit * 1.6];
    const [col3, col4] = COLUMN_LABELS[type];
    const headerCells: Cell[] = ['S.No', TYPE_LABEL[type], col3, col4, 'Amount'].map((t, i) => ({
      text: t,
      width: widths[i],
      style: { font: 'bold', size: 9, color: WHITE, align: i === 4 ? 'right' : 'left' },
      fill: MAROON,
    }));
    const itemCells = (it: QuoteItemData, idx: number): Cell[] => [
      { text: String(idx + 1), width: widths[0], style: { size: 9.5 } },
      {
        text: it.name || '—',
        width: widths[1],
        style: { font: 'bold', size: 10, color: MAROON },
        sub: it.description ? { text: it.description, style: { size: 8.5, color: GREY } } : undefined,
      },
      {
        text: !it.variantLabel && type === 'service' ? it.uom : it.variantLabel,
        width: widths[2],
        style: { size: 9.5 },
      },
      { text: type === 'component' ? sizeLabel(it) : qtyLabel(it.qty), width: widths[3], style: { size: 9.5 } },
      {
        text: formatInr(Number(it.amount) || 0),
        width: widths[4],
        style: { font: 'bold', size: 9.5, color: MAROON, align: 'right' },
      },
    ];
    const tableOpts = { padX: 8, padY: 7, border: LINE_GREY, borderWidth: 0.5 };
    const items = section.items ?? [];

    // Keep the section header with the table header and its first row.
    const firstRowH = items.length > 0 ? this.rowHeight(itemCells(items[0], 0), tableOpts) : 0;
    this.ensure(headerH + 8 + this.rowHeight(headerCells, tableOpts) + firstRowH);
    this.doc.rect(L, this.y, CONTENT_W, headerH).fill(MAROON_LIGHT);
    this.doc.rect(L, this.y, 4, headerH).fill(MAROON);
    this.text(title, L + 12, this.y + 8, titleStyle, CONTENT_W - 24);
    this.y += headerH + 8;

    this.row(headerCells, tableOpts);
    items.forEach((it, idx) => {
      const cells = itemCells(it, idx);
      if (this.y + this.rowHeight(cells, tableOpts) > BOTTOM) {
        this.newPage();
        this.row(headerCells, tableOpts);
      }
      this.row(cells, tableOpts);
    });
    this.y += 16;
  }

  private totals(q: QuotePdfQuote, settings: QuotePdfSettings) {
    const discountType = q.discount_type === 'percent' ? 'percent' : 'amount';
    const discountValue = Number(q.discount_value) || 0;
    const gst = Number(q.gst_percent) || 0;
    const b = quoteBreakdown(q.sections ?? [], discountType, discountValue, gst, settings.round_amounts !== false);

    const rows: [string, string][] = [['Subtotal', formatInr(b.subtotal)]];
    if (b.discount > 0) {
      rows.push([
        discountType === 'percent' ? `Discount (${trimNum(discountValue)}%)` : 'Discount',
        `- ${formatInr(b.discount)}`,
      ]);
    }
    if (gst > 0) rows.push([`GST (${trimNum(gst)}%)`, `+ ${formatInr(b.gstAmount)}`]);
    if (b.roundOff !== 0) {
      rows.push(['Round Off', `${b.roundOff > 0 ? '+' : '-'} ${formatInr(Math.abs(b.roundOff))}`]);
    }

    const w = 260;
    const x = L + CONTENT_W - w;
    const labelStyle: TextStyle = { size: 10, color: GREY };
    const valueStyle: TextStyle = { font: 'bold', size: 11, align: 'right' };
    const grandLabel: TextStyle = { font: 'bold', size: 13, color: MAROON };
    const grandValue: TextStyle = { font: 'bold', size: 14, color: MAROON, align: 'right' };
    const rowH = (a: string, s1: TextStyle, v: string, s2: TextStyle) =>
      Math.max(this.height(a, s1, w / 2), this.height(v, s2, w / 2)) + 6;
    const payable = formatInr(Math.max(0, b.payable));
    const total =
      rows.reduce((acc, [a, v]) => acc + rowH(a, labelStyle, v, valueStyle), 0) +
      9 +
      rowH('Grand Total', grandLabel, payable, grandValue);
    this.ensure(total);

    for (const [a, v] of rows) {
      const h = rowH(a, labelStyle, v, valueStyle);
      this.text(a, x, this.y + 3, labelStyle, w / 2);
      this.text(v, x + w / 2, this.y + 3, valueStyle, w / 2);
      this.y += h;
    }
    this.y += 4;
    this.doc.moveTo(x, this.y).lineTo(x + w, this.y).lineWidth(1).stroke(LINE_GREY);
    this.y += 5;
    this.text('Grand Total', x, this.y + 3, grandLabel, w / 2);
    this.text(payable, x + w / 2, this.y + 3, grandValue, w / 2);
    this.y += rowH('Grand Total', grandLabel, payable, grandValue);
  }

  private terms(terms: string) {
    const head: TextStyle = { font: 'bold', size: 11 };
    const body: TextStyle = { size: 9, color: GREY };
    this.y += 20;
    this.ensure(this.height('Terms & Conditions', head, CONTENT_W) + 4 + 14);
    this.text('Terms & Conditions', L, this.y, head, CONTENT_W);
    this.y += this.height('Terms & Conditions', head, CONTENT_W) + 4;
    // Long terms flow onto new pages (pdfkit paginates within the margins).
    this.text(terms, L, this.y, body, CONTENT_W, { lineGap: 1 });
    this.y = this.doc.y;
  }

  private signatures() {
    const lineW = 150;
    this.y += 30;
    this.ensure(40);
    const y = this.y + 20;
    const label: TextStyle = { size: 9, color: GREY, align: 'center' };
    for (const [x, t] of [
      [L, 'Client Signature'],
      [L + CONTENT_W - lineW, 'Authorised Signatory'],
    ] as [number, string][]) {
      this.doc.moveTo(x, y).lineTo(x + lineW, y).lineWidth(0.8).stroke(GREY);
      this.text(t, x, y + 4, label, lineW);
    }
    this.y = y + 20;
  }

  private footers(settings: QuotePdfSettings, hasCover: boolean) {
    const range = this.doc.bufferedPageRange();
    const first = range.start + (hasCover ? 1 : 0);
    const count = range.start + range.count - first;
    const left = settings.company_name ?? '';
    const mid = settings.footer_text?.trim()
      ? settings.footer_text
      : [settings.email, settings.phone].filter((v) => v && v.trim()).join('  •  ');
    const style: TextStyle = { size: 8, color: GREY };
    const lineY = PAGE_H - 46;
    for (let i = first; i < range.start + range.count; i++) {
      this.doc.switchToPage(i);
      const savedBottom = this.doc.page.margins.bottom;
      this.doc.page.margins.bottom = 0; // writing inside the bottom margin must not add a page
      this.doc.moveTo(L, lineY).lineTo(L + CONTENT_W, lineY).lineWidth(1).stroke(LINE_GREY);
      const opts = { height: 14, ellipsis: true };
      this.text(left, L, lineY + 6, style, 160, opts);
      this.text(mid, L + 165, lineY + 6, { ...style, align: 'center' }, CONTENT_W - 165 - 95, opts);
      this.text(`Page ${i - first + 1}/${count}`, L + CONTENT_W - 90, lineY + 6, { ...style, align: 'right' }, 90, opts);
      this.doc.page.margins.bottom = savedBottom;
    }
  }

  // ------------------------------------------------------------ table rows
  private cellHeight(c: Cell, padX: number): number {
    const w = Math.max(1, c.width - padX * 2);
    const main = this.height(c.text || ' ', c.style, w);
    return c.sub ? main + this.height(c.sub.text, c.sub.style, w) : main;
  }

  private rowHeight(cells: Cell[], o: { padX: number; padY: number }): number {
    return Math.max(...cells.map((c) => this.cellHeight(c, o.padX))) + o.padY * 2;
  }

  private row(cells: Cell[], o: { padX: number; padY: number; border: string; borderWidth: number }) {
    const h = this.rowHeight(cells, o);
    let x = L;
    for (const c of cells) {
      if (c.fill) this.doc.rect(x, this.y, c.width, h).fill(c.fill);
      this.doc.rect(x, this.y, c.width, h).lineWidth(o.borderWidth).stroke(o.border);
      const w = Math.max(1, c.width - o.padX * 2);
      this.text(c.text, x + o.padX, this.y + o.padY, c.style, w);
      if (c.sub) {
        const mainH = this.height(c.text || ' ', c.style, w);
        this.text(c.sub.text, x + o.padX, this.y + o.padY + mainH, c.sub.style, w);
      }
      x += c.width;
    }
    this.y += h;
  }
}

/** Render the quotation PDF to bytes. */
export function renderQuotePdf(
  quote: QuotePdfQuote,
  settings: QuotePdfSettings,
  assets: QuotePdfAssets = {},
): Promise<Buffer> {
  const w = new QuotePdfWriter(assets);
  const chunks: Buffer[] = [];
  return new Promise<Buffer>((resolve, reject) => {
    w.doc.on('data', (c: Buffer) => chunks.push(c));
    w.doc.on('end', () => resolve(Buffer.concat(chunks)));
    w.doc.on('error', reject);
    try {
      w.doc.info.Title = `Quotation ${quote.quote_number ?? ''}`.trim();
      if (settings.company_name) w.doc.info.Author = settings.company_name;
      w.render(quote, settings);
      w.doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
