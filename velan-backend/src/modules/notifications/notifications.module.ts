import {
  Body,
  Controller,
  Get,
  Global,
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
import { IsOptional, IsString } from 'class-validator';
import { SupabaseService } from '../../supabase/supabase.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { PushService } from '../../push/push.service';

export interface NotifyPayload {
  title: string;
  body: string;
  type?: string;
  projectId?: string;
  projectName?: string;
}

// ---------------------------------------------------------------- DTOs
class RegisterTokenDto {
  @ApiProperty() @IsString() fcmToken!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() platform?: string;
}

// ---------------------------------------------------------------- Service
@Injectable()
export class NotificationsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly push: PushService,
  ) {}
  private db() {
    return this.supabase.admin();
  }

  /** Insert an in-app notification for one user and push to their devices. */
  async notifyUser(userId: string, payload: NotifyPayload) {
    await this.db().from('notifications').insert({
      recipient_id: userId,
      title: payload.title,
      body: payload.body,
      type: payload.type,
      project_id: payload.projectId ?? null,
      project_name: payload.projectName ?? null,
      sender_id: null,
    });

    const { data: tokens } = await this.db()
      .from('device_tokens')
      .select('fcm_token')
      .eq('user_id', userId);
    const list = (tokens ?? []).map((t) => t.fcm_token as string);
    await this.push.sendToTokens(
      list,
      { title: payload.title, body: payload.body },
      payload.type ? { type: payload.type } : undefined,
    );
  }

  /** Notify a project's managers and all heads (e.g. on a new complaint). */
  async notifyProjectStaff(projectId: string, payload: NotifyPayload) {
    const recipients = new Set<string>();
    const { data: managers } = await this.db()
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
      .eq('member_role', 'manager');
    for (const m of managers ?? []) recipients.add(m.user_id as string);

    const { data: heads } = await this.db()
      .from('users')
      .select('id')
      .eq('role', 'head');
    for (const h of heads ?? []) recipients.add(h.id as string);

    await Promise.all(
      [...recipients].map((id) =>
        this.notifyUser(id, { ...payload, projectId }),
      ),
    );
  }

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
  list(@CurrentUser() u: AuthenticatedUser) {
    return this.svc.list(u);
  }

  @Get('notifications/unread-count')
  unread(@CurrentUser() u: AuthenticatedUser) {
    return this.svc.unreadCount(u);
  }

  @Patch('notifications/:id/read')
  markRead(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) {
    return this.svc.markRead(u, id);
  }

  @Post('device-tokens')
  @ApiOperation({ summary: 'Register / refresh this device’s FCM token' })
  register(@CurrentUser() u: AuthenticatedUser, @Body() dto: RegisterTokenDto) {
    return this.svc.registerToken(u, dto);
  }
}

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
