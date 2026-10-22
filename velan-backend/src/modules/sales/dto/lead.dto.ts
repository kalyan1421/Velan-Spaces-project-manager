import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { LEAD_STATUSES, LeadStatus } from '../sales.constants';
import { OptionalNotNull, textOrNull, trim, trimOrNull } from './transforms';

/** Fields shared by create and patch. Nullable text: '' or null clears it. */
class LeadFieldsDto {
  @ApiPropertyOptional({ maxLength: 30, nullable: true, example: '+919876543210' })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(30)
  clientPhone?: string | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true, example: 'Adyar, Chennai' })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  area?: string | null;

  @ApiPropertyOptional({ maxLength: 60, nullable: true, example: 'Residential' })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  projectType?: string | null;

  @ApiPropertyOptional({
    maxLength: 40,
    nullable: true,
    example: 'referral',
    description: 'Free text; the apps use instagram | whatsapp | referral | website | other',
  })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  source?: string | null;

  @ApiPropertyOptional({
    maxLength: 60,
    nullable: true,
    example: '10-15 L',
    description: 'Free-form text (a number is accepted and stored as text)',
  })
  @Transform(textOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  estimatedBudget?: string | null;

  @ApiPropertyOptional({ maxLength: 5000, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string | null;

  @ApiPropertyOptional({ enum: LEAD_STATUSES, default: 'new' })
  @OptionalNotNull()
  @IsIn(LEAD_STATUSES)
  status?: LeadStatus;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'A head or manager account; null/"" unassigns',
  })
  @Transform(trimOrNull)
  @IsOptional()
  @IsUUID()
  assignedManagerId?: string | null;
}

export class CreateLeadDto extends LeadFieldsDto {
  @ApiProperty({ minLength: 1, maxLength: 120, example: 'Asha Raman' })
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  clientName!: string;
}

export class UpdateLeadDto extends LeadFieldsDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 120 })
  @Transform(trim)
  @OptionalNotNull()
  @IsString()
  @Length(1, 120)
  clientName?: string;
}
