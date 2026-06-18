import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { SupabaseService } from '../../supabase/supabase.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly supabase: SupabaseService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness + DB connectivity check' })
  async check() {
    let db = 'ok';
    try {
      const { error } = await this.supabase
        .admin()
        .from('users')
        .select('id', { count: 'exact', head: true });
      if (error) db = `error: ${error.message}`;
    } catch (e) {
      db = `error: ${(e as Error).message}`;
    }
    return { status: 'ok', db, timestamp: new Date().toISOString() };
  }
}
