import { BadRequestException, Logger } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { isAllowedPortfolioUrl } from './website.util';

/**
 * SUPABASE_PUBLIC_URL handling: self-hosted Supabase is reached by the API at
 * an internal address (http://kong:8000) while browsers use a public one.
 * URLs handed to clients must use the public address, and image URLs on
 * either address must be accepted on writes.
 * (The rest of PortfolioService is covered in website.services.spec.ts.)
 */
const INTERNAL = 'http://kong:8000';
const PUBLIC = 'https://supabase.example.com';
const objectPrefix = (base: string) => `${base}/storage/v1/object/public/portfolio/`;

interface Insert {
  table: string;
  row: Record<string, unknown>;
}

/** Just enough of supabase-js: storage URL builders + insert().select().single(). */
function fakeSupabase(clientBase: string) {
  const inserts: Insert[] = [];
  const client = {
    storage: {
      from: (bucket: string) => ({
        createSignedUploadUrl: async (path: string) => ({
          data: {
            signedUrl: `${clientBase}/storage/v1/object/upload/sign/${bucket}/${path}?token=tok-1`,
            token: 'tok-1',
            path,
          },
          error: null,
        }),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `${clientBase}/storage/v1/object/public/${bucket}/${path}` },
        }),
      }),
    },
    from: (table: string) => ({
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            inserts.push({ table, row });
            const now = '2026-10-22T00:00:00.000Z';
            return {
              data: { id: 'p1', sort_order: 0, created_at: now, updated_at: now, ...row },
              error: null,
            };
          },
        }),
      }),
    }),
  };
  return { inserts, admin: () => client };
}

function makeService(env: Record<string, string | undefined>, clientBase = env.SUPABASE_URL!) {
  const db = fakeSupabase(clientBase);
  const config = { get: (key: string) => env[key] };
  return { db, svc: new PortfolioService(db as never, config as never) };
}

const upload = { fileName: 'Living Room.jpg', contentType: 'image/jpeg', size: 2048 };

beforeAll(() => Logger.overrideLogger(false));

describe('PortfolioService public storage URLs', () => {
  describe('with SUPABASE_PUBLIC_URL (self-hosted behind an internal hostname)', () => {
    const env = { SUPABASE_URL: INTERNAL, SUPABASE_PUBLIC_URL: PUBLIC };

    it('signUpload hands out signed + public URLs on the public address', async () => {
      const { svc } = makeService(env);
      const res = await svc.signUpload(upload);
      expect(res.signedUrl.startsWith(`${PUBLIC}/storage/v1/object/upload/sign/portfolio/`)).toBe(true);
      expect(res.signedUrl).toContain('token=tok-1');
      expect(res.publicUrl).toBe(`${objectPrefix(PUBLIC)}${res.path}`);
      expect(res.signedUrl).not.toContain('kong');
      expect(res.publicUrl).not.toContain('kong');
    });

    it('the returned publicUrl passes the allow-list used on create/patch', async () => {
      const { svc } = makeService(env);
      const res = await svc.signUpload(upload);
      expect(isAllowedPortfolioUrl(res.publicUrl, [PUBLIC, INTERNAL])).toBe(true);
    });

    it('create accepts image URLs under either the public or the internal prefix', async () => {
      const { svc, db } = makeService(env);
      const cover = `${objectPrefix(PUBLIC)}items/a/cover.jpg`;
      const legacy = `${objectPrefix(INTERNAL)}items/b/old.jpg`;
      const item = await svc.create('user-1', {
        title: 'Modern Villa',
        slug: 'modern-villa',
        coverImageUrl: cover,
        imageUrls: [cover, legacy],
      });
      expect(item.coverImageUrl).toBe(cover);
      expect(item.imageUrls).toEqual([cover, legacy]);
      expect(db.inserts).toHaveLength(1);
    });

    it('create still rejects other hosts, buckets and signed URLs', async () => {
      const { svc, db } = makeService(env);
      for (const url of [
        'https://evil.example.com/storage/v1/object/public/portfolio/items/a.jpg',
        `${PUBLIC}/storage/v1/object/public/avatars/items/a.jpg`,
        `${PUBLIC}/storage/v1/object/sign/portfolio/items/a.jpg?token=x`,
      ]) {
        await expect(
          svc.create('user-1', { title: 'Villa', slug: 'villa', coverImageUrl: url }),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      expect(db.inserts).toHaveLength(0);
    });
  });

  describe('without SUPABASE_PUBLIC_URL (Supabase Cloud / already public)', () => {
    const SB = 'https://abc.supabase.co';
    const env = { SUPABASE_URL: SB };

    it('signUpload URLs are left as supabase-js built them', async () => {
      const { svc } = makeService(env);
      const res = await svc.signUpload(upload);
      expect(res.signedUrl.startsWith(`${SB}/storage/v1/object/upload/sign/portfolio/`)).toBe(true);
      expect(res.publicUrl).toBe(`${objectPrefix(SB)}${res.path}`);
    });

    it('create accepts only the SUPABASE_URL prefix', async () => {
      const { svc } = makeService(env);
      await expect(
        svc.create('user-1', {
          title: 'Villa',
          slug: 'villa',
          coverImageUrl: `${objectPrefix(PUBLIC)}items/a.jpg`,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      const ok = await svc.create('user-1', {
        title: 'Villa',
        slug: 'villa',
        coverImageUrl: `${objectPrefix(SB)}items/a.jpg`,
      });
      expect(ok.coverImageUrl).toBe(`${objectPrefix(SB)}items/a.jpg`);
    });
  });

  it('normalises configured URLs like supabase-js (host case, trailing slash)', async () => {
    // supabase-js lowercases the host; the env values are written loosely.
    const { svc } = makeService(
      { SUPABASE_URL: 'http://KONG:8000/', SUPABASE_PUBLIC_URL: 'https://Supabase.Example.com/' },
      INTERNAL,
    );
    const res = await svc.signUpload(upload);
    expect(res.publicUrl).toBe(`${objectPrefix(PUBLIC)}${res.path}`);
    expect(res.signedUrl.startsWith(`${PUBLIC}/storage/v1/object/upload/sign/`)).toBe(true);
    const item = await svc.create('user-1', {
      title: 'Villa',
      slug: 'villa',
      coverImageUrl: res.publicUrl,
    });
    expect(item.coverImageUrl).toBe(res.publicUrl);
  });
});
