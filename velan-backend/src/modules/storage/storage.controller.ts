import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { SignDownloadDto, SignUploadDto } from './dto/sign.dto';
import { StorageService } from './storage.service';

@ApiTags('storage')
@ApiBearerAuth()
@Controller('uploads')
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  @Post('sign')
  @ApiOperation({
    summary:
      'Get a signed upload URL (authorized by role, path convention, file type and project membership)',
  })
  signUpload(@CurrentUser() user: AuthenticatedUser, @Body() dto: SignUploadDto) {
    return this.storage.signUpload(user, dto.bucket, dto.path);
  }

  @Post('sign-download')
  @ApiOperation({
    summary: 'Get a short-lived signed download URL (project-membership checked)',
  })
  signDownload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SignDownloadDto,
  ) {
    return this.storage.signDownload(user, dto.bucket, dto.path);
  }
}
