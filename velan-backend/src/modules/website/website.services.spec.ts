import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { EnquiriesService } from './enquiries.service';
import { isAllowedPortfolioUrl, SLUG_RE } from './website.util';

// ============================================================================
// In-memory fake of the parts of supabase-js the website module uses.
// Filters/ordering/constraints are evaluated for real so tests assert on state.
// ============================================================================
type Row = Record<string, any>;
interface DbError {
  code: string;
  message: string;
}
interface Result {
  data: any;
  error: DbError | null;
}

const SB = 'https://abc.supabase.co';
const PUBLIC_PREFIX = `${SB}/storage/v1/object/public/portfolio/`;

let clock = Date.parse('2026-10-01T00:00:00Z');
const tick = () => new Date((clock += 1000)).toISOString();

function project(row: Row, columns: string): Row {
  if (columns.trim() === '*') return { ...row };
  const out: Row = {};
  for (const c of columns.split(',').map((s) => s.trim())) out[c] = row[c];
  return out;
}

class FakeDb {
  tables: Record<string, Row[]> = {};
  rpcCalls: { fn: string; args: any }[] = [];
  signedPaths: string[] = [];
  signError: DbError | null = null;
  private injected: { table: string; mode: string; error: DbError }[] = [];

  /** Make the next `mode` operation on `table` fail once with `error`. */
  failNext(table: string, mode: string, error: DbError) {
    this.injected.push({ table, mode, error });
  }
  takeInjected(table: string, mode: string): DbError | null {
    const i = this.injected.findIndex((x) => x.table === table && x.mode === mode);
    if (i === -1) return null;
    return this.injected.splice(i, 1)[0].error;
  }

  rows(table: string): Row[] {
    return (this.tables[table] ??= []);
  }

  withDefaults(table: string, input: Row): Row {
    const now = tick();
    if (table === 'portfolio_items') {
      return {
        id: randomUUID(),
        description: null,
        category: 'residential',
        location: null,
        completion_year: null,
        cover_image_url: null,
        image_urls: [],
        status: 'draft',
        sort_order: 0,
        project_id: null,
        created_by: null,
        created_at: now,
        updated_at: now,
        legacy_firestore_id: null,
        ...input,
      };
    }
    return { id: randomUUID(), created_at: now, ...input };
  }

  /** Mirrors the table's UNIQUE / FK / CHECK constraints. */
  violation(table: string, row: Row, selfId?: string): DbError | null {
    if (table !== 'portfolio_items') return null;
    if (this.rows(table).some((r) => r.id !== selfId && r.slug === row.slug)) {
      return { code: '23505', message: 'duplicate key value violates unique constraint "portfolio_items_slug_key"' };
    }
    if (row.project_id && !this.rows('projects').some((p) => p.id === row.project_id)) {
      return { code: '23503', message: 'insert or update violates foreign key constraint' };
    }
    if (!SLUG_RE.test(row.slug)) return { code: '23514', message: 'violates check constraint' };
    return null;
  }

  client = {
    from: (table: string) => new FakeQuery(this, table),
    rpc: async (fn: string, args: any): Promise<Result> => {
      this.rpcCalls.push({ fn, args });
      if (fn !== 'portfolio_reorder') return { data: null, error: { code: 'PGRST202', message: 'no fn' } };
      const ids: string[] = args.p_ids;
      const rows = this.rows('portfolio_items');
      const found = ids.map((id) => rows.find((r) => r.id === id));
      if (found.some((r) => !r) || new Set(ids).size !== ids.length) {
        return { data: null, error: { code: 'P0002', message: 'portfolio_reorder: unknown id' } };
      }
      found.forEach((r, i) => Object.assign(r!, { sort_order: i, updated_at: tick() }));
      return { data: ids.length, error: null };
    },
    storage: {
      from: (bucket: string) => ({
        createSignedUploadUrl: async (path: string) => {
          if (this.signError) return { data: null, error: this.signError };
          this.signedPaths.push(`${bucket}/${path}`);
          return {
            data: {
              signedUrl: `${SB}/storage/v1/object/upload/sign/${bucket}/${path}?token=tok-1`,
              token: 'tok-1',
              path,
            },
            error: null,
          };
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `${SB}/storage/v1/object/public/${bucket}/${path}` },
        }),
      }),
    },
  };

  admin() {
    return this.client;
  }
}

class FakeQuery implements PromiseLike<Result> {
  private filters: ((r: Row) => boolean)[] = [];
  private orders: [string, boolean][] = [];
  private max?: number;
  private mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any;
  private columns = '*';
  private returning = false;
  private cardinality: 'many' | 'single' | 'maybe' = 'many';

  constructor(
    private readonly db: FakeDb,
    private readonly table: string,
  ) {}

  select(columns = '*') {
    this.columns = columns;
    if (this.mode !== 'select') this.returning = true;
    return this;
  }
  insert(v: any) {
    this.mode = 'insert';
    this.payload = v;
    return this;
  }
  update(v: any) {
    this.mode = 'update';
    this.payload = v;
    return this;
  }
  delete() {
    this.mode = 'delete';
    return this;
  }
  eq(c: string, v: unknown) {
    this.filters.push((r) => r[c] === v);
    return this;
  }
  like(c: string, pattern: string) {
    const prefix = pattern.replace(/%$/, '');
    this.filters.push((r) => typeof r[c] === 'string' && r[c].startsWith(prefix));
    return this;
  }
  in(c: string, values: unknown[]) {
    this.filters.push((r) => values.includes(r[c]));
    return this;
  }
  order(c: string, opts: { ascending: boolean }) {
    this.orders.push([c, opts.ascending]);
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  single() {
    this.cardinality = 'single';
    return this;
  }
  maybeSingle() {
    this.cardinality = 'maybe';
    return this;
  }

  then<T1 = Result, T2 = never>(
    onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
    onrejected?: ((reason: any) => T2 | PromiseLike<T2>) | null,
  ): PromiseLike<T1 | T2> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onfulfilled, onrejected);
  }

  private match = (r: Row) => this.filters.every((f) => f(r));

  private execute(): Result {
    const injected = this.db.takeInjected(this.table, this.mode);
    if (injected) return { data: null, error: injected };
    const rows = this.db.rows(this.table);
    let out: Row[];

    if (this.mode === 'insert') {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      out = [];
      for (const item of items) {
        const row = this.db.withDefaults(this.table, item);
        const err = this.db.violation(this.table, row);
        if (err) return { data: null, error: err };
        rows.push(row);
        out.push(row);
      }
    } else if (this.mode === 'update') {
      out = rows.filter(this.match);
      for (const r of out) {
        const err = this.db.violation(this.table, { ...r, ...this.payload }, r.id);
        if (err) return { data: null, error: err };
      }
      for (const r of out) Object.assign(r, this.payload, { updated_at: tick() });
    } else if (this.mode === 'delete') {
      out = rows.filter(this.match);
      this.db.tables[this.table] = rows.filter((r) => !out.includes(r));
    } else {
      out = rows.filter(this.match);
      out.sort((a, b) => {
        for (const [c, asc] of this.orders) {
          if (a[c] < b[c]) return asc ? -1 : 1;
          if (a[c] > b[c]) return asc ? 1 : -1;
        }
        return 0;
      });
      if (this.max !== undefined) out = out.slice(0, this.max);
    }

    if (this.mode !== 'select' && !this.returning) return { data: null, error: null };
    const data = out.map((r) => project(r, this.columns));
    if (this.cardinality === 'single') {
      return data.length === 1
        ? { data: data[0], error: null }
        : { data: null, error: { code: 'PGRST116', message: 'not exactly one row' } };
    }
    if (this.cardinality === 'maybe') {
      return data.length <= 1
        ? { data: data[0] ?? null, error: null }
        : { data: null, error: { code: 'PGRST116', message: 'multiple rows' } };
    }
    return { data, error: null };
  }
}

const config = { get: (key: string) => (key === 'SUPABASE_URL' ? SB : undefined) };
const HEAD_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

function seedItem(db: FakeDb, over: Row): Row {
  const row = db.withDefaults('portfolio_items', { title: 'Item', slug: `item-${randomUUID().slice(0, 8)}`, ...over });
  db.rows('portfolio_items').push(row);
  return row;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

// Expected warn/debug lines (failed pushes, honeypot) would only add noise here.
beforeAll(() => Logger.overrideLogger(false));

// ============================================================================
describe('PortfolioService', () => {
  let db: FakeDb;
  let svc: PortfolioService;

  beforeEach(() => {
    db = new FakeDb();
    svc = new PortfolioService(db as never, config as never);
  });

  describe('listPublic', () => {
    beforeEach(() => {
      seedItem(db, { slug: 'a-older-sort-1', status: 'published', sort_order: 1, category: 'kitchen' });
      seedItem(db, { slug: 'b-sort-0', status: 'published', sort_order: 0 });
      seedItem(db, { slug: 'c-newer-sort-1', status: 'published', sort_order: 1, category: 'kitchen' });
      seedItem(db, { slug: 'd-draft', status: 'draft', sort_order: 0, category: 'kitchen' });
      seedItem(db, { slug: 'e-hidden', status: 'hidden', sort_order: 0 });
    });

    it('returns only published items, sortOrder asc then newest first', async () => {
      const items = await svc.listPublic();
      expect(items.map((i) => i.slug)).toEqual(['b-sort-0', 'c-newer-sort-1', 'a-older-sort-1']);
    });

    it('never exposes status, projectId or internal columns', async () => {
      const [item] = await svc.listPublic();
      for (const key of ['status', 'projectId', 'createdBy', 'legacyFirestoreId', 'created_by']) {
        expect(item).not.toHaveProperty(key);
      }
    });

    it('filters by category', async () => {
      const items = await svc.listPublic('kitchen');
      expect(items.map((i) => i.slug)).toEqual(['c-newer-sort-1', 'a-older-sort-1']);
    });

    it('surfaces database errors as plain errors (sanitised to 500 by the global filter)', async () => {
      db.failNext('portfolio_items', 'select', { code: 'XX000', message: 'boom' });
      await expect(svc.listPublic()).rejects.toThrow(Error);
    });
  });

  describe('getPublicBySlug', () => {
    it('returns a published item', async () => {
      seedItem(db, { slug: 'modern-villa', status: 'published', title: 'Modern Villa' });
      const item = await svc.getPublicBySlug('modern-villa');
      expect(item.title).toBe('Modern Villa');
      expect(item).not.toHaveProperty('status');
    });

    it.each(['draft', 'hidden'])('404s for %s items', async (status) => {
      seedItem(db, { slug: 'secret', status });
      await expect(svc.getPublicBySlug('secret')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s for unknown and malformed slugs', async () => {
      await expect(svc.getPublicBySlug('nope')).rejects.toBeInstanceOf(NotFoundException);
      await expect(svc.getPublicBySlug('../etc')).rejects.toBeInstanceOf(NotFoundException);
      await expect(svc.getPublicBySlug('x'.repeat(500))).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listAll', () => {
    it('includes every status with the admin fields, same ordering', async () => {
      seedItem(db, { slug: 'p', status: 'published', sort_order: 1 });
      seedItem(db, { slug: 'd', status: 'draft', sort_order: 0 });
      seedItem(db, { slug: 'h', status: 'hidden', sort_order: 2 });
      const items = await svc.listAll();
      expect(items.map((i) => [i.slug, i.status])).toEqual([
        ['d', 'draft'],
        ['p', 'published'],
        ['h', 'hidden'],
      ]);
      expect(items[0]).toHaveProperty('projectId', null);
      expect(items[0]).not.toHaveProperty('createdBy');
    });
  });

  describe('create', () => {
    it('generates the slug from the title and applies defaults', async () => {
      const item = await svc.create(HEAD_ID, { title: 'Modern Villa, Adyar' });
      expect(item).toMatchObject({
        slug: 'modern-villa-adyar',
        title: 'Modern Villa, Adyar',
        category: 'residential',
        status: 'draft',
        imageUrls: [],
        sortOrder: 0,
        projectId: null,
      });
      expect(db.rows('portfolio_items')[0].created_by).toBe(HEAD_ID);
      expect(item).not.toHaveProperty('createdBy');
    });

    it('adds -2, -3 … when the generated slug is taken', async () => {
      seedItem(db, { slug: 'modern-villa' });
      seedItem(db, { slug: 'modern-villa-2' });
      const item = await svc.create(HEAD_ID, { title: 'Modern Villa' });
      expect(item.slug).toBe('modern-villa-3');
    });

    it('falls back to "project" for titles with no slug-safe characters', async () => {
      expect((await svc.create(HEAD_ID, { title: '🏠🎉' })).slug).toBe('project');
      expect((await svc.create(HEAD_ID, { title: 'வீடு' })).slug).toBe('project-2');
    });

    it('uses an explicit free slug and 409s on a taken one', async () => {
      expect((await svc.create(HEAD_ID, { title: 'X', slug: 'custom-slug' })).slug).toBe('custom-slug');
      await expect(svc.create(HEAD_ID, { title: 'Y', slug: 'custom-slug' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('retries when a concurrent insert grabs the generated slug', async () => {
      db.failNext('portfolio_items', 'insert', { code: '23505', message: 'duplicate key' });
      const item = await svc.create(HEAD_ID, { title: 'Race' });
      expect(item.slug).toBe('race');
      expect(db.rows('portfolio_items')).toHaveLength(1);
    });

    it('stores portfolio-bucket image URLs', async () => {
      const cover = `${PUBLIC_PREFIX}items/1/cover.jpg`;
      const gallery = [`${PUBLIC_PREFIX}items/1/a.jpg`, `${PUBLIC_PREFIX}items/1/b.webp`];
      const item = await svc.create(HEAD_ID, { title: 'Pics', coverImageUrl: cover, imageUrls: gallery });
      expect(item.coverImageUrl).toBe(cover);
      expect(item.imageUrls).toEqual(gallery);
    });

    it('rejects images hosted anywhere else and writes nothing', async () => {
      await expect(
        svc.create(HEAD_ID, { title: 'Bad', coverImageUrl: 'https://evil.example.com/x.jpg' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        svc.create(HEAD_ID, {
          title: 'Bad',
          imageUrls: [`${PUBLIC_PREFIX}items/1/a.jpg`, `${SB}/storage/v1/object/public/avatars/u/a.jpg`],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(db.rows('portfolio_items')).toHaveLength(0);
    });

    it('400s when projectId does not reference a project', async () => {
      await expect(
        svc.create(HEAD_ID, { title: 'Linked', projectId: randomUUID() }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('links an existing project', async () => {
      const projectId = randomUUID();
      db.rows('projects').push({ id: projectId });
      expect((await svc.create(HEAD_ID, { title: 'Linked', projectId })).projectId).toBe(projectId);
    });
  });

  describe('update', () => {
    it('patches only the given fields and keeps the slug when the title changes', async () => {
      const row = seedItem(db, { slug: 'old-title', title: 'Old title', location: 'Chennai', status: 'draft' });
      const item = await svc.update(row.id, { title: 'New title', status: 'published' });
      expect(item).toMatchObject({ slug: 'old-title', title: 'New title', status: 'published', location: 'Chennai' });
    });

    it('clears nullable fields with null', async () => {
      const row = seedItem(db, { description: 'd', location: 'l', completion_year: 2020 });
      const item = await svc.update(row.id, { description: null, location: null, completionYear: null });
      expect(item).toMatchObject({ description: null, location: null, completionYear: null });
    });

    it('returns the current item for an empty patch', async () => {
      const row = seedItem(db, { title: 'Same' });
      expect((await svc.update(row.id, {})).title).toBe('Same');
    });

    it('404s for unknown ids (with and without changes)', async () => {
      await expect(svc.update(randomUUID(), { title: 'x' })).rejects.toBeInstanceOf(NotFoundException);
      await expect(svc.update(randomUUID(), {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409s when the new slug is taken', async () => {
      seedItem(db, { slug: 'taken' });
      const row = seedItem(db, { slug: 'mine' });
      await expect(svc.update(row.id, { slug: 'taken' })).rejects.toBeInstanceOf(ConflictException);
    });

    it('rejects foreign image URLs', async () => {
      const row = seedItem(db, {});
      await expect(
        svc.update(row.id, { imageUrls: ['https://cdn.example.com/a.jpg'] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('deletes once, then 404s', async () => {
      const row = seedItem(db, {});
      expect(await svc.remove(row.id)).toEqual({ ok: true });
      expect(db.rows('portfolio_items')).toHaveLength(0);
      await expect(svc.remove(row.id)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('sets sortOrder to each id’s index and returns the list in that order', async () => {
      const a = seedItem(db, { slug: 'a', sort_order: 0 });
      const b = seedItem(db, { slug: 'b', sort_order: 1 });
      const c = seedItem(db, { slug: 'c', sort_order: 2 });
      const items = await svc.reorder([c.id, a.id, b.id]);
      expect(items.map((i) => [i.slug, i.sortOrder])).toEqual([
        ['c', 0],
        ['a', 1],
        ['b', 2],
      ]);
    });

    it('400s when any id does not exist and changes nothing', async () => {
      const a = seedItem(db, { slug: 'a', sort_order: 5 });
      await expect(svc.reorder([a.id, randomUUID()])).rejects.toBeInstanceOf(BadRequestException);
      expect(db.rows('portfolio_items')[0].sort_order).toBe(5);
    });
  });

  describe('signUpload', () => {
    const dto = { fileName: 'Living Room.JPG', contentType: 'image/jpeg', size: 2048 };

    it('signs items/<uuid>/<safe-name> in the portfolio bucket', async () => {
      const res = await svc.signUpload(dto);
      expect(Object.keys(res).sort()).toEqual(['path', 'publicUrl', 'signedUrl', 'token']);
      expect(res.path).toMatch(/^items\/[0-9a-f-]{36}\/living-room\.jpg$/);
      expect(db.signedPaths).toEqual([`portfolio/${res.path}`]);
      expect(res.token).toBe('tok-1');
      expect(res.signedUrl).toContain(res.path);
    });

    it('returns a public URL that create/patch will accept', async () => {
      const res = await svc.signUpload(dto);
      expect(res.publicUrl).toBe(`${PUBLIC_PREFIX}${res.path}`);
      expect(isAllowedPortfolioUrl(res.publicUrl, SB)).toBe(true);
    });

    it('uses a fresh folder for every upload', async () => {
      const a = await svc.signUpload(dto);
      const b = await svc.signUpload(dto);
      expect(a.path).not.toBe(b.path);
    });

    it('rejects non-image types and oversized files (defence in depth behind the DTO)', async () => {
      await expect(svc.signUpload({ ...dto, contentType: 'image/svg+xml' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(svc.signUpload({ ...dto, size: 11 * 1024 * 1024 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(db.signedPaths).toEqual([]);
    });

    it('400s when storage cannot sign', async () => {
      db.signError = { code: '404', message: 'Bucket not found' };
      await expect(svc.signUpload(dto)).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

// ============================================================================
describe('EnquiriesService', () => {
  let db: FakeDb;
  let notifyUser: jest.Mock;
  let svc: EnquiriesService;

  const enquiry = {
    name: 'Asha Raman',
    phone: '+919876543210',
    email: 'asha@example.com',
    location: 'Adyar',
    projectType: 'Residential',
    budgetRange: '10-20 L',
    message: 'Full 3BHK',
  };

  beforeEach(() => {
    db = new FakeDb();
    db.rows('users').push(
      { id: HEAD_ID, role: 'head', is_suspended: false },
      { id: 'head-2', role: 'head', is_suspended: false },
      { id: 'head-suspended', role: 'head', is_suspended: true },
      { id: 'manager-1', role: 'manager', is_suspended: false },
    );
    notifyUser = jest.fn().mockResolvedValue(undefined);
    svc = new EnquiriesService(db as never, { notifyUser } as never);
  });

  it('stores a website lead and answers only {ok: true}', async () => {
    const res = await svc.submit(enquiry);
    expect(res).toEqual({ ok: true });
    const leads = db.rows('leads');
    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      client_name: 'Asha Raman',
      client_phone: '+919876543210',
      area: 'Adyar',
      project_type: 'Residential',
      estimated_budget: '10-20 L',
      notes: 'Full 3BHK\nEmail: asha@example.com',
      source: 'website',
      status: 'new',
    });
  });

  it('notifies every active head (not managers, not suspended heads)', async () => {
    await svc.submit(enquiry);
    await flush();
    const recipients = notifyUser.mock.calls.map((c) => c[0]).sort();
    expect(recipients).toEqual([HEAD_ID, 'head-2'].sort());
    expect(notifyUser).toHaveBeenCalledWith(HEAD_ID, {
      title: 'New website enquiry',
      body: 'Asha Raman · Residential',
      type: 'lead',
    });
  });

  it('uses "Enquiry" in the notification when no project type was given', async () => {
    await svc.submit({ name: 'Ravi', phone: '+919876543210' });
    await flush();
    expect(notifyUser.mock.calls[0][1].body).toBe('Ravi · Enquiry');
  });

  it('silently drops honeypot submissions', async () => {
    const res = await svc.submit({ ...enquiry, company: 'Spam Inc' });
    await flush();
    expect(res).toEqual({ ok: true });
    expect(db.rows('leads')).toHaveLength(0);
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it('still succeeds when sending a notification fails', async () => {
    notifyUser.mockRejectedValueOnce(new Error('FCM down'));
    await expect(svc.submit(enquiry)).resolves.toEqual({ ok: true });
    await flush();
    expect(db.rows('leads')).toHaveLength(1);
    expect(notifyUser).toHaveBeenCalledTimes(2);
  });

  it('still succeeds when the head lookup fails', async () => {
    db.failNext('users', 'select', { code: 'XX000', message: 'boom' });
    await expect(svc.submit(enquiry)).resolves.toEqual({ ok: true });
    await flush();
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it('fails (500 via the global filter) when the lead cannot be stored, without notifying', async () => {
    db.failNext('leads', 'insert', { code: 'XX000', message: 'db down' });
    await expect(svc.submit(enquiry)).rejects.toThrow(Error);
    await flush();
    expect(notifyUser).not.toHaveBeenCalled();
  });
});
