import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Env } from '../../config/env.validation';
import { SupabaseService } from '../../supabase/supabase.service';
import { QuotationSettingsDto } from './dto/rate-card.dto';
import {
  DEFAULT_PROJECT_TYPE,
  DEFAULT_QUOTE_PREFIX,
  DEFAULT_VALIDITY_DAYS,
} from './sales.constants';
import { normalizeQuotationRef } from './sales-refs';

/** The quotation_settings row as stored (snake_case). */
export interface QuotationSettingsRow {
  id?: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  watermark_logo_url: string | null;
  cover_image_url: string | null;
  footer_text: string | null;
  default_terms: string | null;
  default_not_included: string[];
  quote_validity_days: number;
  quote_number_prefix: string;
  default_project_type: string;
  default_gst_percent: number | string;
  round_amounts: boolean;
}

/** Column defaults from the sales_crm migration (used when no row exists yet). */
export const DEFAULT_SETTINGS: QuotationSettingsRow = {
  company_name: null,
  phone: null,
  email: null,
  address: null,
  logo_url: null,
  watermark_logo_url: null,
  cover_image_url: null,
  footer_text: null,
  default_terms: null,
  default_not_included: [],
  quote_validity_days: DEFAULT_VALIDITY_DAYS,
  quote_number_prefix: DEFAULT_QUOTE_PREFIX,
  default_project_type: DEFAULT_PROJECT_TYPE,
  default_gst_percent: 0,
  round_amounts: true,
};

const SETTINGS_COLUMNS: [keyof QuotationSettingsDto, keyof QuotationSettingsRow][] = [
  ['companyName', 'company_name'],
  ['phone', 'phone'],
  ['email', 'email'],
  ['address', 'address'],
  ['logoUrl', 'logo_url'],
  ['watermarkLogoUrl', 'watermark_logo_url'],
  ['coverImageUrl', 'cover_image_url'],
  ['footerText', 'footer_text'],
  ['defaultTerms', 'default_terms'],
  ['defaultNotIncluded', 'default_not_included'],
  ['quoteValidityDays', 'quote_validity_days'],
  ['quoteNumberPrefix', 'quote_number_prefix'],
  ['defaultProjectType', 'default_project_type'],
  ['defaultGstPercent', 'default_gst_percent'],
  ['roundAmounts', 'round_amounts'],
];

const IMAGE_FIELDS: (keyof QuotationSettingsDto)[] = ['logoUrl', 'watermarkLogoUrl', 'coverImageUrl'];

/** Single-row branding/defaults for quotes and the PDF. */
@Injectable()
export class QuotationSettingsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private db() {
    return this.supabase.admin();
  }

  /** Addresses whose storage URLs are ours (for normalising echoed signed URLs). */
  storageBases(): string[] {
    const internal = this.config.get('SUPABASE_URL', { infer: true });
    const pub = this.config.get('SUPABASE_PUBLIC_URL', { infer: true });
    return pub ? [pub, internal] : [internal];
  }

  /** `sb://quotations/...` ref (or legacy https URL / null); 400 when not allowed. */
  normalizeRef(field: string, value: unknown): string | null {
    const res = normalizeQuotationRef(value, this.storageBases());
    if (!res.ok) throw new BadRequestException(`${field}: ${res.reason}`);
    return res.value;
  }

  /** The stored row, or null when settings were never saved (API contract). */
  async get(): Promise<QuotationSettingsRow | null> {
    const { data, error } = await this.db()
      .from('quotation_settings')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as QuotationSettingsRow | null;
  }

  /** The stored row, or the column defaults. */
  async getEffective(): Promise<QuotationSettingsRow> {
    return (await this.get()) ?? DEFAULT_SETTINGS;
  }

  async put(dto: QuotationSettingsDto) {
    const patch: Record<string, unknown> = {};
    for (const [key, col] of SETTINGS_COLUMNS) {
      if (dto[key] === undefined) continue;
      patch[col] = IMAGE_FIELDS.includes(key) ? this.normalizeRef(key, dto[key]) : dto[key];
    }

    const existing = await this.get();
    if (existing?.id) {
      if (Object.keys(patch).length === 0) return existing;
      const { data, error } = await this.db()
        .from('quotation_settings')
        .update(patch)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    const { data, error } = await this.db().from('quotation_settings').insert(patch).select().single();
    if (error) throw new Error(error.message);
    return data;
  }
}
