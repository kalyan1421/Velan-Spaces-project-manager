import {
  ts,
  dateOnly,
  mapProject,
  mapProjectMembers,
  mapBudgetTxn,
  mapUpdate,
  IdMaps,
} from './mappers';

describe('ts()', () => {
  it('passes through ISO strings', () => {
    expect(ts('2026-01-02T03:04:05.000Z')).toBe('2026-01-02T03:04:05.000Z');
  });
  it('converts Firestore {_seconds}', () => {
    expect(ts({ _seconds: 0, _nanoseconds: 0 })).toBe('1970-01-01T00:00:00.000Z');
  });
  it('converts {seconds}', () => {
    expect(ts({ seconds: 60 })).toBe('1970-01-01T00:01:00.000Z');
  });
  it('returns null for nullish', () => {
    expect(ts(null)).toBeNull();
    expect(ts(undefined)).toBeNull();
  });
});

describe('dateOnly()', () => {
  it('truncates ISO to YYYY-MM-DD', () => {
    expect(dateOnly('2026-06-18T10:00:00Z')).toBe('2026-06-18');
  });
  it('handles null', () => {
    expect(dateOnly(null)).toBeNull();
  });
});

describe('mapProject()', () => {
  it('maps fields and coerces money', () => {
    const row = mapProject({
      id: 'p1',
      data: { projectCode: 'VS-1', projectName: 'A', budget: '1000', isComplete: true },
    });
    expect(row.legacy_firestore_id).toBe('p1');
    expect(row.project_code).toBe('VS-1');
    expect(row.budget).toBe(1000);
    expect(row.is_complete).toBe(true);
  });
  it('falls back project_code to the doc id', () => {
    expect(mapProject({ id: 'p2', data: { projectName: 'B' } }).project_code).toBe('p2');
  });
});

describe('mapProjectMembers()', () => {
  const maps: IdMaps = {
    users: new Map([
      ['m1', 'uuid-m1'],
      ['w1', 'uuid-w1'],
    ]),
    projects: new Map(),
  };
  const doc = {
    id: 'p1',
    data: { managerIds: ['m1', 'unknown'], workerIds: ['w1'], budgetAccessManagerIds: ['m1'] },
  };
  const rows = mapProjectMembers(doc, 'proj-uuid', maps);

  it('expands arrays and skips unresolved users', () => {
    expect(rows).toHaveLength(2); // m1 + w1; "unknown" skipped
  });
  it('sets budget access only for the flagged manager', () => {
    const m = rows.find((r) => r.user_id === 'uuid-m1')!;
    const w = rows.find((r) => r.user_id === 'uuid-w1')!;
    expect(m.member_role).toBe('manager');
    expect(m.has_budget_access).toBe(true);
    expect(w.member_role).toBe('worker');
    expect(w.has_budget_access).toBe(false);
  });
});

describe('mapBudgetTxn()', () => {
  const maps: IdMaps = { users: new Map([['u1', 'uuid-u1']]), projects: new Map() };
  it('normalizes type and remaps added_by', () => {
    const row = mapBudgetTxn(
      { id: 'b1', data: { type: 'credit', amount: '250', addedBy: 'u1' } },
      'proj-uuid',
      maps,
    );
    expect(row.type).toBe('credit');
    expect(row.amount).toBe(250);
    expect(row.added_by).toBe('uuid-u1');
  });
  it('defaults unknown type to debit and unresolved user to null', () => {
    const row = mapBudgetTxn({ id: 'b2', data: { amount: 10, addedBy: 'ghost' } }, 'p', maps);
    expect(row.type).toBe('debit');
    expect(row.added_by).toBeNull();
  });
});

describe('mapUpdate()', () => {
  it('maps timestamp→created_at and defaults client-viewable', () => {
    const row = mapUpdate(
      { id: 'u1', data: { content: 'hi', timestamp: '2026-06-18T00:00:00Z' } },
      'proj-uuid',
      { users: new Map(), projects: new Map() },
    );
    expect(row.created_at).toBe('2026-06-18T00:00:00Z');
    expect(row.is_client_viewable).toBe(true);
    expect(row.media_urls).toEqual([]);
  });
});
