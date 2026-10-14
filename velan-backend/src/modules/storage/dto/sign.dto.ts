import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const STORAGE_BUCKETS = [
  'project-files',
  'designs',
  'update-images',
  'quotations',
  'avatars',
] as const;

export class SignUploadDto {
  @ApiProperty({ enum: STORAGE_BUCKETS })
  @IsIn(STORAGE_BUCKETS as unknown as string[])
  bucket!: string;

  @ApiProperty({ example: 'projects/<projectId>/updates/photo.jpg' })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  path!: string;
}

export class SignDownloadDto extends SignUploadDto {}
