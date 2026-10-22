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

/**
 * Which member lists a viewer may see. Who can see the budget, and the client
 * accounts on a project, are staff-only facts; a client only gets the worker
 * list (its project screen shows "N workers assigned").
 */
export function visibleMembers(
  lists: MemberLists,
  role: 'head' | 'manager' | 'worker' | 'client',
): Partial<MemberLists> {
  if (role === 'head' || role === 'manager') return lists;
  if (role === 'worker') return { managerIds: lists.managerIds, workerIds: lists.workerIds };
  return { workerIds: lists.workerIds };
}

// ------------------------------------------------------------------ directory

/**
 * `GET /projects/:id/members`: who is on a project, with names, for every
 * member (workers and clients cannot list staff). One entry per membership,
 * plus a `budgetAccess` entry for each manager who holds budget access.
 */
export type MemberType = MemberRole | 'budgetAccess';
export type ViewerRole = 'head' | 'manager' | 'worker' | 'client';

/** The `users` columns the directory reads. */
export interface MemberUserRow {
  id: string;
  role: string | null;
  display_name: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  trade?: string | null;
  is_suspended?: boolean | null;
}

export interface ProjectMemberEntry {
  userId: string;
  fullName: string;
  /** The account's role (users.role). */
  role: string | null;
  memberType: MemberType;
  trade: string | null;
  /** No avatar column yet; always null (kept so clients can rely on the key). */
  avatarUrl: null;
  // Head and managers only:
  email?: string | null;
  phone?: string | null;
  username?: string | null;
  isSuspended?: boolean;
}

const MEMBER_TYPE_ORDER: MemberType[] = ['manager', 'worker', 'client', 'budgetAccess'];

const GENERIC_NAME: Record<MemberType, string> = {
  manager: 'Project manager',
  worker: 'Worker',
  client: 'Client',
  budgetAccess: 'Project manager',
};

/** Worker accounts sign in with a hidden `<username>@<domain>.invalid` address; never expose it. */
export function visibleEmail(email: string | null | undefined): string | null {
  const e = typeof email === 'string' ? email.trim() : '';
  if (!e || /\.invalid$/i.test(e)) return null;
  return e;
}

const clean = (v: string | null | undefined): string | null => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t === '' ? null : t;
};

/** Member types a viewer may see: client accounts and budget access are staff-only facts. */
export function visibleMemberTypes(viewer: ViewerRole): MemberType[] {
  if (viewer === 'head' || viewer === 'manager') return [...MEMBER_TYPE_ORDER];
  return ['manager', 'worker'];
}

/**
 * Membership rows of ONE project + their user rows -> the directory a viewer
 * may see. Workers and clients get names (and trades) only: no email, phone,
 * login name, suspension state, client accounts or budget access.
 */
export function projectMemberDirectory(
  rows: MemberRow[],
  users: MemberUserRow[],
  viewer: ViewerRole,
): ProjectMemberEntry[] {
  const staff = viewer === 'head' || viewer === 'manager';
  const allowed = new Set(visibleMemberTypes(viewer));
  const userById = new Map(users.map((u) => [u.id, u]));
  const seen = new Set<string>();
  const out: ProjectMemberEntry[] = [];

  const push = (userId: string, memberType: MemberType) => {
    if (!allowed.has(memberType)) return;
    const key = `${userId}:${memberType}`;
    if (seen.has(key)) return;
    seen.add(key);
    const u = userById.get(userId);
    // Staff may fall back to the login name; others only ever see a real name.
    const staffFallback = staff
      ? (clean(u?.username) ?? visibleEmail(u?.email)?.split('@')[0] ?? null)
      : null;
    const name = clean(u?.display_name) ?? staffFallback ?? GENERIC_NAME[memberType];
    const entry: ProjectMemberEntry = {
      userId,
      fullName: name,
      role: u?.role ?? null,
      memberType,
      trade: clean(u?.trade),
      avatarUrl: null,
    };
    if (staff) {
      entry.email = visibleEmail(u?.email);
      entry.phone = clean(u?.phone);
      entry.username = clean(u?.username);
      entry.isSuspended = u?.is_suspended === true;
    }
    out.push(entry);
  };

  for (const r of rows) {
    push(r.user_id, r.member_role);
    if (r.member_role === 'manager' && r.has_budget_access) push(r.user_id, 'budgetAccess');
  }

  const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
  return out.sort(
    (a, b) =>
      MEMBER_TYPE_ORDER.indexOf(a.memberType) - MEMBER_TYPE_ORDER.indexOf(b.memberType) ||
      collator.compare(a.fullName, b.fullName) ||
      a.userId.localeCompare(b.userId),
  );
}
