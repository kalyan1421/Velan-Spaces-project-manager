import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

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

  @ApiProperty({ example: 'projects/<id>/updates/photo.jpg' })
  @IsString()
  path!: string;
}

export class SignDownloadDto extends SignUploadDto {}
