import {
  evaluateStoragePolicy,
  StorageRequest,
  validateObjectPath,
} from './storage-policy';

const PID = '11111111-2222-3333-4444-555555555555';
const UID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const base = (over: Partial<StorageRequest>): StorageRequest => ({
  bucket: 'project-files',
  path: `projects/${PID}/chat/photo.jpg`,
  mode: 'download',
  role: 'worker',
  userId: UID,
  ...over,
});

describe('validateObjectPath', () => {
  it.each([
    ['', 'empty'],
    ['/abs/file.jpg', 'absolute'],
    ['projects/../secrets.jpg', 'traversal'],
    ['projects//x.jpg', 'empty segment'],
    ['projects/./x.jpg', 'dot segment'],
    ['projects\\x.jpg', 'backslash'],
    ['projects/\u0000x.jpg', 'control char'],
    ['a/'.repeat(200) + 'x.jpg', 'too long'],
  ])('rejects %s (%s)', (p) => {
    expect(validateObjectPath(p)).not.toBeNull();
  });

  it('accepts a normal relative path', () => {
    expect(validateObjectPath(`projects/${PID}/updates/1_photo.jpg`)).toBeNull();
  });
});

describe('evaluateStoragePolicy — project buckets', () => {
  it('allows a member download and returns the project id for the membership check', () => {
    const d = evaluateStoragePolicy(base({}));
    expect(d).toEqual({ allowed: true, projectId: PID });
  });

  it('rejects paths outside projects/<uuid>/ (cannot name another bucket layout)', () => {
    expect(evaluateStoragePolicy(base({ path: 'other/x.jpg' })).allowed).toBe(false);
    expect(evaluateStoragePolicy(base({ path: 'projects/not-a-uuid/x.jpg' })).allowed).toBe(false);
    expect(evaluateStoragePolicy(base({ path: `projects/${PID}` })).allowed).toBe(false);
  });

  it('designs: only head/manager may upload; everyone may download', () => {
    const up = (role: StorageRequest['role']) =>
      evaluateStoragePolicy(
        base({ bucket: 'designs', mode: 'upload', role, path: `projects/${PID}/designs/plan.pdf` }),
      ).allowed;
    expect(up('head')).toBe(true);
    expect(up('manager')).toBe(true);
    expect(up('worker')).toBe(false);
    expect(up('client')).toBe(false);
    expect(
      evaluateStoragePolicy(
        base({ bucket: 'designs', role: 'client', path: `projects/${PID}/designs/plan.pdf` }),
      ).allowed,
    ).toBe(true);
  });

  it('update-images: field staff upload, clients cannot', () => {
    const up = (role: StorageRequest['role']) =>
      evaluateStoragePolicy(
        base({ bucket: 'update-images', mode: 'upload', role, path: `projects/${PID}/updates/a.jpg` }),
      ).allowed;
    expect(up('worker')).toBe(true);
    expect(up('client')).toBe(false);
  });

  it('project-files: every role may upload (chat / complaint attachments)', () => {
    for (const role of ['head', 'manager', 'worker', 'client'] as const) {
      expect(
        evaluateStoragePolicy(base({ mode: 'upload', role })).allowed,
      ).toBe(true);
    }
  });

  it('blocks disallowed upload file types (e.g. executables, html, svg)', () => {
    for (const name of ['evil.exe', 'page.html', 'x.svg', 'noext', 'a.sh']) {
      expect(
        evaluateStoragePolicy(base({ mode: 'upload', path: `projects/${PID}/chat/${name}` })).allowed,
      ).toBe(false);
    }
  });

  it('does not restrict the extension on download (existing legacy objects)', () => {
    expect(
      evaluateStoragePolicy(base({ path: `projects/${PID}/chat/legacy.bin` })).allowed,
    ).toBe(true);
  });

  it('normalises the project id to lowercase', () => {
    const d = evaluateStoragePolicy(
      base({ path: `projects/${PID.toUpperCase()}/chat/a.jpg` }),
    );
    expect(d).toEqual({ allowed: true, projectId: PID });
  });
});

describe('evaluateStoragePolicy — quotations / avatars / unknown', () => {
  it('quotations are staff-only for upload and download', () => {
    const d = (role: StorageRequest['role'], mode: 'upload' | 'download') =>
      evaluateStoragePolicy({
        bucket: 'quotations',
        path: 'quotation/sent/q1.pdf',
        mode,
        role,
        userId: UID,
      }).allowed;
    expect(d('head', 'upload')).toBe(true);
    expect(d('manager', 'download')).toBe(true);
    expect(d('worker', 'download')).toBe(false);
    expect(d('client', 'upload')).toBe(false);
  });

  it('quotations path must live under quotation(s)/', () => {
    expect(
      evaluateStoragePolicy({
        bucket: 'quotations',
        path: 'misc/q.pdf',
        mode: 'download',
        role: 'head',
        userId: UID,
      }).allowed,
    ).toBe(false);
  });

  it('avatars: upload only into own folder; download open to authenticated users', () => {
    const up = (path: string) =>
      evaluateStoragePolicy({ bucket: 'avatars', path, mode: 'upload', role: 'worker', userId: UID }).allowed;
    expect(up(`users/${UID}/me.png`)).toBe(true);
    expect(up(`users/someone-else/me.png`)).toBe(false);
    expect(up('me.png')).toBe(false);
    expect(
      evaluateStoragePolicy({
        bucket: 'avatars',
        path: `users/other/me.png`,
        mode: 'download',
        role: 'client',
        userId: UID,
      }).allowed,
    ).toBe(true);
  });

  it('rejects unknown buckets', () => {
    expect(evaluateStoragePolicy(base({ bucket: 'secrets' })).allowed).toBe(false);
  });
});
