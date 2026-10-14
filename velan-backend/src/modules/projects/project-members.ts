/**
 * Project membership <-> the id arrays the app works with (the legacy
 * Firestore project doc had managerIds / workerIds / budgetAccessManagerIds).
 * Pure functions so the sync rules are unit-tested without a database.
 */
export type MemberRole = 'manager' | 'worker' | 'client';

export interface MemberRow {
  project_id: string;
  user_id: string;
  member_role: MemberRole;
  has_budget_access: boolean;
}

export interface MemberLists {
  managerIds: string[];
  workerIds: string[];
  clientIds: string[];
  budgetAccessManagerIds: string[];
}

export interface DesiredMembers {
  managerIds?: string[];
  workerIds?: string[];
  clientIds?: string[];
  budgetAccessManagerIds?: string[];
}

export const emptyMembers = (): MemberLists => ({
  managerIds: [],
  workerIds: [],
  clientIds: [],
  budgetAccessManagerIds: [],
});

const ROLE_KEY: Record<MemberRole, keyof DesiredMembers> = {
  manager: 'managerIds',
  worker: 'workerIds',
  client: 'clientIds',
};

/** project_id -> member id lists. */
export function groupMembers(rows: MemberRow[]): Map<string, MemberLists> {
  const out = new Map<string, MemberLists>();
  for (const r of rows) {
    const m = out.get(r.project_id) ?? emptyMembers();
    const list = m[ROLE_KEY[r.member_role] as keyof MemberLists];
    if (!list.includes(r.user_id)) list.push(r.user_id);
    if (
      r.member_role === 'manager' &&
      r.has_budget_access &&
      !m.budgetAccessManagerIds.includes(r.user_id)
    ) {
      m.budgetAccessManagerIds.push(r.user_id);
    }
    out.set(r.project_id, m);
  }
  return out;
}

export interface MemberSyncPlan {
  inserts: { user_id: string; member_role: MemberRole; has_budget_access: boolean }[];
  deletes: { user_id: string; member_role: MemberRole }[];
  budgetUpdates: { user_id: string; has_budget_access: boolean }[];
  /** budgetAccessManagerIds that are not managers of the project after the sync. */
  invalidBudgetIds: string[];
}

const uniq = (ids: string[]) => [...new Set(ids)];

/**
 * Diff the current rows of ONE project against the desired lists. A list that
 * is undefined is left untouched; a provided list replaces that role's set.
 */
export function planMemberSync(current: MemberRow[], desired: DesiredMembers): MemberSyncPlan {
  const plan: MemberSyncPlan = { inserts: [], deletes: [], budgetUpdates: [], invalidBudgetIds: [] };

  const budgetSet =
    desired.budgetAccessManagerIds !== undefined ? new Set(desired.budgetAccessManagerIds) : null;

  for (const role of ['manager', 'worker', 'client'] as MemberRole[]) {
    const wanted = desired[ROLE_KEY[role]];
    if (wanted === undefined) continue;
    const want = new Set(uniq(wanted));
    const have = new Set(current.filter((r) => r.member_role === role).map((r) => r.user_id));
    for (const id of have) if (!want.has(id)) plan.deletes.push({ user_id: id, member_role: role });
    for (const id of want) {
      if (!have.has(id)) {
        plan.inserts.push({
          user_id: id,
          member_role: role,
          has_budget_access: role === 'manager' && budgetSet !== null && budgetSet.has(id),
        });
      }
    }
  }

  if (budgetSet !== null) {
    const finalManagers = new Set(
      desired.managerIds !== undefined
        ? uniq(desired.managerIds)
        : current.filter((r) => r.member_role === 'manager').map((r) => r.user_id),
    );
    plan.invalidBudgetIds = [...budgetSet].filter((id) => !finalManagers.has(id));
    // Existing manager rows that stay: flip the flag where it changes.
    for (const r of current) {
      if (r.member_role !== 'manager' || !finalManagers.has(r.user_id)) continue;
      const should = budgetSet.has(r.user_id);
      if (r.has_budget_access !== should) {
        plan.budgetUpdates.push({ user_id: r.user_id, has_budget_access: should });
      }
    }
  }
  return plan;
}
