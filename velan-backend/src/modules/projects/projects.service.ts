import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { sanitizeProject } from '../../common/project-view';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

/**
 * Reference module for the role-scoped access pattern:
 *  - head sees everything
 *  - manager/worker/client see only projects they belong to (project_members)
 *  - money fields (budget / estimate / spend) are returned only to head and to
 *    managers with budget access on that project; client contact details are
 *    hidden from workers and clients (see common/project-view.ts).
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: ProjectAccessService,
  ) {}

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
      return (data ?? []).map((p) =>
        sanitizeProject(p, { role: user.role, canSeeBudget: true }),
      );
    }

    // Non-head: only projects the user is a member of.
    const memberships = await this.access.membershipMap(user);
    const ids = [...memberships.keys()];
    if (ids.length === 0) return [];

    const { data, error } = await this.db()
      .from('projects')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) =>
      sanitizeProject(p, {
        role: user.role,
        canSeeBudget: user.role === 'manager' && memberships.get(p.id) === true,
      }),
    );
  }

  async findOne(user: AuthenticatedUser, id: string) {
    await this.access.assertMember(user, id);
    const { data, error } = await this.db()
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Project not found');
    return sanitizeProject(data, {
      role: user.role,
      canSeeBudget: await this.access.hasBudgetAccess(user, id),
    });
  }

  async create(user: AuthenticatedUser, dto: CreateProjectDto) {
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

    // A manager who creates a project must be able to open it afterwards
    // (head sees everything and needs no membership row). They entered the
    // budget, so they keep budget access on it.
    if (user.role === 'manager') {
      const { error: mErr } = await this.db().from('project_members').insert({
        project_id: data.id,
        user_id: user.id,
        member_role: 'manager',
        has_budget_access: true,
      });
      if (mErr) {
        // Do not leave an orphan project the creator cannot access.
        await this.db().from('projects').delete().eq('id', data.id);
        throw new Error(mErr.message);
      }
    }
    return sanitizeProject(data, { role: user.role, canSeeBudget: true });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateProjectDto) {
    await this.access.assertMember(user, id);

    const touchesMoney =
      dto.budget !== undefined || dto.estimatedCost !== undefined;
    const canSeeBudget = await this.access.hasBudgetAccess(user, id);
    if (touchesMoney && !canSeeBudget) {
      throw new ForbiddenException('No budget access for this project');
    }

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
    return sanitizeProject(data, { role: user.role, canSeeBudget });
  }

  async remove(id: string) {
    // FK cascade removes child rows (updates, designs, budget, …).
    const { error } = await this.db().from('projects').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  }
}
