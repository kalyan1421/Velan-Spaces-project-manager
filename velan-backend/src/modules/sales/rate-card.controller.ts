import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  CreateCatalogItemDto,
  CreateQuoteTemplateDto,
  QuotationSettingsDto,
  UpdateCatalogItemDto,
  UpdateQuoteTemplateDto,
} from './dto/rate-card.dto';
import { QuotationSettingsService } from './quotation-settings.service';
import { RateCardService } from './rate-card.service';

/** Rate card, quote templates and quotation settings. Reads: head + managers; writes: head. */
@ApiTags('sales')
@ApiBearerAuth()
@Roles('head', 'manager')
@Controller()
export class RateCardController {
  constructor(
    private readonly rateCard: RateCardService,
    private readonly settings: QuotationSettingsService,
  ) {}

  // ------------------------------------------------------------ catalog items
  @Get('catalog-items')
  @ApiOperation({ summary: 'Rate card, by name (active items unless includeInactive=true)' })
  @ApiQuery({ name: 'includeInactive', required: false, type: Boolean })
  listCatalog(@Query('includeInactive') includeInactive?: string) {
    return this.rateCard.listCatalog(includeInactive === 'true');
  }

  @Get('catalog-items/:id')
  @ApiOperation({ summary: 'Get one catalog item' })
  getCatalogItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.rateCard.getCatalogItem(id);
  }

  @Post('catalog-items')
  @Roles('head')
  @ApiOperation({ summary: 'Add a rate-card item (head only)' })
  createCatalogItem(@Body() dto: CreateCatalogItemDto) {
    return this.rateCard.createCatalogItem(dto);
  }

  @Patch('catalog-items/:id')
  @Roles('head')
  @ApiOperation({ summary: 'Edit a rate-card item (head only; active=true restores a deleted one)' })
  updateCatalogItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCatalogItemDto) {
    return this.rateCard.updateCatalogItem(id, dto);
  }

  @Delete('catalog-items/:id')
  @Roles('head')
  @ApiOperation({ summary: 'Soft-delete a rate-card item (active=false; head only). Returns the row.' })
  removeCatalogItem(@Param('id', ParseUUIDPipe) id: string) {
    return this.rateCard.removeCatalogItem(id);
  }

  // ------------------------------------------------------------ templates
  @Get('quote-templates')
  @ApiOperation({ summary: 'Quote templates, by name' })
  listTemplates() {
    return this.rateCard.listTemplates();
  }

  @Get('quote-templates/:id')
  @ApiOperation({ summary: 'Get one quote template' })
  getTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.rateCard.getTemplate(id);
  }

  @Post('quote-templates')
  @Roles('head')
  @ApiOperation({ summary: 'Create a quote template (head only)' })
  createTemplate(@Body() dto: CreateQuoteTemplateDto) {
    return this.rateCard.createTemplate(dto);
  }

  @Patch('quote-templates/:id')
  @Roles('head')
  @ApiOperation({ summary: 'Edit a quote template (head only)' })
  updateTemplate(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateQuoteTemplateDto) {
    return this.rateCard.updateTemplate(id, dto);
  }

  @Delete('quote-templates/:id')
  @Roles('head')
  @ApiOperation({ summary: 'Delete a quote template (head only)' })
  removeTemplate(@Param('id', ParseUUIDPipe) id: string) {
    return this.rateCard.removeTemplate(id);
  }

  // ------------------------------------------------------------ settings
  @Get('quotation-settings')
  @ApiOperation({ summary: 'Quotation branding/defaults (null until first saved)' })
  getSettings() {
    return this.settings.get();
  }

  @Put('quotation-settings')
  @Roles('head')
  @ApiOperation({ summary: 'Save quotation settings (head only; partial — omitted fields keep their value)' })
  putSettings(@Body() dto: QuotationSettingsDto) {
    return this.settings.put(dto);
  }
}
