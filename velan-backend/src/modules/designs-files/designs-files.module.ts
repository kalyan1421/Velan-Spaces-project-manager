import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { SupabaseService } from '../../supabase/supabase.service';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { StorageService } from '../storage/storage.service';

const DESIGN_BUCKETS = ['designs'] as const;
const FILE_BUCKETS = ['project-files', 'designs'] as const;
export const FILE_APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;

type Named = Record<string, unknown> & { person?: { display_name?: string | null } | null };
/** Flatten the embedded user (`person`) into `<field>` for the app to display. */
function flattenPerson(row: Named, field: string) {
  const { person, ...rest } = row;
  return { ...rest, [field]: person?.display_name ?? null };
}

// ---------------------------------------------------------------- DTOs
class CreateDesignDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() fileUrl?: string;
  @ApiPropertyOptional({ default: '2D' }) @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() roomName?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() approvalRequired?: boolean;
}

class UpdateDesignDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) type?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) roomName?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() approvalRequired?: boolean;
  @ApiPropertyOptional({ description: 'Client approval (clients may only set this)' })
  @IsOptional()
  @IsBoolean()
  approvalApproved?: boolean;
}

class UpdateFileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(60) category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) roomName?: string;
  @ApiPropertyOptional({ description: 'New version of the file' })
  @IsOptional()
  @IsString()
  storagePath?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) version?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) size?: number;
  @ApiPropertyOptional({ enum: FILE_APPROVAL_STATUSES, description: 'Clients may only set this' })
  @IsOptional()
  @IsIn(FILE_APPROVAL_STATUSES as unknown as string[])
  approvalStatus?: string;
}

class CreateFileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() storagePath?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() size?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() roomName?: string;
}

// ---------------------------------------------------------------- Service
@Injectable()
class DesignsFilesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: ProjectAccessService,
    private readonly storage: StorageService,
  ) {}
  private db() {
    return this.supabase.admin();
  }

  async listDesigns(user: AuthenticatedUser, projectId: string) {
    await this.access.assertMember(user, projectId);
    const { data, error } = await this.db()
      .from('designs')
      .select('*, person:posted_by(display_name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => flattenPerson(r as Named, 'posted_by_name'));
  }

  async createDesign(
    user: AuthenticatedUser,
    projectId: string,
    dto: CreateDesignDto,
  ) {
    await this.access.assertMember(user, projectId);
    const { data, error } = await this.db()
      .from('designs')
      .insert({
        project_id: projectId,
        title: dto.title,
        file_url: this.storage.normalizeProjectRef(projectId, dto.fileUrl, DESIGN_BUCKETS),
        type: dto.type ?? '2D',
        posted_by: user.id,
        room_name: dto.roomName,
        approval_required: dto.approvalRequired ?? false,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async removeDesign(user: AuthenticatedUser, projectId: string, id: string) {
    await this.access.assertMember(user, projectId);
    const { data, error } = await this.db()
      .from('designs')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId)
      .select('file_url');
    if (error) throw new Error(error.message);
    await this.storage.removeRefs((data ?? []).map((r) => r.file_url as string));
    return { deleted: true };
  }

  async updateDesign(user: AuthenticatedUser, projectId: string, id: string, dto: UpdateDesignDto) {
    await this.access.assertMember(user, projectId);
    const { data: row, error: getErr } = await this.db()
      .from('designs')
      .select('approval_required')
      .eq('id', id)
      .eq('project_id', projectId)
      .maybeSingle();
    if (getErr) throw new Error(getErr.message);
    if (!row) throw new NotFoundException('Design not found');

    const isStaff = user.role === 'head' || user.role === 'manager';
    if (!isStaff) {
      const onlyApproval =
        dto.approvalApproved !== undefined &&
        Object.entries(dto).every(([k, v]) => k === 'approvalApproved' || v === undefined);
      if (user.role !== 'client' || !onlyApproval) {
        throw new ForbiddenException('Only managers can edit designs');
      }
      if (!row.approval_required) throw new BadRequestException('This design does not need approval');
    }

    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.roomName !== undefined) patch.room_name = dto.roomName;
    if (dto.approvalRequired !== undefined) patch.approval_required = dto.approvalRequired;
    if (dto.approvalApproved !== undefined) patch.approval_approved = dto.approvalApproved;
    if (Object.keys(patch).length === 0) throw new BadRequestException('Nothing to update');

    const { data, error } = await this.db()
      .from('designs')
      .update(patch)
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async listFiles(user: AuthenticatedUser, projectId: string) {
    await this.access.assertMember(user, projectId);
    const { data, error } = await this.db()
      .from('files')
      .select('*, person:uploaded_by(display_name)')
      .eq('project_id', projectId)
      .order('uploaded_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => flattenPerson(r as Named, 'uploaded_by_name'));
  }

  async createFile(
    user: AuthenticatedUser,
    projectId: string,
    dto: CreateFileDto,
  ) {
    await this.access.assertMember(user, projectId);
    const { data, error } = await this.db()
      .from('files')
      .insert({
        project_id: projectId,
        name: dto.name,
        title: dto.title,
        storage_path: this.storage.normalizeProjectRef(projectId, dto.storagePath, FILE_BUCKETS),
        category: dto.category ?? 'other',
        type: dto.type ?? 'unknown',
        size: dto.size ?? 0,
        uploaded_by: user.id,
        room_name: dto.roomName,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async removeFile(user: AuthenticatedUser, projectId: string, id: string) {
    await this.access.assertMember(user, projectId);
    const { data, error } = await this.db()
      .from('files')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId)
      .select('storage_path');
    if (error) throw new Error(error.message);
    await this.storage.removeRefs((data ?? []).map((r) => r.storage_path as string));
    return { deleted: true };
  }

  async updateFile(user: AuthenticatedUser, projectId: string, id: string, dto: UpdateFileDto) {
    await this.access.assertMember(user, projectId);
    const isStaff = user.role === 'head' || user.role === 'manager';
    if (!isStaff) {
      const onlyApproval =
        dto.approvalStatus !== undefined &&
        Object.entries(dto).every(([k, v]) => k === 'approvalStatus' || v === undefined);
      if (user.role !== 'client' || !onlyApproval) {
        throw new ForbiddenException('Only managers can edit files');
      }
    }

    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.category !== undefined) patch.category = dto.category;
    if (dto.roomName !== undefined) patch.room_name = dto.roomName;
    if (dto.version !== undefined) patch.version = dto.version;
    if (dto.size !== undefined) patch.size = dto.size;
    if (dto.approvalStatus !== undefined) patch.approval_status = dto.approvalStatus;
    if (dto.storagePath !== undefined) {
      patch.storage_path = this.storage.normalizeProjectRef(projectId, dto.storagePath, FILE_BUCKETS);
    }
    if (Object.keys(patch).length === 0) throw new BadRequestException('Nothing to update');

    const { data, error } = await this.db()
      .from('files')
      .update(patch)
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('File not found');
    return data;
  }
}

// ---------------------------------------------------------------- Controller
@ApiTags('designs-files')
@ApiBearerAuth()
@Controller('projects/:projectId')
class DesignsFilesController {
  constructor(private readonly svc: DesignsFilesService) {}

  @Get('designs')
  @ApiOperation({ summary: 'List designs' })
  listDesigns(@CurrentUser() u: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) p: string) {
    return this.svc.listDesigns(u, p);
  }

  @Post('designs')
  @Roles('head', 'manager')
  @ApiOperation({ summary: 'Add a design document' })
  createDesign(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Body() dto: CreateDesignDto,
  ) {
    return this.svc.createDesign(u, p, dto);
  }

  // Staff edit; a client may only approve/reject a design that needs approval.
  @Patch('designs/:id')
  @ApiOperation({ summary: 'Edit a design / record client approval' })
  updateDesign(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDesignDto,
  ) {
    return this.svc.updateDesign(u, p, id, dto);
  }

  @Delete('designs/:id')
  @Roles('head', 'manager')
  removeDesign(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.removeDesign(u, p, id);
  }

  @Get('files')
  @ApiOperation({ summary: 'List files' })
  listFiles(@CurrentUser() u: AuthenticatedUser, @Param('projectId', ParseUUIDPipe) p: string) {
    return this.svc.listFiles(u, p);
  }

  @Post('files')
  @Roles('head', 'manager')
  @ApiOperation({ summary: 'Register an uploaded file' })
  createFile(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Body() dto: CreateFileDto,
  ) {
    return this.svc.createFile(u, p, dto);
  }

  // Staff edit (incl. new version); a client may only set approvalStatus.
  @Patch('files/:id')
  @ApiOperation({ summary: 'Edit a file / new version / approval' })
  updateFile(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFileDto,
  ) {
    return this.svc.updateFile(u, p, id, dto);
  }

  @Delete('files/:id')
  @Roles('head', 'manager')
  removeFile(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.removeFile(u, p, id);
  }
}

// ---------------------------------------------------------------- Module
@Module({
  controllers: [DesignsFilesController],
  providers: [DesignsFilesService],
})
export class DesignsFilesModule {}
