import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { ProjectAccessService } from '../../common/services/project-access.service';
import { NotificationsService } from '../notifications/notifications.module';
import { sanitizeProject } from '../../common/project-view';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';
import {
  DesiredMembers,
  emptyMembers,
  groupMembers,
  MemberLists,
  MemberRole,
  MemberRow,
  MemberUserRow,
  planMemberSync,
  projectMemberDirectory,
  visibleMembers,
} from './project-members';

/**
 * Reference module for the role-scoped access pattern:
 *  - head sees everything
 *  - manager/worker/client see only projects they belong to (project_members)
 *  - money fields (budget / estimate / spend) are returned only to head and to
 *    managers with budget access on that project; client contact details are
 *    hidden from workers and clients (see common/project-view.ts).
 *
 * Every project is returned with its member id lists (managerIds, workerIds,
 * clientIds, budgetAccessManagerIds) — the shape the app's model expects.
 */
/** True when `next` is omitted or holds the same ids as `current` (any order). */
function sameIds(next: string[] | undefined, current: string[]): boolean {
  if (next === undefined) return true;
  const a = new Set(next);
  return a.size === new Set(current).size && current.every((id) => a.has(id));
}

interface NewMember {
  userId: string;
  memberRole: MemberRole;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly access: ProjectAccessService,
    private readonly notifications: NotificationsService,
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
      const members = await this.membersFor((data ?? []).map((p) => p.id));
      return (data ?? []).map((p) =>
        this.view(p, members, { role: user.role, canSeeBudget: true }),
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
    const members = await this.membersFor(ids);
    return (data ?? []).map((p) =>
      this.view(p, members, {
        role: user.role,
        canSeeBudget: user.role === 'manager' && memberships.get(p.id) === true,
      }),
    );
  }

  async findOne(user: AuthenticatedUser, id: string) {
    await this.access.assertMember(user, id);
    const data = await this.fetchRow(id);
    return this.view(data, await this.membersFor([id]), {
      role: user.role,
      canSeeBudget: await this.access.hasBudgetAccess(user, id),
    });
  }

  /**
   * Names of the people on a project, for any member of it (workers and
   * clients cannot list staff). Contact details only for head and managers.
   */
  async members(user: AuthenticatedUser, id: string) {
    await this.access.assertMember(user, id);
    // Head passes assertMember for any id; answer 404 for a project that doesn't exist.
    if (user.role === 'head') await this.assertExists(id);

    const { data: rows, error } = await this.db()
      .from('project_members')
      .select('project_id, user_id, member_role, has_budget_access')
      .eq('project_id', id);
    if (error) throw new Error(error.message);
    const memberRows = (rows ?? []) as MemberRow[];
    const ids = [...new Set(memberRows.map((r) => r.user_id))];
    if (ids.length === 0) return [];

    const { data: users, error: uErr } = await this.db()
      .from('users')
      .select('id, role, display_name, username, email, phone, trade, is_suspended')
      .in('id', ids);
    if (uErr) throw new Error(uErr.message);
    return projectMemberDirectory(memberRows, (users ?? []) as MemberUserRow[], user.role);
  }

  async create(user: AuthenticatedUser, dto: CreateProjectDto) {
    // Managers may staff their own project with workers, but only head picks
    // managers, clients and budget access.
    if (user.role === 'manager') this.assertManagerMemberEdit(dto);

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
        start_date: dto.startDate ?? null,
        target_end_date: dto.targetEndDate ?? null,
      })
      .select()
      .single();
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        throw new ConflictException('project_code already exists');
      }
      throw new Error(error.message);
    }

    const desired: DesiredMembers = {
      managerIds: dto.managerIds,
      workerIds: dto.workerIds,
      clientIds: dto.clientIds,
      budgetAccessManagerIds: dto.budgetAccessManagerIds,
    };
    // A manager who creates a project must be able to open it afterwards
    // (head sees everything and needs no membership row). They entered the
    // budget, so they keep budget access on it.
    if (user.role === 'manager') {
      desired.managerIds = [user.id];
      desired.budgetAccessManagerIds = [user.id];
    }

    try {
      const added = await this.syncMembers(data.id, desired);
      this.notifyAssigned(data.id, data.project_name as string, added, user);
    } catch (e) {
      // Do not leave a half-created project behind.
      await this.db().from('projects').delete().eq('id', data.id);
      throw e;
    }
    return this.view(data, await this.membersFor([data.id]), {
      role: user.role,
      canSeeBudget: true,
    });
  }

  async update(user: AuthenticatedUser, id: string, input: UpdateProjectDto) {
    await this.access.assertMember(user, id);
    const dto: UpdateProjectDto = { ...input };

    // Edit forms send every field back. Money fields are hidden from users
    // without budget access (they see 0), so their values are ignored rather
    // than written or rejected.
    const canSeeBudget = await this.access.hasBudgetAccess(user, id);
    if (!canSeeBudget) {
      delete dto.budget;
      delete dto.estimatedCost;
    }
    if (user.role === 'manager') {
      // Likewise a manager's form echoes the member lists: only an actual
      // change to managers/clients/budget access is refused.
      const current = (await this.membersFor([id])).get(id) ?? emptyMembers();
      if (sameIds(dto.managerIds, current.managerIds)) delete dto.managerIds;
      if (sameIds(dto.clientIds, current.clientIds)) delete dto.clientIds;
      if (sameIds(dto.budgetAccessManagerIds, current.budgetAccessManagerIds)) {
        delete dto.budgetAccessManagerIds;
      }
      this.assertManagerMemberEdit(dto);
    }

    const patch: Record<string, unknown> = {};
    if (dto.projectCode !== undefined) patch.project_code = dto.projectCode;
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
    if (dto.startDate !== undefined) patch.start_date = dto.startDate;
    if (dto.targetEndDate !== undefined) patch.target_end_date = dto.targetEndDate;

    let row: Record<string, unknown>;
    if (Object.keys(patch).length > 0) {
      const { data, error } = await this.db()
        .from('projects')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if ((error as { code?: string }).code === '23505') {
          throw new ConflictException('project_code already exists');
        }
        throw new Error(error.message);
      }
      row = data;
    } else {
      row = await this.fetchRow(id);
    }

    const added = await this.syncMembers(id, {
      managerIds: dto.managerIds,
      workerIds: dto.workerIds,
      clientIds: dto.clientIds,
      budgetAccessManagerIds: dto.budgetAccessManagerIds,
    });
    this.notifyAssigned(id, row.project_name as string, added, user);
    return this.view(row, await this.membersFor([id]), { role: user.role, canSeeBudget });
  }

  async remove(id: string) {
    // FK cascade removes child rows (updates, designs, budget, …).
    const { error } = await this.db().from('projects').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return { deleted: true };
  }

  // ------------------------------------------------------------ helpers

  private assertManagerMemberEdit(dto: CreateProjectDto | UpdateProjectDto) {
    if (
      dto.managerIds !== undefined ||
      dto.clientIds !== undefined ||
      dto.budgetAccessManagerIds !== undefined
    ) {
      throw new ForbiddenException('Only the administrator assigns managers, clients and budget access');
    }
  }

  private async assertExists(id: string): Promise<void> {
    const { data, error } = await this.db().from('projects').select('id').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Project not found');
  }

  private async fetchRow(id: string): Promise<Record<string, unknown>> {
    const { data, error } = await this.db()
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException('Project not found');
    return data;
  }

  private view(
    row: Record<string, unknown>,
    members: Map<string, MemberLists>,
    viewer: { role: AuthenticatedUser['role']; canSeeBudget: boolean },
  ) {
    return {
      ...sanitizeProject(row, viewer),
      ...visibleMembers(members.get(row.id as string) ?? emptyMembers(), viewer.role),
    };
  }

  private async membersFor(projectIds: string[]): Promise<Map<string, MemberLists>> {
    if (projectIds.length === 0) return new Map();
    const { data, error } = await this.db()
      .from('project_members')
      .select('project_id, user_id, member_role, has_budget_access')
      .in('project_id', projectIds);
    if (error) throw new Error(error.message);
    return groupMembers((data ?? []) as MemberRow[]);
  }

  /** Apply the desired member lists to one project (provided lists replace). */
  private async syncMembers(projectId: string, desired: DesiredMembers): Promise<NewMember[]> {
    const provided = Object.values(desired).some((v) => v !== undefined);
    if (!provided) return [];

    await this.assertRoles(desired);

    const { data: current, error } = await this.db()
      .from('project_members')
      .select('project_id, user_id, member_role, has_budget_access')
      .eq('project_id', projectId);
    if (error) throw new Error(error.message);

    const plan = planMemberSync((current ?? []) as MemberRow[], desired);
    if (plan.invalidBudgetIds.length > 0) {
      throw new BadRequestException('budgetAccessManagerIds must be managers of the project');
    }

    for (const d of plan.deletes) {
      const { error: e } = await this.db()
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', d.user_id)
        .eq('member_role', d.member_role);
      if (e) throw new Error(e.message);
    }
    if (plan.inserts.length > 0) {
      const { error: e } = await this.db()
        .from('project_members')
        .insert(plan.inserts.map((i) => ({ ...i, project_id: projectId })));
      if (e) throw new Error(e.message);
    }
    for (const u of plan.budgetUpdates) {
      const { error: e } = await this.db()
        .from('project_members')
        .update({ has_budget_access: u.has_budget_access })
        .eq('project_id', projectId)
        .eq('user_id', u.user_id)
        .eq('member_role', 'manager');
      if (e) throw new Error(e.message);
    }
    return plan.inserts.map((i) => ({ userId: i.user_id, memberRole: i.member_role }));
  }

  /** Tell newly added managers and workers they were assigned. Never throws. */
  private notifyAssigned(projectId: string, projectName: string, added: NewMember[], actor: AuthenticatedUser) {
    for (const role of ['manager', 'worker'] as const) {
      const ids = added.filter((m) => m.memberRole === role).map((m) => m.userId);
      if (ids.length === 0) continue;
      void this.notifications
        .notifyUsers(ids, {
          title: 'Assigned to a project',
          body: `You were added as ${role} on ${projectName}`,
          type: 'assignment',
          projectId,
          projectName,
          senderId: actor.id,
          senderName: actor.displayName ?? undefined,
        })
        .catch(() => undefined);
    }
  }

  /** Every id must be an existing user whose account role matches the list. */
  private async assertRoles(desired: DesiredMembers) {
    const expected: [string[] | undefined, MemberRole][] = [
      [desired.managerIds, 'manager'],
      [desired.workerIds, 'worker'],
      [desired.clientIds, 'client'],
    ];
    const ids = [...new Set(expected.flatMap(([list]) => list ?? []))];
    if (ids.length === 0) return;
    const { data, error } = await this.db().from('users').select('id, role').in('id', ids);
    if (error) throw new Error(error.message);
    const roleOf = new Map((data ?? []).map((u) => [u.id as string, u.role as string]));
    for (const [list, role] of expected) {
      for (const id of list ?? []) {
        if (roleOf.get(id) !== role) {
          throw new BadRequestException(`${id} is not a ${role} account`);
        }
      }
    }
  }
}
