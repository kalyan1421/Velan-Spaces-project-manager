import { Controller, Get, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Env } from '../../config/env.validation';
import { PUBLIC_CACHE_CONTROL } from './website-public.controller';

class AppVersionResponse {
  @ApiProperty({ example: '1.2.0' }) minVersion!: string;
  @ApiProperty() message!: string;
}

/** Forced-update gate: the mobile app compares its version to `minVersion`. */
@ApiTags('app (public)')
@Public()
@Controller('public')
export class AppVersionController {
  constructor(private readonly config: ConfigService<Env, true>) {}

  @Get('app-version')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Minimum supported mobile app version and the update message' })
  @ApiOkResponse({ type: AppVersionResponse })
  get(@Res({ passthrough: true }) res: Response): AppVersionResponse {
    res.setHeader('Cache-Control', PUBLIC_CACHE_CONTROL);
    return {
      minVersion: this.config.get('MIN_APP_VERSION', { infer: true }),
      message: this.config.get('MIN_APP_MESSAGE', { infer: true }),
    };
  }
}
