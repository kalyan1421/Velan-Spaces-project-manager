import { groupMembers, MemberRow, planMemberSync } from './project-members';

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
