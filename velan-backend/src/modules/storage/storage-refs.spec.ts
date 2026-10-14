import { normalizeProjectRef, parseStorageRef, publicizeStorageUrl, toRef } from './storage-refs';

const SB = 'http://127.0.0.1:54321';
const PID = '5b91891e-1c5c-4f50-a8dc-f57c56d1458c';
const OTHER = '11111111-2222-3333-4444-555555555555';
const PUBLIC = 'https://files.velan.example';
const opts = { supabaseUrls: [PUBLIC, SB], projectId: PID, buckets: ['update-images', 'project-files'] as const };

describe('parseStorageRef', () => {
  it('parses sb:// references', () => {
    expect(parseStorageRef('sb://designs/projects/x/a.pdf', SB)).toEqual({
      bucket: 'designs',
      path: 'projects/x/a.pdf',
    });
  });

  it('parses our signed and public object URLs, decoding segments', () => {
    expect(
      parseStorageRef(`${SB}/storage/v1/object/sign/update-images/projects/${PID}/updates/my%20pic.jpg?token=abc`, SB),
    ).toEqual({ bucket: 'update-images', path: `projects/${PID}/updates/my pic.jpg` });
    expect(parseStorageRef(`${SB}/storage/v1/object/public/portfolio/a/b.png`, SB)).toEqual({
      bucket: 'portfolio',
      path: 'a/b.png',
    });
  });

  it('ignores foreign URLs and malformed refs', () => {
    expect(parseStorageRef('https://firebasestorage.googleapis.com/v0/b/x/o/y', SB)).toBeNull();
    expect(parseStorageRef('sb://bucketonly', SB)).toBeNull();
    expect(parseStorageRef('sb://bucket/', SB)).toBeNull();
    expect(parseStorageRef(`${SB}/storage/v1/object/upload/x/y`, SB)).toBeNull();
  });
});

describe('normalizeProjectRef', () => {
  it('canonicalises our URLs to sb:// refs inside the project folder', () => {
    const url = `${SB}/storage/v1/object/sign/update-images/projects/${PID}/updates/a.jpg?token=t`;
    expect(normalizeProjectRef(url, opts)).toEqual({
      ok: true,
      value: toRef({ bucket: 'update-images', path: `projects/${PID}/updates/a.jpg` }),
    });
  });

  it('rejects other buckets and other projects', () => {
    expect(normalizeProjectRef('sb://quotations/quotation/sent/Q1.pdf', opts).ok).toBe(false);
    expect(normalizeProjectRef(`sb://project-files/projects/${OTHER}/x.pdf`, opts).ok).toBe(false);
    expect(normalizeProjectRef(`sb://project-files/projects/${PID}x/x.pdf`, opts).ok).toBe(false);
  });

  it('rejects traversal inside an otherwise valid ref', () => {
    expect(normalizeProjectRef(`sb://project-files/projects/${PID}/../${OTHER}/x.pdf`, opts).ok).toBe(false);
  });

  it('keeps external http(s) URLs (never signed) and rejects other schemes', () => {
    const legacy = 'https://firebasestorage.googleapis.com/v0/b/app/o/a.jpg?alt=media';
    expect(normalizeProjectRef(legacy, opts)).toEqual({ ok: true, value: legacy });
    expect(normalizeProjectRef('javascript:alert(1)', opts).ok).toBe(false);
    expect(normalizeProjectRef('sb://nope', opts).ok).toBe(false);
    expect(normalizeProjectRef('  ', opts).ok).toBe(false);
  });
});

describe('public storage URL', () => {
  it('accepts signed URLs from either the public or internal address', () => {
    const viaPublic = `${PUBLIC}/storage/v1/object/sign/update-images/projects/${PID}/a.jpg?token=t`;
    expect(normalizeProjectRef(viaPublic, opts)).toEqual({ ok: true, value: `sb://update-images/projects/${PID}/a.jpg` });
  });

  it('rewrites internal-host URLs to the public address', () => {
    const internal = 'http://kong:8000/storage/v1/object/sign/designs/p/a.pdf?token=t';
    expect(publicizeStorageUrl(internal, 'http://kong:8000', PUBLIC)).toBe(
      `${PUBLIC}/storage/v1/object/sign/designs/p/a.pdf?token=t`,
    );
    expect(publicizeStorageUrl(internal, 'http://kong:8000/', undefined)).toBe(internal);
    expect(publicizeStorageUrl('https://elsewhere/x', 'http://kong:8000', PUBLIC)).toBe('https://elsewhere/x');
  });
});
