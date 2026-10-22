export type AppRole = 'head' | 'manager' | 'worker' | 'client';

/** The user resolved from a verified Supabase JWT + the `users` table. */
export interface AuthenticatedUser {
  id: string;
  email: string | null;
  role: AppRole;
  displayName: string | null;
  /** Login name for staff without email (workers); null otherwise. */
  username: string | null;
  /** Suspended accounts are rejected at login, refresh and on every request. */
  isSuspended: boolean;
}
