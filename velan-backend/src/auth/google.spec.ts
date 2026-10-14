import { escapeLike, parseClientIds, verifiedGoogleEmail } from './google';

describe('parseClientIds', () => {
  it('splits, trims and drops empties', () => {
    expect(parseClientIds(' a.apps , ,b.apps ')).toEqual(['a.apps', 'b.apps']);
    expect(parseClientIds(undefined)).toEqual([]);
    expect(parseClientIds('')).toEqual([]);
  });
});

describe('verifiedGoogleEmail', () => {
  it('returns the lower-cased email when verified', () => {
    expect(verifiedGoogleEmail({ email: 'Head@VelanSpaces.com', email_verified: true })).toBe(
      'head@velanspaces.com',
    );
    expect(verifiedGoogleEmail({ email: 'a@b.co', email_verified: 'true' })).toBe('a@b.co');
  });

  it('rejects unverified or missing emails', () => {
    expect(verifiedGoogleEmail({ email: 'a@b.co', email_verified: false })).toBeNull();
    expect(verifiedGoogleEmail({ email: 'a@b.co' })).toBeNull();
    expect(verifiedGoogleEmail({ email_verified: true })).toBeNull();
    expect(verifiedGoogleEmail({ email: '  ', email_verified: true })).toBeNull();
  });
});

describe('escapeLike', () => {
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('first_last@x.com')).toBe('first\\_last@x.com');
    expect(escapeLike('100%@x.com')).toBe('100\\%@x.com');
    expect(escapeLike('a\\b')).toBe('a\\\\b');
  });
});
