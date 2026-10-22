import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ITEM_TYPES, ItemType, MAX_NOT_INCLUDED, MAX_VARIANTS } from '../sales.constants';
import { MAX_REF_LENGTH } from '../sales-refs';
import { IsTemplateSections, OptionalNotNull, trim, trimList, trimOrNull } from './transforms';

// ---------------------------------------------------------------- catalog items (rate card)
export class CatalogVariantDto {
  @ApiPropertyOptional({ maxLength: 100, description: 'Optional client-side key; stored as sent' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  id?: string;

  @ApiProperty({ maxLength: 200, example: 'Carcass • Premium' })
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  label!: string;

  @ApiProperty({ minimum: 0, example: 1450, description: '₹ per sq.ft (component), per unit (accessory) or per UOM (service)' })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1e9)
  rate!: number;
}

class CatalogFieldsDto {
  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({ enum: ITEM_TYPES, nullable: true })
  @IsOptional()
  @IsIn(ITEM_TYPES)
  itemType?: ItemType | null;

  @ApiPropertyOptional({ maxLength: 40, nullable: true, example: 'Sq.Ft', description: 'Services: Sq.Ft | Point | No | Rft' })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  uom?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true, example: 'Modular Kitchen' })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  defaultSection?: string | null;

  @ApiPropertyOptional({ type: [CatalogVariantDto], maxItems: MAX_VARIANTS })
  @OptionalNotNull()
  @IsArray()
  @ArrayMaxSize(MAX_VARIANTS)
  @ValidateNested({ each: true })
  @Type(() => CatalogVariantDto)
  variants?: CatalogVariantDto[];

  @ApiPropertyOptional({ default: true, description: 'false hides the item from the rate card (DELETE sets this)' })
  @OptionalNotNull()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ readOnly: true }) @Allow() id?: unknown;
  @ApiPropertyOptional({ readOnly: true }) @Allow() createdAt?: unknown;
  @ApiPropertyOptional({ readOnly: true }) @Allow() legacyFirestoreId?: unknown;
}

export class CreateCatalogItemDto extends CatalogFieldsDto {
  @ApiProperty({ minLength: 1, maxLength: 200, example: 'Base Unit' })
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  name!: string;
}

export class UpdateCatalogItemDto extends CatalogFieldsDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 200 })
  @Transform(trim)
  @OptionalNotNull()
  @IsString()
  @Length(1, 200)
  name?: string;
}

// ---------------------------------------------------------------- quote templates
class TemplateFieldsDto {
  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object' },
    description:
      '[{ id?, title, type: component|accessory|service, lines: [{ id?, catalogItemId, name, itemType, ' +
      'variantLabel, defaultLengthMm, defaultHeightMm, defaultQty, uom }] }]. Unknown keys are dropped.',
  })
  @OptionalNotNull()
  @IsTemplateSections()
  sections?: unknown[];

  @ApiPropertyOptional({ readOnly: true }) @Allow() id?: unknown;
  @ApiPropertyOptional({ readOnly: true }) @Allow() createdAt?: unknown;
  @ApiPropertyOptional({ readOnly: true }) @Allow() legacyFirestoreId?: unknown;
}

export class CreateQuoteTemplateDto extends TemplateFieldsDto {
  @ApiProperty({ minLength: 1, maxLength: 200, example: 'Standard 3BHK' })
  @Transform(trim)
  @IsString()
  @Length(1, 200)
  name!: string;
}

export class UpdateQuoteTemplateDto extends TemplateFieldsDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 200 })
  @Transform(trim)
  @OptionalNotNull()
  @IsString()
  @Length(1, 200)
  name?: string;
}

// ---------------------------------------------------------------- quotation settings
/** Letters/digits first, then letters, digits, '_' or '-' (a trailing '-' is fine). */
export const QUOTE_PREFIX_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/;

/**
 * PUT /quotation-settings (head only). Partial: omitted fields keep their
 * value. Image fields take `sb://quotations/quotation/...` (or the signed URL
 * the API returned); '' / null clears them.
 */
export class QuotationSettingsDto {
  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string | null;

  @ApiPropertyOptional({ maxLength: 40, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @ApiPropertyOptional({ maxLength: 254, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Header logo (also the watermark when none is set)' })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_REF_LENGTH)
  logoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_REF_LENGTH)
  watermarkLogoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Full-page cover (first PDF page)' })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_REF_LENGTH)
  coverImageUrl?: string | null;

  @ApiPropertyOptional({ maxLength: 300, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  footerText?: string | null;

  @ApiPropertyOptional({ maxLength: 20000, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  defaultTerms?: string | null;

  @ApiPropertyOptional({ type: [String], maxItems: MAX_NOT_INCLUDED })
  @Transform(trimList)
  @OptionalNotNull()
  @IsArray()
  @ArrayMaxSize(MAX_NOT_INCLUDED)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  defaultNotIncluded?: string[];

  @ApiPropertyOptional({ minimum: 1, maximum: 365, default: 15 })
  @OptionalNotNull()
  @IsInt()
  @Min(1)
  @Max(365)
  quoteValidityDays?: number;

  @ApiPropertyOptional({
    maxLength: 20,
    pattern: QUOTE_PREFIX_RE.source,
    default: 'QUO-',
    description: 'Quote numbers are <prefix>-<YYYY>-<NNNN>; a trailing "-" is not doubled',
  })
  @Transform(trim)
  @OptionalNotNull()
  @IsString()
  @Matches(QUOTE_PREFIX_RE, {
    message: 'quoteNumberPrefix must be 1-20 letters, digits, "_" or "-" and start with a letter or digit',
  })
  quoteNumberPrefix?: string;

  @ApiPropertyOptional({ minLength: 1, maxLength: 60, default: 'Residential' })
  @Transform(trim)
  @OptionalNotNull()
  @IsString()
  @Length(1, 60)
  defaultProjectType?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, default: 0 })
  @OptionalNotNull()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  defaultGstPercent?: number;

  @ApiPropertyOptional({ default: true, description: 'Round the PDF grand total to whole rupees (round-off line)' })
  @OptionalNotNull()
  @IsBoolean()
  roundAmounts?: boolean;

  @ApiPropertyOptional({ readOnly: true }) @Allow() id?: unknown;
  @ApiPropertyOptional({ readOnly: true }) @Allow() updatedAt?: unknown;
  @ApiPropertyOptional({ readOnly: true }) @Allow() legacyFirestoreId?: unknown;
}
