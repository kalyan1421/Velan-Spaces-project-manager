import { camelizeKeys, snakeToCamel } from './case';

describe('snakeToCamel', () => {
  it('converts snake_case keys', () => {
    expect(snakeToCamel('project_code')).toBe('projectCode');
    expect(snakeToCamel('has_budget_access')).toBe('hasBudgetAccess');
    expect(snakeToCamel('line_2_total')).toBe('line2Total');
  });

  it('leaves camelCase and leading underscores alone', () => {
    expect(snakeToCamel('projectCode')).toBe('projectCode');
    expect(snakeToCamel('_meta')).toBe('_meta');
    expect(snakeToCamel('id')).toBe('id');
  });
});

describe('camelizeKeys', () => {
  it('converts nested objects and arrays', () => {
    const input = {
      project_code: 'VS-1',
      members: [{ user_id: 'u1', has_budget_access: true }],
      meta: { created_at: '2026-01-01T00:00:00Z' },
    };
    expect(camelizeKeys(input)).toEqual({
      projectCode: 'VS-1',
      members: [{ userId: 'u1', hasBudgetAccess: true }],
      meta: { createdAt: '2026-01-01T00:00:00Z' },
    });
  });

  it('does not touch values or non-plain objects', () => {
    const d = new Date('2026-01-01T00:00:00Z');
    const out = camelizeKeys<{ when: Date; note: string }>({ when: d, note: 'snake_case_text' });
    expect(out.when).toBe(d);
    expect(out.note).toBe('snake_case_text');
  });

  it('passes primitives and null through', () => {
    expect(camelizeKeys(null)).toBeNull();
    expect(camelizeKeys(5)).toBe(5);
    expect(camelizeKeys(['a_b'])).toEqual(['a_b']);
  });
});
