import {
  generateToken,
  hashToken,
  linkStatus,
  linkUrl,
  looksLikeToken,
  normalizeUsername,
  workerAuthEmail,
} from './account-links';

describe('tokens', () => {
  it('generates unique URL-safe tokens that pass the shape check', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(looksLikeToken(a)).toBe(true);
    expect(looksLikeToken('short')).toBe(false);
    expect(looksLikeToken(a + '/')).toBe(false);
  });

  it('hashes deterministically and never returns the token', () => {
    const t = generateToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toContain(t);
  });
});

describe('linkStatus', () => {
  const now = new Date('2026-10-14T12:00:00Z');
  it('valid / used / expired', () => {
    expect(linkStatus({ used_at: null, expires_at: '2026-10-15T00:00:00Z' }, now)).toBe('valid');
    expect(linkStatus({ used_at: '2026-10-14T11:00:00Z', expires_at: '2026-10-15T00:00:00Z' }, now)).toBe('used');
    expect(linkStatus({ used_at: null, expires_at: '2026-10-14T12:00:00Z' }, now)).toBe('expired');
  });
});

describe('linkUrl', () => {
  it('builds web app paths per kind', () => {
    expect(linkUrl('https://app.example.com/', 'client_invite', 'abc')).toBe('https://app.example.com/invite/abc');
    expect(linkUrl('https://app.example.com', 'password_reset', 'abc')).toBe(
      'https://app.example.com/reset-password/abc',
    );
  });
});

describe('usernames', () => {
  it('normalises and validates', () => {
    expect(normalizeUsername('  Ravi.K ')).toBe('ravi.k');
    expect(normalizeUsername('ab')).toBeNull();
    expect(normalizeUsername('-ravi')).toBeNull();
    expect(normalizeUsername('ravi kumar')).toBeNull();
    expect(normalizeUsername('a'.repeat(33))).toBeNull();
  });

  it('builds the synthetic worker email', () => {
    expect(workerAuthEmail('ravi.k', 'workers.velanspaces.invalid')).toBe('ravi.k@workers.velanspaces.invalid');
  });
});
