import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { SupabaseService } from '../../supabase/supabase.service';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.module';
import { UPDATE_AUDIENCE, updateNotification } from '../notifications/notification-recipients';
import { CreateUpdateDto } from './dto/update.dto';

/** Site photos/videos go to update-images; documents attached to updates to project-files. */
const MEDIA_BUCKETS = ['update-images', 'project-files'] as const;

type UpdateRow = Record<string, unknown> & { poster?: { display_name?: string | null } | null };

/** Flatten the embedded poster into `posted_by_name` (the app shows a name). */
function withPosterName(row: UpdateRow) {
  const { poster, ...rest } = row;
  return { ...rest, posted_by_name: poster?.display_name ?? null };
}

@Injectable()
export class UpdatesService {
  private readonly logger = new Logger(UpdatesService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: ProjectAccessService,
    private readonly storage: StorageService,
    private readonly notifications: NotificationsService,
  ) {}

  private db() {
    return this.supabase.admin();
  }

  async list(
    user: AuthenticatedUser,
    projectId: string,
    limit = 50,
    offset = 0,
  ) {
    await this.access.assertMember(user, projectId);
    let q = this.db()
      .from('project_updates')
      .select('*, poster:posted_by(display_name)')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    // Clients only see updates flagged client-viewable.
    if (user.role === 'client') q = q.eq('is_client_viewable', true);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => withPosterName(r as UpdateRow));
  }

  async create(
    user: AuthenticatedUser,
    projectId: string,
    dto: CreateUpdateDto,
  ) {
    await this.access.assertMember(user, projectId);
    const { data, error } = await this.db()
      .from('project_updates')
      .insert({
        project_id: projectId,
        posted_by: user.id,
        role: user.role.toUpperCase(),
        type: dto.type ?? 'message',
        content: dto.content,
        category: dto.category,
        room_id: dto.roomId ?? null,
        associated_worker_ids: dto.associatedWorkerIds ?? [],
        progress_percentage: dto.progressPercentage ?? null,
        media_urls: this.storage.normalizeProjectRefs(projectId, dto.mediaUrls, MEDIA_BUCKETS),
        is_client_viewable: dto.isClientViewable ?? true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);

    // Client-visible updates alert the client(s) + project staff (never the poster).
    // Fire-and-forget: a notification failure must never fail the post.
    if (data.is_client_viewable !== false) {
      void this.notifications
        .notifyProjectMembers(
          projectId,
          updateNotification({
            content: dto.content,
            posterName: user.displayName,
            updateId: data.id as string,
            projectId,
            senderId: user.id,
          }),
          UPDATE_AUDIENCE,
        )
        .catch((e: Error) => this.logger.warn(`Update ${data.id}: notify failed (${e.message})`));
    }
    return { ...data, posted_by_name: user.displayName };
  }

  /** Append a comment (atomic; clients only on client-viewable updates). */
  async addComment(user: AuthenticatedUser, projectId: string, updateId: string, text: string) {
    await this.access.assertMember(user, projectId);
    const comment = {
      id: randomUUID(),
      text,
      postedBy: user.displayName ?? user.email ?? 'User',
      postedById: user.id,
      role: user.role.toUpperCase(),
      timestamp: new Date().toISOString(),
    };
    const { data, error } = await this.db().rpc('append_update_comment', {
      p_project_id: projectId,
      p_update_id: updateId,
      p_comment: comment,
      p_client_only: user.role === 'client',
    });
    if (error) throw new Error(error.message);
    if (data === null) throw new NotFoundException('Update not found');
    return comment;
  }

  async remove(user: AuthenticatedUser, projectId: string, id: string) {
    await this.access.assertMember(user, projectId);
    const { data, error } = await this.db()
      .from('project_updates')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId)
      .select('media_urls');
    if (error) throw new Error(error.message);
    await this.storage.removeRefs((data ?? []).flatMap((r) => (r.media_urls as string[]) ?? []));
    return { deleted: true };
  }
}
