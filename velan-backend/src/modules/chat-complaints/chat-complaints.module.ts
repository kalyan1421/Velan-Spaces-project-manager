import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Injectable,
  Logger,
  Module,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SupabaseService } from '../../supabase/supabase.service';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { parsePagination } from '../../common/pagination';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { NotificationsService } from '../notifications/notifications.module';
import {
  chatAudience,
  chatNotification,
  complaintStatusNotification,
  complaintStatusRecipients,
  preview,
} from '../notifications/notification-recipients';
import { StorageService } from '../storage/storage.service';

const ATTACHMENT_BUCKETS = ['project-files'] as const;

// ---------------------------------------------------------------- DTOs
class MessageDto {
  @ApiProperty() @IsString() @MaxLength(5000) content!: string;
  @ApiPropertyOptional({ default: 'text' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  messageType?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  attachmentUrls?: string[];
}

class ComplaintDto {
  @ApiProperty() @IsString() @MaxLength(300) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  attachments?: string[];
}

export const COMPLAINT_STATUSES = ['open', 'inProgress', 'resolved', 'closed'] as const;

/** Change the status, the resolution note, or both. */
class UpdateComplaintDto {
  @ApiPropertyOptional({ enum: COMPLAINT_STATUSES })
  @IsOptional()
  @IsIn(COMPLAINT_STATUSES as unknown as string[])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNote?: string;
}

// ---------------------------------------------------------------- Service
@Injectable()
class ChatComplaintsService {
  private readonly logger = new Logger('ChatComplaintsService');

  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: ProjectAccessService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
  ) {}
  private db() {
    return this.supabase.admin();
  }

  async listMessages(
    u: AuthenticatedUser,
    projectId: string,
    limit = 50,
    offset = 0,
  ) {
    await this.access.assertMember(u, projectId);
    const { data, error } = await this.db()
      .from('chat_messages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    return data;
  }

  async sendMessage(u: AuthenticatedUser, projectId: string, dto: MessageDto) {
    await this.access.assertMember(u, projectId);
    const { data, error } = await this.db()
      .from('chat_messages')
      .insert({
        project_id: projectId,
        sender_id: u.id,
        sender_name: u.displayName,
        sender_role: u.role.toUpperCase(),
        content: dto.content,
        message_type: dto.messageType ?? 'text',
        attachment_urls: this.storage.normalizeProjectRefs(projectId, dto.attachmentUrls, ATTACHMENT_BUCKETS),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Client <-> staff: alert the other side (never the sender). Fire-and-forget.
    void this.notifications
      .notifyProjectMembers(
        projectId,
        chatNotification({
          content: dto.content,
          messageType: dto.messageType,
          senderName: u.displayName,
          messageId: data.id as string,
          projectId,
          senderId: u.id,
        }),
        chatAudience(u.role),
      )
      .catch((e: Error) => this.logger.warn(`Chat ${data.id}: notify failed (${e.message})`));
    return data;
  }

  async listComplaints(u: AuthenticatedUser, projectId: string) {
    await this.access.assertMember(u, projectId);
    const { data, error } = await this.db()
      .from('complaints')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }

  async createComplaint(
    u: AuthenticatedUser,
    projectId: string,
    dto: ComplaintDto,
  ) {
    await this.access.assertMember(u, projectId);
    const { data, error } = await this.db()
      .from('complaints')
      .insert({
        project_id: projectId,
        title: dto.title,
        description: dto.description,
        created_by: u.id,
        created_by_name: u.displayName,
        status: 'open',
        attachments: this.storage.normalizeProjectRefs(projectId, dto.attachments, ATTACHMENT_BUCKETS),
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Fire-and-forget: alert project managers + heads (not the person who raised it).
    void this.notifications
      .notifyProjectStaff(projectId, {
        title: 'New complaint raised',
        body: preview(dto.title, 140),
        type: 'complaint',
        entityId: data.id as string,
        senderId: u.id,
        senderName: u.displayName ?? undefined,
      })
      .catch(() => undefined); // never let a notification failure break the request
    return data;
  }

  async updateComplaintStatus(
    u: AuthenticatedUser,
    projectId: string,
    id: string,
    status?: string,
    resolutionNote?: string,
  ) {
    await this.access.assertMember(u, projectId);
    if (status === undefined && resolutionNote === undefined) {
      throw new BadRequestException('Nothing to update');
    }
    const before = status !== undefined ? await this.complaintSnapshot(projectId, id) : null;
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { updated_at: now };
    if (resolutionNote !== undefined) patch.resolution_note = resolutionNote;
    if (status !== undefined) {
      patch.status = status;
      // Closing (resolved/closed) stamps the time; reopening clears it.
      patch.resolved_at = status === 'resolved' || status === 'closed' ? now : null;
    }
    const { data, error } = await this.db()
      .from('complaints')
      .update(patch)
      .eq('id', id)
      .eq('project_id', projectId)
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (status !== undefined && before && before.status !== status) {
      void this.notifyComplaintStatus(u, projectId, data as ComplaintRow).catch((e: Error) =>
        this.logger.warn(`Complaint ${id}: notify failed (${e.message})`),
      );
    }
    return data;
  }

  /** Status + creator before a change; null (skip notifying) if it can't be read. */
  private async complaintSnapshot(projectId: string, id: string) {
    try {
      const { data, error } = await this.db()
        .from('complaints')
        .select('status, created_by')
        .eq('id', id)
        .eq('project_id', projectId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data as { status: string; created_by: string | null } | null;
    } catch (e) {
      this.logger.warn(`Complaint ${id}: could not read previous status (${(e as Error).message})`);
      return null;
    }
  }

  /** Tell the client(s) and whoever raised it that the status changed. */
  private async notifyComplaintStatus(u: AuthenticatedUser, projectId: string, row: ComplaintRow) {
    const members = await this.notifications.projectMembers(projectId);
    const recipients = complaintStatusRecipients(members, row.created_by, u.id);
    await this.notifications.notifyUsers(
      recipients,
      complaintStatusNotification({
        complaintTitle: row.title,
        status: row.status,
        resolutionNote: row.resolution_note,
        complaintId: row.id,
        projectId,
        senderId: u.id,
        senderName: u.displayName,
      }),
    );
  }
}

interface ComplaintRow {
  id: string;
  title: string | null;
  status: string;
  created_by: string | null;
  resolution_note: string | null;
}

// ---------------------------------------------------------------- Controller
@ApiTags('chat-complaints')
@ApiBearerAuth()
@Controller('projects/:projectId')
class ChatComplaintsController {
  constructor(private readonly svc: ChatComplaintsService) {}

  @Get('chat')
  @ApiOperation({ summary: 'List chat messages (paginated, newest first)' })
  listMessages(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const page = parsePagination(limit, offset);
    return this.svc.listMessages(u, p, page.limit, page.offset);
  }

  @Post('chat')
  sendMessage(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Body() dto: MessageDto,
  ) {
    return this.svc.sendMessage(u, p, dto);
  }

  @Get('complaints')
  listComplaints(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
  ) {
    return this.svc.listComplaints(u, p);
  }

  @Post('complaints')
  createComplaint(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Body() dto: ComplaintDto,
  ) {
    return this.svc.createComplaint(u, p, dto);
  }

  // Only staff resolve complaints; clients/workers can raise them, not close them.
  @Patch('complaints/:id')
  @Roles('head', 'manager')
  @ApiOperation({ summary: 'Update complaint status / resolution (head/manager)' })
  updateComplaint(
    @CurrentUser() u: AuthenticatedUser,
    @Param('projectId', ParseUUIDPipe) p: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateComplaintDto,
  ) {
    return this.svc.updateComplaintStatus(
      u,
      p,
      id,
      body.status,
      body.resolutionNote,
    );
  }
}

@Module({
  controllers: [ChatComplaintsController],
  providers: [ChatComplaintsService],
})
export class ChatComplaintsModule {}
