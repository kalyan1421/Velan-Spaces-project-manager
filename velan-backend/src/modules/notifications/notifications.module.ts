import {
  Body,
  Controller,
  Delete,
  Get,
  Global,
  HttpCode,
  Injectable,
  Logger,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { SupabaseService } from '../../supabase/supabase.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PushService } from '../../push/push.service';
import {
  CLIENT_AUDIENCE,
  MemberRole,
  notificationRow,
  ProjectMemberRef,
  pushData,
  selectProjectRecipients,
  STAFF_AUDIENCE,
  uniqueRecipients,
} from './notification-recipients';
import { NotifyOptions, NotifyPayload, ProjectAudience } from './notification-types';

export type { NotifyPayload, NotifyOptions, ProjectAudience, NotificationType } from './notification-types';
export { NOTIFICATION_TYPES } from './notification-types';

// ---------------------------------------------------------------- DTOs
class RegisterTokenDto {
  @ApiProperty() @IsString() fcmToken!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() platform?: string;
}

// ---------------------------------------------------------------- Service
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly push: PushService,
  ) {}
  private db() {
    return this.supabase.admin();
  }

  /**
   * Insert an in-app notification for one user and push to their devices.
   * Rejects if the row cannot be stored (callers catch); push never throws.
   */
  async notifyUser(userId: string, payload: NotifyPayload) {
    const full = await this.withProjectName(payload);
    const { error } = await this.db().from('notifications').insert(notificationRow(userId, full));
    if (error) throw new Error(error.message);

    const { data: tokens } = await this.db()
      .from('device_tokens')
      .select('fcm_token')
      .eq('user_id', userId);
    const list = (tokens ?? []).map((t) => t.fcm_token as string);
    await this.push.sendToTokens(list, { title: full.title, body: full.body }, pushData(full));
  }

  /**
   * Notify several users with the same payload. Never rejects: failures are
   * logged (ids only, no content) so a caller's write is never affected.
   */
  async notifyUsers(
    userIds: string[],
    payload: NotifyPayload,
    options: NotifyOptions = {},
  ): Promise<{ sent: number; failed: number }> {
    try {
      const recipients = uniqueRecipients(userIds, [...(options.excludeUserIds ?? []), payload.senderId]);
      if (recipients.length === 0) return { sent: 0, failed: 0 };
      const full = await this.withProjectName(payload);
      const results = await Promise.allSettled(recipients.map((id) => this.notifyUser(id, full)));
      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        const reason = results.find((r): r is PromiseRejectedResult => r.status === 'rejected')?.reason;
        this.logger.warn(
          `${payload.type ?? 'notification'}: ${failed}/${results.length} recipient(s) failed (${(reason as Error)?.message ?? 'unknown'})`,
        );
      }
      return { sent: results.length - failed, failed };
    } catch (e) {
      this.logger.warn(`${payload.type ?? 'notification'}: could not notify (${(e as Error).message})`);
      return { sent: 0, failed: userIds.length };
    }
  }

  /**
   * Notify members of a project by role (+ all active heads when
   * `audience.heads`). The sender and `excludeUserIds` are skipped. Never rejects.
   */
  async notifyProjectMembers(
    projectId: string,
    payload: NotifyPayload,
    audience: ProjectAudience,
    options: NotifyOptions = {},
  ): Promise<{ sent: number; failed: number }> {
    try {
      const [members, heads] = await Promise.all([
        this.projectMembers(projectId),
        audience.heads ? this.activeHeadIds() : Promise.resolve([] as string[]),
      ]);
      const recipients = selectProjectRecipients(members, heads, audience, [
        ...(options.excludeUserIds ?? []),
        payload.senderId,
      ]);
      return await this.notifyUsers(recipients, { ...payload, projectId });
    } catch (e) {
      this.logger.warn(`${payload.type ?? 'notification'} for project ${projectId}: ${(e as Error).message}`);
      return { sent: 0, failed: 0 };
    }
  }

  /** Notify a project's managers and all heads (e.g. on a new complaint). */
  async notifyProjectStaff(projectId: string, payload: NotifyPayload, options: NotifyOptions = {}) {
    return this.notifyProjectMembers(projectId, payload, STAFF_AUDIENCE, options);
  }

  /** Notify a project's client(s). */
  async notifyProjectClients(projectId: string, payload: NotifyPayload, options: NotifyOptions = {}) {
    return this.notifyProjectMembers(projectId, payload, CLIENT_AUDIENCE, options);
  }

  /** project_members of a project, minus suspended accounts. */
  async projectMembers(projectId: string): Promise<ProjectMemberRef[]> {
    const { data, error } = await this.db()
      .from('project_members')
      .select('user_id, member_role, user:users(is_suspended)')
      .eq('project_id', projectId);
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as {
      user_id: string;
      member_role: MemberRole;
      user: { is_suspended?: boolean } | null;
    }[])
      .filter((m) => m.user?.is_suspended !== true)
      .map((m) => ({ userId: m.user_id, memberRole: m.member_role }));
  }

  private async activeHeadIds(): Promise<string[]> {
    const { data, error } = await this.db()
      .from('users')
      .select('id')
      .eq('role', 'head')
      .eq('is_suspended', false);
    if (error) throw new Error(error.message);
    return (data ?? []).map((h) => h.id as string);
  }

  /** Fill projectName from the project when the caller did not pass it. */
  private async withProjectName(payload: NotifyPayload): Promise<NotifyPayload> {
    if (!payload.projectId || payload.projectName) return payload;
    const { data } = await this.db()
      .from('projects')
      .select('project_name')
      .eq('id', payload.projectId)
      .maybeSingle();
    const name = (data as { project_name?: string | null } | null)?.project_name;
    return name ? { ...payload, projectName: name } : payload;
  }

  // ------------------------------------------------------------ owner routes
  async list(u: AuthenticatedUser) {
    const { data, error } = await this.db()
      .from('notifications')
      .select('*')
      .eq('recipient_id', u.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data;
  }

  async unreadCount(u: AuthenticatedUser) {
    const { count, error } = await this.db()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', u.id)
      .eq('is_read', false);
    if (error) throw new Error(error.message);
    return { unread: count ?? 0 };
  }

  async markRead(u: AuthenticatedUser, id: string) {
    const { error } = await this.db()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('recipient_id', u.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  }

  /** Mark every unread notification of the caller as read (one call). */
  async markAllRead(u: AuthenticatedUser) {
    const { count, error } = await this.db()
      .from('notifications')
      .update({ is_read: true }, { count: 'exact' })
      .eq('recipient_id', u.id)
      .eq('is_read', false);
    if (error) throw new Error(error.message);
    return { ok: true, updated: count ?? 0 };
  }

  /** Delete one of the caller's notifications (404 if not theirs / gone). */
  async remove(u: AuthenticatedUser, id: string) {
    const { data, error } = await this.db()
      .from('notifications')
      .delete()
      .eq('id', id)
      .eq('recipient_id', u.id)
      .select('id');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new NotFoundException('Notification not found');
    return { deleted: true };
  }

  /** Delete all of the caller's READ notifications (unread ones are kept). */
  async clearRead(u: AuthenticatedUser) {
    const { count, error } = await this.db()
      .from('notifications')
      .delete({ count: 'exact' })
      .eq('recipient_id', u.id)
      .eq('is_read', true);
    if (error) throw new Error(error.message);
    return { deleted: count ?? 0 };
  }

  /** Upsert device token (register on login, refresh on rotate). */
  async registerToken(u: AuthenticatedUser, dto: RegisterTokenDto) {
    const { data, error } = await this.db()
      .from('device_tokens')
      .upsert(
        {
          user_id: u.id,
          fcm_token: dto.fcmToken,
          platform: dto.platform,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'fcm_token' },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  /** Logout: stop pushing to this device (only the caller's own token). */
  async removeToken(u: AuthenticatedUser, token: string) {
    const { error } = await this.db()
      .from('device_tokens')
      .delete()
      .eq('user_id', u.id)
      .eq('fcm_token', token);
    if (error) throw new Error(error.message);
    return { removed: true };
  }
}

// ---------------------------------------------------------------- Controller
@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get('notifications')
  @ApiOperation({ summary: 'The caller’s latest 100 notifications (newest first)' })
  list(@CurrentUser() u: AuthenticatedUser) {
    return this.svc.list(u);
  }

  @Get('notifications/unread-count')
  unread(@CurrentUser() u: AuthenticatedUser) {
    return this.svc.unreadCount(u);
  }

  @Post('notifications/read-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark all of the caller’s notifications as read' })
  markAllRead(@CurrentUser() u: AuthenticatedUser) {
    return this.svc.markAllRead(u);
  }

  @Patch('notifications/:id/read')
  markRead(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.markRead(u, id);
  }

  @Delete('notifications')
  @ApiOperation({ summary: 'Clear the caller’s read notifications (unread ones stay)' })
  clearRead(@CurrentUser() u: AuthenticatedUser) {
    return this.svc.clearRead(u);
  }

  @Delete('notifications/:id')
  @ApiOperation({ summary: 'Delete one of the caller’s notifications' })
  remove(@CurrentUser() u: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(u, id);
  }

  @Post('device-tokens')
  @ApiOperation({ summary: 'Register / refresh this device’s FCM token' })
  register(@CurrentUser() u: AuthenticatedUser, @Body() dto: RegisterTokenDto) {
    return this.svc.registerToken(u, dto);
  }

  @Post('device-tokens/remove')
  @HttpCode(200)
  @ApiOperation({ summary: 'Unregister this device’s FCM token (on logout)' })
  removeToken(@CurrentUser() u: AuthenticatedUser, @Body() dto: RegisterTokenDto) {
    return this.svc.removeToken(u, dto.fcmToken);
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
