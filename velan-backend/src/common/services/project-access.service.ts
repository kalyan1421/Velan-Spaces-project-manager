import { ForbiddenException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Centralizes per-project authorization so every domain module enforces the
 * same rules (replicates the app's current role behavior):
 *  - head: full access to all projects
 *  - manager/worker/client: only projects they belong to (project_members)
 *  - budget/settlements: head, or manager WITH has_budget_access
 *
 * NOTE: a user can legitimately have more than one project_members row for
 * the same project (e.g. manager + worker after the ETL), so lookups use
 * `.limit(1)` / aggregation, never `.maybeSingle()` (which errors on 2 rows).
 */
@Injectable()
export class ProjectAccessService {
  constructor(private readonly supabase: SupabaseService) {}

  private db() {
    return this.supabase.admin();
  }

  /** 'all' for head, otherwise the list of project ids the user can see. */
  async accessibleProjectIds(
    user: AuthenticatedUser,
  ): Promise<'all' | string[]> {
    if (user.role === 'head') return 'all';
    const map = await this.membershipMap(user);
    return [...map.keys()];
  }

  /**
   * projectId -> "has budget access" for every project the user belongs to.
   * (A manager has budget access on a project if ANY of their membership rows
   * for it grants it.) Not meaningful for head (who sees everything).
   */
  async membershipMap(user: AuthenticatedUser): Promise<Map<string, boolean>> {
    const { data, error } = await this.db()
      .from('project_members')
      .select('project_id, has_budget_access')
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
    const out = new Map<string, boolean>();
    for (const m of data ?? []) {
      const pid = m.project_id as string;
      out.set(pid, (out.get(pid) ?? false) || m.has_budget_access === true);
    }
    return out;
  }

  async assertMember(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<void> {
    if (user.role === 'head') return;
    const { data, error } = await this.db()
      .from('project_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .limit(1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new ForbiddenException('Not a member of this project');
    }
  }

  /** True for head, or a manager whose membership grants budget access. */
  async hasBudgetAccess(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<boolean> {
    if (user.role === 'head') return true;
    if (user.role !== 'manager') return false;
    const { data, error } = await this.db()
      .from('project_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .eq('has_budget_access', true)
      .limit(1);
    if (error) throw new Error(error.message);
    return !!data && data.length > 0;
  }

  async assertBudgetAccess(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<void> {
    if (user.role === 'head') return;
    if (user.role !== 'manager') {
      throw new ForbiddenException('Budget access denied');
    }
    if (!(await this.hasBudgetAccess(user, projectId))) {
      throw new ForbiddenException('No budget access for this project');
    }
  }
}
