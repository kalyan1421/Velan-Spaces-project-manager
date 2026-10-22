import { bearerSubject, THROTTLERS } from './throttle';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload: unknown) => `${b64({ alg: 'ES256' })}.${b64(payload)}.sig-nature_x`;

describe('bearerSubject', () => {
  it('reads sub from a bearer JWT without verifying it', () => {
    expect(bearerSubject(`Bearer ${jwt({ sub: 'user-1', role: 'authenticated' })}`)).toBe('user-1');
    expect(bearerSubject(`bearer   ${jwt({ sub: 'user-2' })}`)).toBe('user-2');
  });

  it('returns null for anything else', () => {
    expect(bearerSubject(undefined)).toBeNull();
    expect(bearerSubject('')).toBeNull();
    expect(bearerSubject('Basic abc')).toBeNull();
    expect(bearerSubject('Bearer not-a-jwt')).toBeNull();
    expect(bearerSubject(`Bearer ${b64({ alg: 'x' })}.!!!.sig`)).toBeNull();
    expect(bearerSubject(`Bearer ${jwt({ role: 'anon' })}`)).toBeNull();
    expect(bearerSubject(`Bearer ${jwt({ sub: 42 })}`)).toBeNull();
    expect(bearerSubject(`Bearer ${jwt({ sub: 'x'.repeat(101) })}`)).toBeNull();
  });
});

describe('THROTTLERS', () => {
  const user = THROTTLERS.find((t) => t.name === 'user')!;
  const ctx = (authorization?: string) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }) }) as never;

  it('keeps a generous per-IP default and a per-account bucket', () => {
    expect(THROTTLERS.find((t) => t.name === 'default')).toMatchObject({ ttl: 60_000, limit: 600 });
    expect(user).toMatchObject({ ttl: 60_000, limit: 240 });
  });

  it('skips the per-account bucket for anonymous requests and keys it by sub otherwise', async () => {
    expect(user.skipIf!(ctx())).toBe(true);
    expect(user.skipIf!(ctx(`Bearer ${jwt({ sub: 'u-9' })}`))).toBe(false);
    expect(await user.getTracker!({ headers: { authorization: `Bearer ${jwt({ sub: 'u-9' })}` } }, ctx())).toBe('user:u-9');
  });
});
