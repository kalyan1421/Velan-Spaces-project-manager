import { AppRole } from './types/authenticated-user';

/**
 * Field-level visibility for a project row. The API used to return
 * `select('*')` to every member, which leaked budget/spend to clients and
 * workers (the legacy app only hid them in the UI).
 *
 *  - budget / estimated cost / current spend: head, or a manager who has
 *    budget access on that project. Nobody else.
 *  - client contact details: head and managers only (workers and clients
 *    have no screen that needs them).
 */
export const BUDGET_FIELDS = ['budget', 'estimated_cost', 'current_spend'] as const;
export const CONTACT_FIELDS = ['client_phone', 'client_email'] as const;

export interface ProjectViewer {
  role: AppRole;
  canSeeBudget: boolean;
}

export function sanitizeProject<T extends Record<string, unknown>>(
  row: T,
  viewer: ProjectViewer,
): Partial<T> {
  const out: Record<string, unknown> = { ...row };
  if (!viewer.canSeeBudget) {
    for (const f of BUDGET_FIELDS) delete out[f];
  }
  if (viewer.role === 'worker' || viewer.role === 'client') {
    for (const f of CONTACT_FIELDS) delete out[f];
  }
  return out as Partial<T>;
}
