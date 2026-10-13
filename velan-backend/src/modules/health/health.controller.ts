import { Controller, Get, Logger } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SupabaseService } from '../../supabase/supabase.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly supabase: SupabaseService) {}

  @Public()
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'Liveness + DB connectivity check' })
  async check() {
    let db: 'ok' | 'error' = 'ok';
    try {
      const { error } = await this.supabase
        .admin()
        .from('users')
        .select('id', { count: 'exact', head: true });
      if (error) {
        db = 'error';
        this.logger.error(`health db check failed: ${error.message}`);
      }
    } catch (e) {
      db = 'error';
      this.logger.error(`health db check threw: ${(e as Error).message}`);
    }
    // Public endpoint: report state only, never internal error text.
    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
      timestamp: new Date().toISOString(),
    };
  }
}
