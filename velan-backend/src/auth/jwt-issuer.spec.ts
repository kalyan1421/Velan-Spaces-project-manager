import { supabaseJwtIssuer } from './jwt-issuer';

describe('supabaseJwtIssuer', () => {
  it('uses SUPABASE_URL when the API reaches Supabase at its public address', () => {
    expect(supabaseJwtIssuer({ SUPABASE_URL: 'https://abc.supabase.co' })).toBe('https://abc.supabase.co/auth/v1');
  });

  it('uses SUPABASE_PUBLIC_URL when the API goes through an internal hostname', () => {
    expect(
      supabaseJwtIssuer({ SUPABASE_URL: 'http://kong:8000', SUPABASE_PUBLIC_URL: 'https://supabase.example.com/' }),
    ).toBe('https://supabase.example.com/auth/v1');
  });

  it('lets SUPABASE_JWT_ISSUER override both', () => {
    expect(
      supabaseJwtIssuer({
        SUPABASE_URL: 'http://kong:8000',
        SUPABASE_PUBLIC_URL: 'https://supabase.example.com',
        SUPABASE_JWT_ISSUER: 'https://auth.example.com/auth/v1/',
      }),
    ).toBe('https://auth.example.com/auth/v1');
  });
});
