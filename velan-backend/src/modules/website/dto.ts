import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, TransformFnParams } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateBy,
  ValidateIf,
  ValidationOptions,
} from 'class-validator';
import {
  cleanMultiLine,
  cleanSingleLine,
  isHoneypotTripped,
  MAX_PORTFOLIO_IMAGE_BYTES,
  MAX_PORTFOLIO_IMAGES,
  MAX_PORTFOLIO_URL_LENGTH,
  MAX_REORDER_IDS,
  MAX_SLUG_LENGTH,
  normalizePhone,
  PORTFOLIO_CATEGORIES,
  PORTFOLIO_CONTENT_TYPES,
  PORTFOLIO_STATUSES,
  PortfolioCategory,
  PortfolioStatus,
  SLUG_RE,
} from './website.util';

// ---------------------------------------------------------------- transforms
const trim = ({ value }: TransformFnParams) =>
  typeof value === 'string' ? value.trim() : value;

/** Optional public-form field: cleaned, and '' (HTML forms send it) -> undefined. */
const singleLineOrUndefined = ({ value }: TransformFnParams) => {
  const v = cleanSingleLine(value);
  return v === '' ? undefined : v;
};
const multiLineOrUndefined = ({ value }: TransformFnParams) => {
  const v = cleanMultiLine(value);
  return v === '' ? undefined : v;
};
const trimOrUndefined = ({ value }: TransformFnParams) => {
  const v = trim({ value } as TransformFnParams);
  return v === '' ? undefined : v;
};

/** Nullable admin field: trimmed, and '' -> null (clears the column). */
const trimOrNull = ({ value }: TransformFnParams) => {
  const v = trim({ value } as TransformFnParams);
  return v === '' ? null : v;
};

// ---------------------------------------------------------------- validators
/**
 * Optional, but NOT nullable: skips validation only when the key is absent, so
 * an explicit `null` for a NOT NULL column fails validation (400) instead of
 * reaching the database (500).
 */
const OptionalNotNull = () => ValidateIf((_o: object, v: unknown) => v !== undefined);

/** Validate enquiry fields only for humans: a filled honeypot gets a silent 201. */
const IfHuman = () => ValidateIf((o: EnquiryDto) => !isHoneypotTripped(o.company));

/** Phone already normalised by the transform (see normalizePhone). */
function IsLeadPhone(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isLeadPhone',
      validator: {
        validate: (v: unknown) => typeof v === 'string' && normalizePhone(v) === v,
        defaultMessage: () =>
          'phone must be a 10-digit Indian mobile number or an international number starting with +',
      },
    },
    options,
  );
}

// ---------------------------------------------------------------- enquiries
export class EnquiryDto {
  @ApiProperty({ minLength: 2, maxLength: 80, example: 'Asha Raman' })
  @Transform(({ value }) => cleanSingleLine(value))
  @IfHuman()
  @IsString()
  @Length(2, 80)
  name!: string;

  @ApiProperty({
    example: '+91 98765 43210',
    description:
      'Indian mobile (optional +91/91/0 prefix; stored as +91XXXXXXXXXX) or an international +<8–15 digits> number',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? (normalizePhone(value) ?? value.trim()) : value,
  )
  @IfHuman()
  @IsString()
  @MaxLength(30)
  @IsLeadPhone()
  phone!: string;

  @ApiPropertyOptional({ maxLength: 254, example: 'asha@example.com' })
  @Transform(trimOrUndefined)
  @IfHuman()
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ maxLength: 120, example: 'Adyar, Chennai' })
  @Transform(singleLineOrUndefined)
  @IfHuman()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @ApiPropertyOptional({ maxLength: 60, example: 'Residential' })
  @Transform(singleLineOrUndefined)
  @IfHuman()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  projectType?: string;

  @ApiPropertyOptional({ maxLength: 40, example: '10–20 L' })
  @Transform(singleLineOrUndefined)
  @IfHuman()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  budgetRange?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @Transform(multiLineOrUndefined)
  @IfHuman()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  /** Honeypot: hidden on the website, so only bots fill it. Any value is accepted (and dropped). */
  @ApiPropertyOptional({ description: 'Honeypot — must be left empty' })
  @Allow()
  company?: unknown;
}

// ---------------------------------------------------------------- portfolio (head)
/** Fields shared by create and patch (all optional here). */
class PortfolioFieldsDto {
  @ApiPropertyOptional({
    maxLength: MAX_SLUG_LENGTH,
    pattern: SLUG_RE.source,
    description: 'Auto-generated from the title on create when omitted. Changing it changes the public URL.',
  })
  @Transform(trim)
  @OptionalNotNull()
  @IsString()
  @MaxLength(MAX_SLUG_LENGTH)
  @Matches(SLUG_RE, { message: 'slug must be lowercase letters/digits separated by single dashes' })
  slug?: string;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string | null;

  @ApiPropertyOptional({ enum: PORTFOLIO_CATEGORIES, default: 'residential' })
  @OptionalNotNull()
  @IsIn(PORTFOLIO_CATEGORIES)
  category?: PortfolioCategory;

  @ApiPropertyOptional({ maxLength: 120, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string | null;

  @ApiPropertyOptional({ minimum: 1990, maximum: 2100, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1990)
  @Max(2100)
  completionYear?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Public URL inside the portfolio bucket (from POST /portfolio/uploads/sign)',
  })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PORTFOLIO_URL_LENGTH)
  coverImageUrl?: string | null;

  @ApiPropertyOptional({ type: [String], maxItems: MAX_PORTFOLIO_IMAGES })
  @OptionalNotNull()
  @IsArray()
  @ArrayMaxSize(MAX_PORTFOLIO_IMAGES)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(MAX_PORTFOLIO_URL_LENGTH, { each: true })
  imageUrls?: string[];

  @ApiPropertyOptional({ enum: PORTFOLIO_STATUSES, default: 'draft' })
  @OptionalNotNull()
  @IsIn(PORTFOLIO_STATUSES)
  status?: PortfolioStatus;

  @ApiPropertyOptional({ minimum: 0, maximum: 100000, default: 0 })
  @OptionalNotNull()
  @IsInt()
  @Min(0)
  @Max(100000)
  sortOrder?: number;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Linked internal project' })
  @IsOptional()
  @IsUUID()
  projectId?: string | null;
}

export class CreatePortfolioDto extends PortfolioFieldsDto {
  @ApiProperty({ minLength: 2, maxLength: 120, example: 'Modern Villa, Adyar' })
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  title!: string;
}

export class UpdatePortfolioDto extends PortfolioFieldsDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  @Transform(trim)
  @OptionalNotNull()
  @IsString()
  @Length(2, 120)
  title?: string;
}

export class ReorderPortfolioDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    maxItems: MAX_REORDER_IDS,
    description: 'Item ids in display order; each item gets sortOrder = its index',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_REORDER_IDS)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  ids!: string[];
}

export class SignPortfolioUploadDto {
  @ApiProperty({ maxLength: 255, example: 'Living Room.jpg' })
  @IsString()
  @Length(1, 255)
  fileName!: string;

  @ApiProperty({ enum: PORTFOLIO_CONTENT_TYPES })
  @IsIn(PORTFOLIO_CONTENT_TYPES)
  contentType!: string;

  @ApiProperty({ minimum: 1, maximum: MAX_PORTFOLIO_IMAGE_BYTES, description: 'Bytes (≤ 10 MB)' })
  @IsInt()
  @Min(1)
  @Max(MAX_PORTFOLIO_IMAGE_BYTES)
  size!: number;
}

// ---------------------------------------------------------------- responses (Swagger only)
export class PublicPortfolioItemResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ nullable: true, type: String }) description!: string | null;
  @ApiProperty({ enum: PORTFOLIO_CATEGORIES }) category!: PortfolioCategory;
  @ApiProperty({ nullable: true, type: String }) location!: string | null;
  @ApiProperty({ nullable: true, type: Number }) completionYear!: number | null;
  @ApiProperty({ nullable: true, type: String }) coverImageUrl!: string | null;
  @ApiProperty({ type: [String] }) imageUrls!: string[];
  @ApiProperty() sortOrder!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class PortfolioItemResponse extends PublicPortfolioItemResponse {
  @ApiProperty({ enum: PORTFOLIO_STATUSES }) status!: PortfolioStatus;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' }) projectId!: string | null;
}

export class PortfolioUploadSignResponse {
  @ApiProperty({ example: 'items/1f0c…/living-room.jpg' }) path!: string;
  @ApiProperty({ description: 'PUT the file bytes here (Content-Type = contentType)' })
  signedUrl!: string;
  @ApiProperty() token!: string;
  @ApiProperty({ description: 'Store this on the item (coverImageUrl / imageUrls)' })
  publicUrl!: string;
}

export class OkResponse {
  @ApiProperty({ example: true }) ok!: boolean;
}
