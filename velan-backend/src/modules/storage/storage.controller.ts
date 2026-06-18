import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SignDownloadDto, SignUploadDto } from './dto/sign.dto';
import { StorageService } from './storage.service';

@ApiTags('storage')
@ApiBearerAuth()
@Controller('uploads')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('sign')
  @ApiOperation({ summary: 'Get a signed upload URL for a storage object' })
  signUpload(@Body() dto: SignUploadDto) {
    return this.storage.signUpload(dto.bucket, dto.path);
  }

  @Post('sign-download')
  @ApiOperation({ summary: 'Get a short-lived signed download URL' })
  signDownload(@Body() dto: SignDownloadDto) {
    return this.storage.signDownload(dto.bucket, dto.path);
  }
}
