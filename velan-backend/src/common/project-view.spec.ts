import { sanitizeProject } from './project-view';

const row = {
  id: 'p1',
  project_name: 'Villa',
  budget: 1500000,
  estimated_cost: 1200000,
  current_spend: 100,
  client_name: 'A',
  client_phone: '999',
  client_email: 'a@b.c',
};

describe('sanitizeProject', () => {
  it('head with budget access sees everything', () => {
    expect(sanitizeProject(row, { role: 'head', canSeeBudget: true })).toEqual(row);
  });

  it('manager with budget access sees budget + contact', () => {
    const out = sanitizeProject(row, { role: 'manager', canSeeBudget: true });
    expect(out.budget).toBe(1500000);
    expect(out.client_phone).toBe('999');
  });

  it('manager WITHOUT budget access loses money fields but keeps contact', () => {
    const out = sanitizeProject(row, { role: 'manager', canSeeBudget: false });
    expect(out).not.toHaveProperty('budget');
    expect(out).not.toHaveProperty('estimated_cost');
    expect(out).not.toHaveProperty('current_spend');
    expect(out.client_phone).toBe('999');
  });

  it('worker loses money AND contact fields', () => {
    const out = sanitizeProject(row, { role: 'worker', canSeeBudget: false });
    expect(out).not.toHaveProperty('budget');
    expect(out).not.toHaveProperty('client_phone');
    expect(out).not.toHaveProperty('client_email');
    expect(out.project_name).toBe('Villa');
  });

  it('client loses money AND contact fields', () => {
    const out = sanitizeProject(row, { role: 'client', canSeeBudget: false });
    expect(Object.keys(out).sort()).toEqual(['client_name', 'id', 'project_name']);
  });

  it('does not mutate the input row', () => {
    const copy = { ...row };
    sanitizeProject(row, { role: 'client', canSeeBudget: false });
    expect(row).toEqual(copy);
  });
});
