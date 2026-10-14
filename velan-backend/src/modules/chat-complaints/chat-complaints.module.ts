import {
  Body,
  Controller,
  Get,
  Injectable,
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
import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SupabaseService } from '../../supabase/supabase.service';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { parsePagination } from '../../common/pagination';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { NotificationsService } from '../notifications/notifications.module';

// ---------------------------------------------------------------- DTOs
class MessageDto {
  @ApiProperty() @IsString() content!: string;
  @ApiPropertyOptional({ default: 'text' })
  @IsOptional()
  @IsString()
  messageType?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentUrls?: string[];
}

class ComplaintDto {
  @ApiProperty() @IsString() title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}

export const COMPLAINT_STATUSES = ['open', 'inProgress', 'resolved', 'closed'] as const;

class UpdateComplaintDto {
  @ApiProperty({ enum: COMPLAINT_STATUSES })
  @IsIn(COMPLAINT_STATUSES as unknown as string[])
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  resolutionNote?: string;
}

// ---------------------------------------------------------------- Service
@Injectable()
class ChatComplaintsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: ProjectAccessService,
    private readonly notifications: NotificationsService,
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
        attachment_urls: dto.attachmentUrls ?? [],
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
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
        attachments: dto.attachments ?? [],
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Fire-and-forget: alert project managers + heads.
    this.notifications
      .notifyProjectStaff(projectId, {
        title: 'New complaint raised',
        body: dto.title,
        type: 'complaint',
      })
      .catch(() => undefined); // never let a notification failure break the request
    return data;
  }

  async updateComplaintStatus(
    u: AuthenticatedUser,
    projectId: string,
    id: string,
    status: string,
    resolutionNote?: string,
  ) {
    await this.access.assertMember(u, projectId);
    const patch: Record<string, unknown> = { status };
    if (resolutionNote !== undefined) patch.resolution_note = resolutionNote;
    if (status === 'resolved') patch.resolved_at = new Date().toISOString();
    const { data, error } = await this.db()
      .from('complaints')
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
