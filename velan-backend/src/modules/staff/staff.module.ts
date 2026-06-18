import {
  Body,
  Controller,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { SupabaseService } from '../../supabase/supabase.service';
import { Roles } from '../../common/decorators/roles.decorator';

// ---------------------------------------------------------------- DTOs
class UpdateStaffDto {
  @ApiPropertyOptional() @IsOptional() @IsString() displayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() trade?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isSuspended?: boolean;
}

// ---------------------------------------------------------------- Service
@Injectable()
class StaffService {
  constructor(private readonly supabase: SupabaseService) {}
  private db() {
    return this.supabase.admin();
  }

  async list(role?: string) {
    let q = this.db()
      .from('users')
      .select('id, email, role, display_name, phone, trade, is_suspended')
      .in('role', ['manager', 'worker'])
      .order('display_name');
    if (role === 'manager' || role === 'worker') q = q.eq('role', role);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  }

  async assignments(userId: string) {
    const { data, error } = await this.db()
      .from('project_members')
      .select('project_id, member_role, has_budget_access')
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return data;
  }

  async update(id: string, dto: UpdateStaffDto) {
    const patch: Record<string, unknown> = {};
    if (dto.displayName !== undefined) patch.display_name = dto.displayName;
    if (dto.phone !== undefined) patch.phone = dto.phone;
    if (dto.trade !== undefined) patch.trade = dto.trade;
    if (dto.isSuspended !== undefined) patch.is_suspended = dto.isSuspended;
    const { data, error } = await this.db()
      .from('users')
      .update(patch)
      .eq('id', id)
      .select('id, email, role, display_name, phone, trade, is_suspended')
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
}

// ---------------------------------------------------------------- Controller
@ApiTags('staff')
@ApiBearerAuth()
@Roles('head')
@Controller('staff')
class StaffController {
  constructor(private readonly svc: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'List managers & workers (optionally by role)' })
  list(@Query('role') role?: string) {
    return this.svc.list(role);
  }

  @Get(':id/assignments')
  @ApiOperation({ summary: 'Projects a staff member is assigned to' })
  assignments(@Param('id') id: string) {
    return this.svc.assignments(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit / suspend a staff member' })
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.svc.update(id, dto);
  }
}

@Module({
  controllers: [StaffController],
  providers: [StaffService],
})
export class StaffModule {}
