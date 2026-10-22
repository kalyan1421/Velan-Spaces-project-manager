const trimSlashes = (u: string) => u.replace(/\/+$/, '');

/**
 * The `iss` Supabase Auth puts in its tokens. Auth signs with its external
 * address, which is SUPABASE_PUBLIC_URL when the API reaches Supabase through
 * an internal hostname (Docker network, `host.docker.internal`), otherwise
 * SUPABASE_URL. SUPABASE_JWT_ISSUER overrides both for unusual setups.
 */
export function supabaseJwtIssuer(env: {
  SUPABASE_URL: string;
  SUPABASE_PUBLIC_URL?: string;
  SUPABASE_JWT_ISSUER?: string;
}): string {
  if (env.SUPABASE_JWT_ISSUER) return trimSlashes(env.SUPABASE_JWT_ISSUER);
  return `${trimSlashes(env.SUPABASE_PUBLIC_URL || env.SUPABASE_URL)}/auth/v1`;
}
