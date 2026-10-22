import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { computeQuoteTotals, DiscountType } from '../../common/calc';
import { QuoteDto } from './dto/quote.dto';
import { formatQuoteNumber, quoteYear } from './quote-number';
import { parseQuoteSections, QuoteSectionData, summarizeErrors, withLineAmounts } from './quote-sections';
import { DiscountTypeInput } from './sales.constants';
import { QuotationSettingsRow, QuotationSettingsService } from './quotation-settings.service';

/** A quotes row as stored (snake_case). */
export interface QuoteRow {
  id: string;
  lead_id: string | null;
  quote_number: string | null;
  status: string;
  prepared_for_name: string | null;
  prepared_for_phone: string | null;
  prepared_for_email: string | null;
  prepared_for_address: string | null;
  pdf_url: string | null;
  handled_by: string | null;
  designed_by: string | null;
  quote_date: string | null;
  valid_until: string | null;
  enquiry_date: string | null;
  enquiry_no: string | null;
  site_location: string | null;
  project_type: string;
  not_included: string[];
  sections: QuoteSectionData[];
  discount_type: string;
  discount_value: number | string;
  gst_percent: number | string;
  subtotal: number | string;
  grand_total: number | string;
  created_at: string;
  updated_at: string;
}

interface LeadRow {
  id: string;
  client_name: string | null;
  client_phone: string | null;
  area: string | null;
  project_type: string | null;
  created_at: string | null;
}

/** Plain columns copied from the body when present (undefined = untouched). */
const QUOTE_COLUMNS: [keyof QuoteDto, keyof QuoteRow][] = [
  ['leadId', 'lead_id'],
  ['status', 'status'],
  ['preparedForName', 'prepared_for_name'],
  ['preparedForPhone', 'prepared_for_phone'],
  ['preparedForEmail', 'prepared_for_email'],
  ['preparedForAddress', 'prepared_for_address'],
  ['handledBy', 'handled_by'],
  ['designedBy', 'designed_by'],
  ['quoteDate', 'quote_date'],
  ['validUntil', 'valid_until'],
  ['enquiryDate', 'enquiry_date'],
  ['enquiryNo', 'enquiry_no'],
  ['siteLocation', 'site_location'],
  ['projectType', 'project_type'],
  ['notIncluded', 'not_included'],
  ['discountValue', 'discount_value'],
  ['gstPercent', 'gst_percent'],
];

const DAY_MS = 24 * 60 * 60 * 1000;

export const normalizeDiscountType = (t: DiscountTypeInput | string | null | undefined): DiscountType =>
  t === 'percent' ? 'percent' : 'amount';

/**
 * subtotal / grand_total for a quote row, from its sections (never from
 * client-sent totals). Same maths as computeQuoteTotals; a grand total below
 * zero (discount larger than the subtotal, e.g. mid-draft) is stored as 0,
 * as the mobile app does.
 */
export function quoteTotalsForRow(
  sections: QuoteSectionData[],
  discountType: string,
  discountValue: number | string,
  gstPercent: number | string,
): { subtotal: number; grand_total: number } {
  const t = computeQuoteTotals(
    sections,
    normalizeDiscountType(discountType),
    Number(discountValue) || 0,
    Number(gstPercent) || 0,
  );
  return { subtotal: t.subtotal, grand_total: Math.max(0, t.grandTotal) };
}

export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY_MS).toISOString();
}

/**
 * Quotes. Access: head + managers (same as the mobile app). Numbers are
 * assigned here — "<prefix>-<YYYY>-<NNNN>" from the atomic SQL counter — and
 * client-sent numbers/totals are ignored.
 */
@Injectable()
export class QuotesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly settings: QuotationSettingsService,
  ) {}

  private db() {
    return this.supabase.admin();
  }

  async list(filter: { leadId?: string } = {}): Promise<unknown[]> {
    let q = this.db().from('quotes').select('*').order('created_at', { ascending: false });
    if (filter.leadId) q = q.eq('lead_id', filter.leadId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async get(id: string): Promise<QuoteRow> {
    const { data, error } = await this.db().from('quotes').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Quote not found');
    return data as QuoteRow;
  }

  async create(dto: QuoteDto) {
    const settings = await this.settings.getEffective();
    const lead = dto.leadId ? await this.getLead(dto.leadId) : null;
    const now = new Date().toISOString();

    const row = this.toRow(dto, settings.round_amounts);
    const quoteDate = (row.quote_date as string | null | undefined) === undefined ? now : row.quote_date;
    const sections = (row.sections as QuoteSectionData[] | undefined) ?? [];
    const discountType = (row.discount_type as string | undefined) ?? 'amount';
    const discountValue = (row.discount_value as number | undefined) ?? 0;
    const gstPercent = (row.gst_percent as number | undefined) ?? (Number(settings.default_gst_percent) || 0);
    assertDiscount(discountType, discountValue);

    const insert: Record<string, unknown> = {
      ...row,
      status: row.status ?? 'draft',
      prepared_for_name: pick(row.prepared_for_name, lead?.client_name),
      prepared_for_phone: pick(row.prepared_for_phone, lead?.client_phone),
      site_location: pick(row.site_location, lead?.area),
      enquiry_date: pick(row.enquiry_date, lead?.created_at),
      project_type: row.project_type ?? (lead?.project_type || settings.default_project_type),
      not_included: row.not_included ?? settings.default_not_included ?? [],
      quote_date: quoteDate,
      valid_until:
        row.valid_until !== undefined
          ? row.valid_until
          : quoteDate
            ? addDays(quoteDate as string, settings.quote_validity_days)
            : null,
      sections,
      discount_type: discountType,
      discount_value: discountValue,
      gst_percent: gstPercent,
      ...quoteTotalsForRow(sections, discountType, discountValue, gstPercent),
      quote_number: await this.nextQuoteNumber(settings),
    };
    const { data, error } = await this.db().from('quotes').insert(insert).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async update(id: string, dto: QuoteDto) {
    const existing = await this.get(id);
    if (dto.leadId) await this.getLead(dto.leadId);
    const patch = this.toRow(
      dto,
      dto.sections !== undefined ? (await this.settings.getEffective()).round_amounts : true,
    );

    // Totals always follow the merged sections/discount/GST.
    const sections = (patch.sections as QuoteSectionData[] | undefined) ?? existing.sections ?? [];
    const discountType = (patch.discount_type as string | undefined) ?? existing.discount_type;
    const discountValue = (patch.discount_value as number | undefined) ?? Number(existing.discount_value);
    const gstPercent = (patch.gst_percent as number | undefined) ?? Number(existing.gst_percent);
    assertDiscount(discountType, discountValue);
    Object.assign(patch, quoteTotalsForRow(sections, discountType, discountValue, gstPercent));

    const { data, error } = await this.db()
      .from('quotes')
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Quote not found');
    return data;
  }

  async remove(id: string) {
    const { data, error } = await this.db().from('quotes').delete().eq('id', id).select('id');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new NotFoundException('Quote not found');
    // The hosted PDF (pdf_url) is left in storage on purpose: "attach to
    // project" points a client-visible design at the same file.
    return { deleted: true };
  }

  /** Copy as a new draft with a new number, dated today; no hosted PDF. */
  async duplicate(id: string) {
    const src = await this.get(id);
    const settings = await this.settings.getEffective();
    const now = new Date().toISOString();
    const sections = src.sections ?? [];
    const insert = {
      lead_id: src.lead_id,
      status: 'draft',
      prepared_for_name: src.prepared_for_name,
      prepared_for_phone: src.prepared_for_phone,
      prepared_for_email: src.prepared_for_email,
      prepared_for_address: src.prepared_for_address,
      pdf_url: null,
      handled_by: src.handled_by,
      designed_by: src.designed_by,
      quote_date: now,
      valid_until: addDays(now, settings.quote_validity_days),
      enquiry_date: src.enquiry_date,
      enquiry_no: src.enquiry_no,
      site_location: src.site_location,
      project_type: src.project_type,
      not_included: src.not_included ?? [],
      sections,
      discount_type: src.discount_type,
      discount_value: src.discount_value,
      gst_percent: src.gst_percent,
      ...quoteTotalsForRow(sections, src.discount_type, src.discount_value, src.gst_percent),
      quote_number: await this.nextQuoteNumber(settings),
    };
    const { data, error } = await this.db().from('quotes').insert(insert).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  /** Atomic per-year sequence (SQL next_quote_seq) formatted with the settings prefix. */
  async nextQuoteNumber(settings: Pick<QuotationSettingsRow, 'quote_number_prefix'>): Promise<string> {
    const year = quoteYear();
    const { data, error } = await this.db().rpc('next_quote_seq', { p_year: year });
    if (error) throw new Error(error.message);
    const seq = Number(data);
    if (!Number.isInteger(seq) || seq < 1) throw new Error('next_quote_seq returned no number');
    return formatQuoteNumber(settings.quote_number_prefix, year, seq);
  }

  /**
   * Body -> row columns (only keys present). Validates sections, recomputes
   * their line amounts, and validates the PDF ref.
   */
  private toRow(dto: QuoteDto, roundAmounts: boolean): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (const [key, col] of QUOTE_COLUMNS) {
      if (dto[key] !== undefined) row[col] = dto[key];
    }
    if (dto.discountType !== undefined) row.discount_type = normalizeDiscountType(dto.discountType);
    if (dto.pdfUrl !== undefined) row.pdf_url = this.settings.normalizeRef('pdfUrl', dto.pdfUrl);
    if (dto.sections !== undefined) {
      const { value, errors } = parseQuoteSections(dto.sections);
      if (errors.length > 0) throw new BadRequestException(summarizeErrors(errors));
      row.sections = withLineAmounts(value, roundAmounts);
    }
    return row;
  }

  private async getLead(id: string): Promise<LeadRow> {
    const { data, error } = await this.db()
      .from('leads')
      .select('id, client_name, client_phone, area, project_type, created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new BadRequestException('Lead not found');
    return data as LeadRow;
  }
}

/** Body value when the key was sent (even null), else the fallback. */
function pick<T>(value: unknown, fallback: T | null | undefined): unknown {
  return value !== undefined ? value : (fallback ?? null);
}

function assertDiscount(discountType: string, discountValue: number) {
  if (normalizeDiscountType(discountType) === 'percent' && discountValue > 100) {
    throw new BadRequestException('a percent discount must be at most 100');
  }
}
