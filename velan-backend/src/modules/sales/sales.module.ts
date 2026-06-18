import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { SupabaseService } from '../../supabase/supabase.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { computeQuoteTotals, DiscountType } from '../../common/calc';

// ---------------------------------------------------------------- DTOs
class LeadDto {
  @ApiProperty() @IsString() clientName!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() clientPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() area?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() source?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() estimatedBudget?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() assignedManagerId?: string;
}

class QuoteDto {
  @ApiPropertyOptional() @IsOptional() @IsString() leadId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() quoteNumber?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() preparedForName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() projectType?: string;
  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  sections?: unknown[];
  @ApiPropertyOptional() @IsOptional() @IsNumber() discountValue?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() discountType?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() gstPercent?: number;
}

// ---------------------------------------------------------------- Service
@Injectable()
class SalesService {
  constructor(private readonly supabase: SupabaseService) {}
  private db() {
    return this.supabase.admin();
  }

  listLeads() {
    return this.q('leads', (b) => b.order('created_at', { ascending: false }));
  }

  async createLead(dto: LeadDto) {
    const { data, error } = await this.db()
      .from('leads')
      .insert({
        client_name: dto.clientName,
        client_phone: dto.clientPhone,
        area: dto.area,
        project_type: dto.projectType,
        source: dto.source,
        estimated_budget: dto.estimatedBudget,
        notes: dto.notes,
        status: dto.status ?? 'new',
        assigned_manager_id: dto.assignedManagerId ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updateLead(id: string, dto: Partial<LeadDto>) {
    const patch: Record<string, unknown> = {};
    if (dto.clientName !== undefined) patch.client_name = dto.clientName;
    if (dto.clientPhone !== undefined) patch.client_phone = dto.clientPhone;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.notes !== undefined) patch.notes = dto.notes;
    if (dto.assignedManagerId !== undefined)
      patch.assigned_manager_id = dto.assignedManagerId;
    const { data, error } = await this.db()
      .from('leads')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  listQuotes() {
    return this.q('quotes', (b) => b.order('created_at', { ascending: false }));
  }

  /** Compute totals server-side from sections -> items. */
  async createQuote(dto: QuoteDto) {
    const totals = computeQuoteTotals(
      (dto.sections ?? []) as { items?: { amount?: number | string }[] }[],
      (dto.discountType as DiscountType) ?? 'amount',
      dto.discountValue ?? 0,
      dto.gstPercent ?? 0,
    );
    const { data, error } = await this.db()
      .from('quotes')
      .insert({
        lead_id: dto.leadId ?? null,
        quote_number: dto.quoteNumber,
        status: dto.status ?? 'draft',
        prepared_for_name: dto.preparedForName,
        project_type: dto.projectType ?? 'Residential',
        sections: dto.sections ?? [],
        discount_type: dto.discountType ?? 'amount',
        discount_value: dto.discountValue ?? 0,
        gst_percent: dto.gstPercent ?? 0,
        subtotal: totals.subtotal,
        grand_total: totals.grandTotal,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  listCatalog() {
    return this.q('catalog_items', (b) => b.eq('active', true).order('name'));
  }

  listTemplates() {
    return this.q('quote_templates', (b) => b.order('name'));
  }

  async getSettings() {
    const { data, error } = await this.db()
      .from('quotation_settings')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  }

  async putSettings(body: Record<string, unknown>) {
    const existing = await this.getSettings();
    if (existing) {
      const { data, error } = await this.db()
        .from('quotation_settings')
        .update(body)
        .eq('id', (existing as { id: string }).id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    const { data, error } = await this.db()
      .from('quotation_settings')
      .insert(body)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  private async q(
    table: string,
    build: (b: any) => any,
  ): Promise<unknown[]> {
    const { data, error } = await build(this.db().from(table).select('*'));
    if (error) throw new Error(error.message);
    return data;
  }
}

// ---------------------------------------------------------------- Controller
@ApiTags('sales')
@ApiBearerAuth()
@Roles('head', 'manager')
@Controller()
class SalesController {
  constructor(private readonly svc: SalesService) {}

  @Get('leads')
  listLeads() {
    return this.svc.listLeads();
  }
  @Post('leads')
  createLead(@Body() dto: LeadDto) {
    return this.svc.createLead(dto);
  }
  @Patch('leads/:id')
  updateLead(@Param('id') id: string, @Body() dto: LeadDto) {
    return this.svc.updateLead(id, dto);
  }

  @Get('quotes')
  listQuotes() {
    return this.svc.listQuotes();
  }
  @Post('quotes')
  @ApiOperation({ summary: 'Create a quote (totals computed server-side)' })
  createQuote(@Body() dto: QuoteDto) {
    return this.svc.createQuote(dto);
  }

  @Get('catalog-items')
  listCatalog() {
    return this.svc.listCatalog();
  }
  @Get('quote-templates')
  listTemplates() {
    return this.svc.listTemplates();
  }

  @Get('quotation-settings')
  getSettings() {
    return this.svc.getSettings();
  }
  @Put('quotation-settings')
  putSettings(@Body() body: Record<string, unknown>) {
    return this.svc.putSettings(body);
  }
}

@Module({
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
