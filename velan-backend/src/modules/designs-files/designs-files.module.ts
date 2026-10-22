import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
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
  ApiProperty,
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
import { NotificationsService, NotifyPayload } from '../notifications/notifications.module';
import {
  APPROVAL_COMMENT_MAX,
  ApprovalPatch,
  ApprovalPlan,
  ApprovalRow,
  DESIGN_APPROVAL_STATUSES,
  DesignApprovalStatus,
  clientNoticeText,
  decisionNoticeText,
  isStaffRole,
  normalizeApprovalStatus,
  planApprovalDecision,
  planLegacyApprovalPatch,
} from './design-approval';

const DESIGN_BUCKETS = ['designs'] as const;
const FILE_BUCKETS = ['project-files', 'designs'] as const;
export const FILE_APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;

type Named = Record<string, unknown> & { person?: { display_name?: string | null } | null };
/** Flatten the embedded user (`person`) into `<field>` for the app to display. */
function flattenPerson(row: Named, field: string) {
  const { person, ...rest } = row;
  return { ...rest, [field]: person?.display_name ?? null };
}

/** Designs with the poster's and the approver's display names embedded. */
const DESIGN_SELECT =
  '*, person:posted_by(display_name), decider:approval_decided_by(display_name)';

type DesignRow = Named & ApprovalRow & {
  id: string;
  title: string | null;
  decider?: { display_name?: string | null } | null;
};

/** `posted_by_name` + `approval_decided_by_name` (camelCased by the interceptor). */
function shapeDesign(row: DesignRow) {
  const { decider, ...rest } = row;
  return {
    ...flattenPerson(rest as Named, 'posted_by_name'),
    approval_status: normalizeApprovalStatus(row.approval_status),
    approval_decided_by_name: decider?.display_name ?? null,
  };
}

/** One "new design" notice per client per project in this window (batch uploads). */
const NEW_DESIGN_NOTICE_WINDOW_MS = 5 * 60_000;

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

class DesignApprovalDto {
  @ApiProperty({
    enum: DESIGN_APPROVAL_STATUSES,
    description:
      'Client: approved | changes_requested (comment required). Head/manager: pending = ask the client again.',
  })
  @IsIn(DESIGN_APPROVAL_STATUSES as unknown as string[])
  status!: DesignApprovalStatus;

  @ApiPropertyOptional({ maxLength: APPROVAL_COMMENT_MAX })
  @IsOptional()
  @IsString()
  @MaxLength(APPROVAL_COMMENT_MAX)
  comment?: string;
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
  @ApiPropertyOptional({ description: 'Share with the project client (staff only)' })
  @IsOptional()
  @IsBoolean()
  clientVisible?: boolean;
}

class CreateFileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() storagePath?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() category?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() type?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() size?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() roomName?: string;
  @ApiPropertyOptional({ default: false, description: 'Share with the project client' })
  @IsOptional()
  @IsBoolean()
  clientVisible?: boolean;
}

// ---------------------------------------------------------------- Service
@Injectable()
export class DesignsFilesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: ProjectAccessService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}
  private db() {
    return this.supabase.admin();
  }

  async listDesigns(user: AuthenticatedUser, projectId: string) {
    await this.access.assertMember(user, projectId);
    const { data, error } = await this.db()
      .from('designs')
      .select(DESIGN_SELECT)
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => shapeDesign(r as DesignRow));
  }

  private async getDesign(projectId: string, id: string) {
    const { data, error } = await this.db()
      .from('designs')
      .select(DESIGN_SELECT)
      .eq('id', id)
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Design not found');
    return data as DesignRow;
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
        approval_status: 'pending',
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    // Every design is visible to the project's client: tell them (batched).
    this.notifyClients(user, projectId, data as DesignRow, 'new');
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
    const row = await this.getDesign(projectId, id);

    if (!isStaffRole(user.role)) {
      const onlyApproval =
        dto.approvalApproved !== undefined &&
        Object.entries(dto).every(([k, v]) => k === 'approvalApproved' || v === undefined);
      if (user.role !== 'client' || !onlyApproval) {
        throw new ForbiddenException('Only managers can edit designs');
      }
      if (!row.approval_required) throw new BadRequestException('This design does not need approval');
    }

    const fields: Record<string, unknown> = {};
    if (dto.title !== undefined) fields.title = dto.title;
    if (dto.type !== undefined) fields.type = dto.type;
    if (dto.roomName !== undefined) fields.room_name = dto.roomName;
    const touchesApproval = dto.approvalRequired !== undefined || dto.approvalApproved !== undefined;
    if (Object.keys(fields).length === 0 && !touchesApproval) {
      throw new BadRequestException('Nothing to update');
    }

    // approvalRequired / approvalApproved (Flutter app) map onto the status workflow.
    const plan = planLegacyApprovalPatch({
      role: user.role,
      userId: user.id,
      row,
      approvalRequired: dto.approvalRequired,
      approvalApproved: dto.approvalApproved,
      now: new Date(),
    });
    return this.applyDesignPatch(user, projectId, row, { ...fields, ...plan.patch }, plan);
  }

  /** Client approves / requests changes; staff ask the client (again). */
  async decideDesign(user: AuthenticatedUser, projectId: string, id: string, dto: DesignApprovalDto) {
    await this.access.assertMember(user, projectId);
    const row = await this.getDesign(projectId, id);
    const plan = planApprovalDecision({
      role: user.role,
      userId: user.id,
      row,
      status: dto.status,
      comment: dto.comment,
      now: new Date(),
    });
    return this.applyDesignPatch(user, projectId, row, plan.patch, plan);
  }

  private async applyDesignPatch(
    user: AuthenticatedUser,
    projectId: string,
    row: DesignRow,
    patch: Record<string, unknown> | ApprovalPatch,
    plan: ApprovalPlan,
  ) {
    if (Object.keys(patch).length === 0) return shapeDesign(row);
    const { data, error } = await this.db()
      .from('designs')
      .update(patch)
      .eq('id', row.id)
      .eq('project_id', projectId)
      .select(DESIGN_SELECT)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Design not found');
    const saved = data as DesignRow;

    if (plan.notice === 'decision') this.notifyStaffOfDecision(user, projectId, saved);
    else if (plan.notice === 'request') this.notifyClients(user, projectId, saved, 'request');
    return shapeDesign(saved);
  }

  // ------------------------------------------------------------ notifications
  // Fire-and-forget: a notification failure must never fail the write.

  private async projectName(projectId: string): Promise<string | undefined> {
    const { data } = await this.db()
      .from('projects')
      .select('project_name')
      .eq('id', projectId)
      .maybeSingle();
    return (data?.project_name as string | undefined) ?? undefined;
  }

  private notifyStaffOfDecision(user: AuthenticatedUser, projectId: string, design: DesignRow) {
    const run = async () => {
      const status = normalizeApprovalStatus(design.approval_status);
      const text = decisionNoticeText({
        status,
        clientName: user.displayName,
        designTitle: design.title,
        comment: design.approval_comment,
      });
      const payload: NotifyPayload = {
        ...text,
        type: 'design_approval',
        projectId,
        projectName: await this.projectName(projectId),
        entityId: design.id,
        senderId: user.id,
        senderName: user.displayName ?? undefined,
      };
      await this.notifications.notifyProjectStaff(projectId, payload);
    };
    run().catch(() => undefined);
  }

  private notifyClients(
    user: AuthenticatedUser,
    projectId: string,
    design: DesignRow,
    kind: 'new' | 'request',
  ) {
    const run = async () => {
      const { data: members, error } = await this.db()
        .from('project_members')
        .select('user_id')
        .eq('project_id', projectId)
        .eq('member_role', 'client');
      if (error) throw new Error(error.message);
      const ids = [...new Set((members ?? []).map((m) => m.user_id as string))];
      if (ids.length === 0) return;

      const { data: active } = await this.db()
        .from('users')
        .select('id')
        .in('id', ids)
        .eq('is_suspended', false);
      let recipients = (active ?? []).map((u) => u.id as string);

      if (kind === 'new' && recipients.length > 0) {
        // Batch uploads: one "new design" notice per client per window.
        const since = new Date(Date.now() - NEW_DESIGN_NOTICE_WINDOW_MS).toISOString();
        const { data: recent } = await this.db()
          .from('notifications')
          .select('recipient_id')
          .in('recipient_id', recipients)
          .eq('project_id', projectId)
          .eq('type', 'design')
          .gte('created_at', since);
        const skip = new Set((recent ?? []).map((n) => n.recipient_id as string));
        recipients = recipients.filter((id) => !skip.has(id));
      }
      if (recipients.length === 0) return;

      const payload: NotifyPayload = {
        ...clientNoticeText({ kind, approvalRequired: design.approval_required, designTitle: design.title }),
        type: 'design',
        projectId,
        projectName: await this.projectName(projectId),
        entityId: design.id,
        senderId: user.id,
        senderName: user.displayName ?? undefined,
      };
      await Promise.all(
        recipients.map((id) => this.notifications.notifyUser(id, payload).catch(() => undefined)),
      );
    };
    run().catch(() => undefined);
  }

  async listFiles(user: AuthenticatedUser, projectId: string) {
    await this.access.assertMember(user, projectId);
    let q = this.db()
      .from('files')
      .select('*, person:uploaded_by(display_name)')
      .eq('project_id', projectId);
    // Files are staff-only unless shared (bills, contracts…): clients see only those.
    if (user.role === 'client') q = q.eq('client_visible', true);
    const { data, error } = await q.order('uploaded_at', { ascending: false });
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
        client_visible: dto.clientVisible ?? false,
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
    if (!isStaffRole(user.role)) {
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
    if (dto.clientVisible !== undefined) patch.client_visible = dto.clientVisible;
    if (dto.storagePath !== undefined) {
      patch.storage_path = this.storage.normalizeProjectRef(projectId, dto.storagePath, FILE_BUCKETS);
    }
    if (Object.keys(patch).length === 0) throw new BadRequestException('Nothing to update');

    let q = this.db().from('files').update(patch).eq('id', id).eq('project_id', projectId);
    // A client can't touch (or learn about) a file that isn't shared with them.
    if (user.role === 'client') q = q.eq('client_visible', true);
    const { data, error } = await q.select().maybeSingle();
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

  // Richer approval (R-E4): client approves / requests changes with a comment;
  // head/manager send `pending` to ask the client (again). Staff are notified
  // of a client decision; the client is notified of a request.
  @Post('designs/:id/approval')
  @HttpCode(200)
  @Roles('head', 'manager', 'client')
  @ApiOperation({ summary: 'Approve / request changes on a design (client) or re-request approval (staff)' })
  decideDesign(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DesignApprovalDto,
  ) {
    return this.svc.decideDesign(u, p, id, dto);
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
