import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Module,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
} from 'class-validator';
import { SupabaseService } from '../../supabase/supabase.service';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

// ---------------------------------------------------------------- DTOs
class RoomDto {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedWorkerIds?: string[];
}

class PhaseDto {
  @ApiProperty() @IsString() name!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() status?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() orderIndex?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() startDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() endDate?: string;
}

// ---------------------------------------------------------------- Service
@Injectable()
class RoomsTimelineService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: ProjectAccessService,
  ) {}
  private db() {
    return this.supabase.admin();
  }

  async listRooms(u: AuthenticatedUser, projectId: string) {
    await this.access.assertMember(u, projectId);
    const { data, error } = await this.db()
      .from('rooms')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at');
    if (error) throw new Error(error.message);
    return data;
  }

  async createRoom(u: AuthenticatedUser, projectId: string, dto: RoomDto) {
    await this.access.assertMember(u, projectId);
    const { data, error } = await this.db()
      .from('rooms')
      .insert({
        project_id: projectId,
        name: dto.name,
        assigned_worker_ids: dto.assignedWorkerIds ?? [],
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async removeRoom(u: AuthenticatedUser, projectId: string, id: string) {
    await this.access.assertMember(u, projectId);
    const { error } = await this.db()
      .from('rooms')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  }

  async listPhases(u: AuthenticatedUser, projectId: string) {
    await this.access.assertMember(u, projectId);
    const { data, error } = await this.db()
      .from('timeline_phases')
      .select('*')
      .eq('project_id', projectId)
      .order('order_index');
    if (error) throw new Error(error.message);
    return data;
  }

  async createPhase(u: AuthenticatedUser, projectId: string, dto: PhaseDto) {
    await this.access.assertMember(u, projectId);
    const { data, error } = await this.db()
      .from('timeline_phases')
      .insert({
        project_id: projectId,
        name: dto.name,
        status: dto.status ?? 'notStarted',
        order_index: dto.orderIndex ?? 0,
        notes: dto.notes,
        start_date: dto.startDate ?? null,
        end_date: dto.endDate ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async updatePhase(
    u: AuthenticatedUser,
    projectId: string,
    id: string,
    dto: Partial<PhaseDto>,
  ) {
    await this.access.assertMember(u, projectId);
    const patch: Record<string, unknown> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.orderIndex !== undefined) patch.order_index = dto.orderIndex;
    if (dto.notes !== undefined) patch.notes = dto.notes;
    if (dto.startDate !== undefined) patch.start_date = dto.startDate;
    if (dto.endDate !== undefined) patch.end_date = dto.endDate;
    const { data, error } = await this.db()
      .from('timeline_phases')
      .update(patch)
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
}

// ---------------------------------------------------------------- Controller
@ApiTags('rooms-timeline')
@ApiBearerAuth()
@Controller('projects/:projectId')
class RoomsTimelineController {
  constructor(private readonly svc: RoomsTimelineService) {}

  @Get('rooms')
  listRooms(@CurrentUser() u: AuthenticatedUser, @Param('projectId') p: string) {
    return this.svc.listRooms(u, p);
  }

  @Post('rooms')
  @Roles('head', 'manager')
  createRoom(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId') p: string,
    @Body() dto: RoomDto,
  ) {
    return this.svc.createRoom(u, p, dto);
  }

  @Delete('rooms/:id')
  @Roles('head', 'manager')
  removeRoom(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId') p: string,
    @Param('id') id: string,
  ) {
    return this.svc.removeRoom(u, p, id);
  }

  @Get('timeline')
  @ApiOperation({ summary: 'List timeline phases (ordered)' })
  listPhases(@CurrentUser() u: AuthenticatedUser, @Param('projectId') p: string) {
    return this.svc.listPhases(u, p);
  }

  @Post('timeline')
  @Roles('head', 'manager')
  createPhase(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId') p: string,
    @Body() dto: PhaseDto,
  ) {
    return this.svc.createPhase(u, p, dto);
  }

  @Patch('timeline/:id')
  @Roles('head', 'manager')
  updatePhase(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId') p: string,
    @Param('id') id: string,
    @Body() dto: PhaseDto,
  ) {
    return this.svc.updatePhase(u, p, id, dto);
  }
}

@Module({
  controllers: [RoomsTimelineController],
  providers: [RoomsTimelineService],
})
export class RoomsTimelineModule {}
