export type AppRole = 'head' | 'manager' | 'worker' | 'client';

/** The user resolved from a verified Supabase JWT + the `users` table. */
export interface AuthenticatedUser {
  id: string;
  email: string | null;
  role: AppRole;
  displayName: string | null;
}
