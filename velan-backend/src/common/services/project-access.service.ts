import { ForbiddenException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AuthenticatedUser } from '../types/authenticated-user';

/**
 * Centralizes per-project authorization so every domain module enforces the
 * same rules (replicates the app's current role behavior):
 *  - head: full access to all projects
 *  - manager/worker/client: only projects they belong to (project_members)
 *  - budget/settlements: head, or manager WITH has_budget_access
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
    const { data, error } = await this.db()
      .from('project_members')
      .select('project_id')
      .eq('user_id', user.id);
    if (error) throw new Error(error.message);
    return (data ?? []).map((m) => m.project_id as string);
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
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ForbiddenException('Not a member of this project');
  }

  async assertBudgetAccess(
    user: AuthenticatedUser,
    projectId: string,
  ): Promise<void> {
    if (user.role === 'head') return;
    if (user.role !== 'manager') {
      throw new ForbiddenException('Budget access denied');
    }
    const { data, error } = await this.db()
      .from('project_members')
      .select('has_budget_access')
      .eq('user_id', user.id)
      .eq('project_id', projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data || !data.has_budget_access) {
      throw new ForbiddenException('No budget access for this project');
    }
  }
}
