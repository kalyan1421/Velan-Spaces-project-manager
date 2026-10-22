import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidationArguments,
} from 'class-validator';
import {
  DISCOUNT_TYPES,
  DiscountTypeInput,
  MAX_NOT_INCLUDED,
  QUOTE_STATUSES,
  QuoteStatus,
} from '../sales.constants';
import { MAX_REF_LENGTH } from '../sales-refs';
import { IsQuoteSections, OptionalNotNull, trimList, trimOrNull, trimOrUndefined } from './transforms';

const MAX_DISCOUNT = 1e10;

/** discountValue ≤ 100 when the same body says discountType = percent. */
const PercentAtMost100 = () =>
  ValidateBy({
    name: 'percentAtMost100',
    validator: {
      validate: (v: unknown, args?: ValidationArguments) =>
        (args?.object as QuoteDto | undefined)?.discountType !== 'percent' ||
        (typeof v === 'number' && v <= 100),
      defaultMessage: () => 'a percent discount must be at most 100',
    },
  });

/**
 * Quote body for POST and PATCH (every field optional). Server-owned fields —
 * id, quoteNumber, subtotal, grandTotal, createdAt, updatedAt — are accepted
 * so a client can send back the object it read, but they are ignored:
 * numbers are assigned by the server and totals are recomputed from sections.
 */
export class QuoteDto {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsUUID()
  leadId?: string | null;

  @ApiPropertyOptional({ enum: QUOTE_STATUSES, default: 'draft' })
  @OptionalNotNull()
  @IsIn(QUOTE_STATUSES)
  status?: QuoteStatus;

  @ApiPropertyOptional({ maxLength: 200, nullable: true, description: 'Defaults to the lead\'s client name' })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  preparedForName?: string | null;

  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  preparedForPhone?: string | null;

  @ApiPropertyOptional({ maxLength: 254, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(254)
  preparedForEmail?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  preparedForAddress?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Hosted PDF: sb://quotations/quotation/... (or the signed URL you were given)',
  })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_REF_LENGTH)
  pdfUrl?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  handledBy?: string | null;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  designedBy?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true, description: 'Defaults to now on create' })
  @Transform(trimOrNull)
  @IsOptional()
  @IsISO8601()
  quoteDate?: string | null;

  @ApiPropertyOptional({
    format: 'date-time',
    nullable: true,
    description: 'Defaults to quoteDate + settings.quoteValidityDays on create',
  })
  @Transform(trimOrNull)
  @IsOptional()
  @IsISO8601()
  validUntil?: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsISO8601()
  enquiryDate?: string | null;

  @ApiPropertyOptional({ maxLength: 60, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  enquiryNo?: string | null;

  @ApiPropertyOptional({ maxLength: 300, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(300)
  siteLocation?: string | null;

  @ApiPropertyOptional({
    maxLength: 60,
    description: 'Defaults to settings.defaultProjectType; "" is ignored (keeps the current value)',
  })
  @Transform(trimOrUndefined)
  @OptionalNotNull()
  @IsString()
  @Length(1, 60)
  projectType?: string;

  @ApiPropertyOptional({
    type: [String],
    maxItems: MAX_NOT_INCLUDED,
    description: 'Defaults to settings.defaultNotIncluded on create',
  })
  @Transform(trimList)
  @OptionalNotNull()
  @IsArray()
  @ArrayMaxSize(MAX_NOT_INCLUDED)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  notIncluded?: string[];

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object' },
    description:
      '[{ id?, title, type: component|accessory|service, items: [{ id?, catalogItemId, name, description, ' +
      'itemType, variantLabel, lengthMm, heightMm, qty, uom, rate, amount }] }]. Unknown keys are dropped.',
  })
  @OptionalNotNull()
  @IsQuoteSections()
  sections?: unknown[];

  @ApiPropertyOptional({ enum: DISCOUNT_TYPES, default: 'amount', description: "'flat' is stored as 'amount'" })
  @OptionalNotNull()
  @IsIn(DISCOUNT_TYPES)
  discountType?: DiscountTypeInput;

  @ApiPropertyOptional({ minimum: 0, default: 0, description: '₹, or % (≤ 100) when discountType = percent' })
  @OptionalNotNull()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_DISCOUNT)
  @PercentAtMost100()
  discountValue?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, description: 'Defaults to settings.defaultGstPercent' })
  @OptionalNotNull()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(100)
  gstPercent?: number;

  // ---- server-owned: accepted (so clients can echo a row back) and ignored
  @ApiPropertyOptional({ readOnly: true, description: 'Ignored — assigned by the server' })
  @Allow()
  quoteNumber?: unknown;
  @ApiPropertyOptional({ readOnly: true, description: 'Ignored — recomputed from sections' })
  @Allow()
  subtotal?: unknown;
  @ApiPropertyOptional({ readOnly: true, description: 'Ignored — recomputed from sections' })
  @Allow()
  grandTotal?: unknown;
  @ApiPropertyOptional({ readOnly: true }) @Allow() id?: unknown;
  @ApiPropertyOptional({ readOnly: true }) @Allow() createdAt?: unknown;
  @ApiPropertyOptional({ readOnly: true }) @Allow() updatedAt?: unknown;
  @ApiPropertyOptional({ readOnly: true }) @Allow() legacyFirestoreId?: unknown;
}

export class CreateQuoteDto extends QuoteDto {}
export class UpdateQuoteDto extends QuoteDto {}
