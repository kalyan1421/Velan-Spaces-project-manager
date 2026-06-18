import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateUpdateDto } from './dto/update.dto';

@Injectable()
export class UpdatesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: ProjectAccessService,
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
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Clients only see updates flagged client-viewable.
    if (user.role === 'client') q = q.eq('is_client_viewable', true);

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
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
        media_urls: dto.mediaUrls ?? [],
        is_client_viewable: dto.isClientViewable ?? true,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async remove(user: AuthenticatedUser, projectId: string, id: string) {
    await this.access.assertMember(user, projectId);
    const { error } = await this.db()
      .from('project_updates')
      .delete()
      .eq('id', id)
      .eq('project_id', projectId);
    if (error) throw new Error(error.message);
    return { deleted: true };
  }
}
