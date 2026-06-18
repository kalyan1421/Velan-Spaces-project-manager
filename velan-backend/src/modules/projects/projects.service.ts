import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

/**
 * Reference module. Demonstrates the role-scoped access pattern the other
 * domain modules (updates, designs, budget, …) will follow:
 *  - head sees everything
 *  - manager/worker/client see only projects they belong to (project_members)
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly supabase: SupabaseService) {}

  private db() {
    return this.supabase.admin();
  }

  async list(user: AuthenticatedUser) {
    if (user.role === 'head') {
      const { data, error } = await this.db()
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    }

    // Non-head: only projects the user is a member of.
    const { data: memberships, error: mErr } = await this.db()
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id);
    if (mErr) throw new Error(mErr.message);

    const ids = (memberships ?? []).map((m) => m.project_id);
    if (ids.length === 0) return [];

    const { data, error } = await this.db()
      .from('projects')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  }

  async findOne(user: AuthenticatedUser, id: string) {
    await this.assertCanAccess(user, id);
    const { data, error } = await this.db()
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Project not found');
    return data;
  }

  async create(dto: CreateProjectDto) {
    const { data, error } = await this.db()
      .from('projects')
      .insert({
        project_code: dto.projectCode,
        project_name: dto.projectName,
        client_name: dto.clientName,
        client_phone: dto.clientPhone,
        client_email: dto.clientEmail,
        location: dto.location,
        budget: dto.budget ?? 0,
        estimated_cost: dto.estimatedCost ?? 0,
        completion_percentage: dto.completionPercentage ?? 0,
        is_complete: dto.isComplete ?? false,
      })
      .select()
      .single();
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('project_code already exists');
      }
      throw new Error(error.message);
    }
    return data;
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateProjectDto) {
    await this.assertCanAccess(user, id);
    const patch: Record<string, unknown> = {};
    if (dto.projectName !== undefined) patch.project_name = dto.projectName;
    if (dto.clientName !== undefined) patch.client_name = dto.clientName;
    if (dto.clientPhone !== undefined) patch.client_phone = dto.clientPhone;
    if (dto.clientEmail !== undefined) patch.client_email = dto.clientEmail;
    if (dto.location !== undefined) patch.location = dto.location;
    if (dto.budget !== undefined) patch.budget = dto.budget;
    if (dto.estimatedCost !== undefined) patch.estimated_cost = dto.estimatedCost;
    if (dto.completionPercentage !== undefined)
      patch.completion_percentage = dto.completionPercentage;
    if (dto.isComplete !== undefined) patch.is_complete = dto.isComplete;

    const { data, error } = await this.db()
      .from('projects')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  }

  async remove(id: string) {
    // FK cascade removes child rows (updates, designs, budget, …).
    const { error } = await this.db().from('projects').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  }

  /** head bypasses; others must have a project_members row. */
  private async assertCanAccess(user: AuthenticatedUser, projectId: string) {
    if (user.role === 'head') return;
    const { data, error } = await this.db()
      .from('project_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ForbiddenException('Not a member of this project');
  }
}
