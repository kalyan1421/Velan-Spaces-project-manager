import {
  groupMembers,
  MemberRow,
  MemberUserRow,
  planMemberSync,
  projectMemberDirectory,
  visibleEmail,
  visibleMemberTypes,
  visibleMembers,
} from './project-members';

const row = (user_id: string, member_role: MemberRow['member_role'], has_budget_access = false, project_id = 'p1'): MemberRow => ({
  project_id,
  user_id,
  member_role,
  has_budget_access,
});

describe('groupMembers', () => {
  it('builds id lists per project', () => {
    const g = groupMembers([
      row('m1', 'manager', true),
      row('m2', 'manager'),
      row('w1', 'worker'),
      row('c1', 'client'),
      row('w9', 'worker', false, 'p2'),
    ]);
    expect(g.get('p1')).toEqual({
      managerIds: ['m1', 'm2'],
      workerIds: ['w1'],
      clientIds: ['c1'],
      budgetAccessManagerIds: ['m1'],
    });
    expect(g.get('p2')?.workerIds).toEqual(['w9']);
  });

  it('lets one user hold two roles on a project', () => {
    const g = groupMembers([row('u1', 'manager'), row('u1', 'worker')]);
    expect(g.get('p1')?.managerIds).toEqual(['u1']);
    expect(g.get('p1')?.workerIds).toEqual(['u1']);
  });
});

describe('planMemberSync', () => {
  const current = [row('m1', 'manager', true), row('m2', 'manager'), row('w1', 'worker'), row('c1', 'client')];

  it('leaves roles alone when their list is not provided', () => {
    const plan = planMemberSync(current, { workerIds: ['w1', 'w2'] });
    expect(plan.inserts).toEqual([{ user_id: 'w2', member_role: 'worker', has_budget_access: false }]);
    expect(plan.deletes).toEqual([]);
    expect(plan.budgetUpdates).toEqual([]);
  });

  it('replaces a provided role set', () => {
    const plan = planMemberSync(current, { managerIds: ['m2', 'm3'] });
    expect(plan.deletes).toEqual([{ user_id: 'm1', member_role: 'manager' }]);
    expect(plan.inserts).toEqual([{ user_id: 'm3', member_role: 'manager', has_budget_access: false }]);
  });

  it('applies budget access to new and existing managers', () => {
    const plan = planMemberSync(current, { managerIds: ['m1', 'm2', 'm3'], budgetAccessManagerIds: ['m2', 'm3'] });
    expect(plan.inserts).toEqual([{ user_id: 'm3', member_role: 'manager', has_budget_access: true }]);
    expect(plan.budgetUpdates).toEqual([
      { user_id: 'm1', has_budget_access: false },
      { user_id: 'm2', has_budget_access: true },
    ]);
    expect(plan.invalidBudgetIds).toEqual([]);
  });

  it('flags budget access for non-managers', () => {
    const plan = planMemberSync(current, { budgetAccessManagerIds: ['w1'] });
    expect(plan.invalidBudgetIds).toEqual(['w1']);
  });

  it('dedupes desired ids', () => {
    const plan = planMemberSync([], { workerIds: ['w1', 'w1'] });
    expect(plan.inserts).toHaveLength(1);
  });
});

describe('visibleMembers', () => {
  const lists = { managerIds: ['m'], workerIds: ['w'], clientIds: ['c'], budgetAccessManagerIds: ['m'] };

  it('staff see everything', () => {
    expect(visibleMembers(lists, 'head')).toEqual(lists);
    expect(visibleMembers(lists, 'manager')).toEqual(lists);
  });

  it('workers do not see clients or budget access', () => {
    expect(visibleMembers(lists, 'worker')).toEqual({ managerIds: ['m'], workerIds: ['w'] });
  });

  it('clients only see the worker list', () => {
    expect(visibleMembers(lists, 'client')).toEqual({ workerIds: ['w'] });
  });
});

describe('projectMemberDirectory', () => {
  const rows = [
    row('m1', 'manager', true),
    row('m2', 'manager'),
    row('w1', 'worker'),
    row('w2', 'worker'),
    row('c1', 'client'),
  ];
  const users: MemberUserRow[] = [
    { id: 'm1', role: 'manager', display_name: 'Meera', email: 'meera@velan.test', phone: '+91 90000 00001', username: null, trade: null, is_suspended: false },
    { id: 'm2', role: 'manager', display_name: ' ', email: 'arun@velan.test', phone: null, username: null, trade: null, is_suspended: false },
    { id: 'w1', role: 'worker', display_name: 'Ravi', email: null, phone: '98400', username: 'ravi.k', trade: 'Electrician', is_suspended: true },
    { id: 'w2', role: 'worker', display_name: null, email: 'w2@workers.velanspaces.invalid', phone: null, username: 'selva', trade: null, is_suspended: false },
    { id: 'c1', role: 'client', display_name: 'Anand', email: 'anand@example.com', phone: '+91 98400 12345', username: null, trade: null, is_suspended: false },
  ];

  it('gives head and managers every membership with contact details', () => {
    for (const viewer of ['head', 'manager'] as const) {
      const list = projectMemberDirectory(rows, users, viewer);
      expect(list.map((m) => `${m.memberType}:${m.userId}`)).toEqual([
        'manager:m2', // "arun" sorts before "Meera"
        'manager:m1',
        'worker:w1',
        'worker:w2',
        'client:c1',
        'budgetAccess:m1',
      ]);
      const meera = list.find((m) => m.userId === 'm1' && m.memberType === 'manager');
      expect(meera).toEqual({
        userId: 'm1',
        fullName: 'Meera',
        role: 'manager',
        memberType: 'manager',
        trade: null,
        avatarUrl: null,
        email: 'meera@velan.test',
        phone: '+91 90000 00001',
        username: null,
        isSuspended: false,
      });
      const ravi = list.find((m) => m.userId === 'w1');
      expect(ravi).toMatchObject({ trade: 'Electrician', username: 'ravi.k', isSuspended: true });
    }
  });

  it('lets staff fall back to the login name, never to an internal worker email', () => {
    const list = projectMemberDirectory(rows, users, 'head');
    expect(list.find((m) => m.userId === 'm2')?.fullName).toBe('arun');
    const selva = list.find((m) => m.userId === 'w2');
    expect(selva?.fullName).toBe('selva');
    expect(selva?.email).toBeNull();
  });

  it('gives workers and clients names only: no clients, budget access or contact details', () => {
    for (const viewer of ['worker', 'client'] as const) {
      const list = projectMemberDirectory(rows, users, viewer);
      expect(list.map((m) => `${m.memberType}:${m.userId}`)).toEqual([
        'manager:m1',
        'manager:m2',
        'worker:w1',
        'worker:w2',
      ]);
      for (const m of list) {
        expect(Object.keys(m).sort()).toEqual(['avatarUrl', 'fullName', 'memberType', 'role', 'trade', 'userId']);
      }
      // No login-name or email fallback: a generic label instead.
      expect(list.find((m) => m.userId === 'm2')?.fullName).toBe('Project manager');
      expect(list.find((m) => m.userId === 'w2')?.fullName).toBe('Worker');
      expect(list.find((m) => m.userId === 'w1')?.fullName).toBe('Ravi');
    }
  });

  it('keeps one entry per user and member type, and survives a missing user row', () => {
    const list = projectMemberDirectory(
      [row('u1', 'manager'), row('u1', 'worker'), row('u1', 'worker'), row('gone', 'worker')],
      [{ id: 'u1', role: 'manager', display_name: 'Uma' }],
      'manager',
    );
    expect(list.map((m) => `${m.memberType}:${m.userId}:${m.fullName}`)).toEqual([
      'manager:u1:Uma',
      'worker:u1:Uma',
      'worker:gone:Worker',
    ]);
    expect(list.find((m) => m.userId === 'gone')).toMatchObject({ role: null, email: null, isSuspended: false });
  });

  it('returns an empty list for a project without members', () => {
    expect(projectMemberDirectory([], [], 'client')).toEqual([]);
  });
});

describe('visibleMemberTypes / visibleEmail', () => {
  it('limits non-staff to managers and workers', () => {
    expect(visibleMemberTypes('head')).toEqual(['manager', 'worker', 'client', 'budgetAccess']);
    expect(visibleMemberTypes('client')).toEqual(['manager', 'worker']);
  });

  it('hides internal worker sign-in addresses', () => {
    expect(visibleEmail('ravi.k@workers.velanspaces.invalid')).toBeNull();
    expect(visibleEmail(' a@b.com ')).toBe('a@b.com');
    expect(visibleEmail(null)).toBeNull();
  });
});
