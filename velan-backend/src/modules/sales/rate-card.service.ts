import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  CatalogVariantDto,
  CreateCatalogItemDto,
  CreateQuoteTemplateDto,
  UpdateCatalogItemDto,
  UpdateQuoteTemplateDto,
} from './dto/rate-card.dto';
import { parseTemplateSections, summarizeErrors } from './quote-sections';

const CATALOG_COLUMNS: [keyof UpdateCatalogItemDto, string][] = [
  ['name', 'name'],
  ['description', 'description'],
  ['itemType', 'item_type'],
  ['uom', 'uom'],
  ['defaultSection', 'default_section'],
  ['active', 'active'],
];

/**
 * Rate card (catalog_items) and quote templates. Reads: head + managers.
 * Writes: head only (enforced by the controller). Catalog deletes are soft
 * (active = false) because existing quotes reference items by id; templates
 * have no active flag and are deleted outright.
 */
@Injectable()
export class RateCardService {
  constructor(private readonly supabase: SupabaseService) {}

  private db() {
    return this.supabase.admin();
  }

  // ------------------------------------------------------------ catalog
  async listCatalog(includeInactive = false): Promise<unknown[]> {
    let q = this.db().from('catalog_items').select('*');
    if (!includeInactive) q = q.eq('active', true);
    const { data, error } = await q.order('name');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async getCatalogItem(id: string) {
    const { data, error } = await this.db().from('catalog_items').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Catalog item not found');
    return data;
  }

  async createCatalogItem(dto: CreateCatalogItemDto) {
    const row = toCatalogRow(dto);
    const { data, error } = await this.db().from('catalog_items').insert(row).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateCatalogItem(id: string, dto: UpdateCatalogItemDto) {
    const patch = toCatalogRow(dto);
    if (Object.keys(patch).length === 0) return this.getCatalogItem(id);
    const { data, error } = await this.db()
      .from('catalog_items')
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Catalog item not found');
    return data;
  }

  /** Soft delete: the row stays (quotes reference it) but leaves the rate card. */
  async removeCatalogItem(id: string) {
    return this.updateCatalogItem(id, { active: false });
  }

  // ------------------------------------------------------------ templates
  async listTemplates(): Promise<unknown[]> {
    const { data, error } = await this.db().from('quote_templates').select('*').order('name');
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async getTemplate(id: string) {
    const { data, error } = await this.db().from('quote_templates').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Template not found');
    return data;
  }

  async createTemplate(dto: CreateQuoteTemplateDto) {
    const row = { name: dto.name, sections: templateSections(dto.sections ?? []) };
    const { data, error } = await this.db().from('quote_templates').insert(row).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateTemplate(id: string, dto: UpdateQuoteTemplateDto) {
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.sections !== undefined) patch.sections = templateSections(dto.sections);
    if (Object.keys(patch).length === 0) return this.getTemplate(id);
    const { data, error } = await this.db()
      .from('quote_templates')
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Template not found');
    return data;
  }

  async removeTemplate(id: string) {
    const { data, error } = await this.db().from('quote_templates').delete().eq('id', id).select('id');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new NotFoundException('Template not found');
    return { deleted: true };
  }
}

export function toCatalogRow(dto: UpdateCatalogItemDto): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, col] of CATALOG_COLUMNS) {
    if (dto[key] !== undefined) row[col] = dto[key];
  }
  if (dto.variants !== undefined) row.variants = dto.variants.map(toVariant);
  return row;
}

const toVariant = (v: CatalogVariantDto) =>
  v.id === undefined ? { label: v.label, rate: v.rate } : { id: v.id, label: v.label, rate: v.rate };

function templateSections(input: unknown) {
  const { value, errors } = parseTemplateSections(input);
  if (errors.length > 0) throw new BadRequestException(summarizeErrors(errors));
  return value;
}
