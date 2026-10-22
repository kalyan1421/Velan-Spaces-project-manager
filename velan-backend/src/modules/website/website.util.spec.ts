import {
  buildLeadRow,
  buildPortfolioPatch,
  isAllowedPortfolioUrl,
  cleanMultiLine,
  cleanSingleLine,
  invalidImageUrls,
  isHoneypotTripped,
  MAX_SLUG_LENGTH,
  normalizePhone,
  normalizeSupabaseBase,
  parseCategory,
  PortfolioRow,
  portfolioPublicPrefix,
  sanitizeFileName,
  slugify,
  SLUG_RE,
  toPortfolioDto,
  toPublicPortfolioDto,
  uniqueSlug,
} from './website.util';

const SB = 'https://abc.supabase.co';
const PREFIX = `${SB}/storage/v1/object/public/portfolio/`;

describe('slugify', () => {
  it.each([
    ['Modern Villa in Chennai', 'modern-villa-in-chennai'],
    ['  lots   of\twhitespace\n ', 'lots-of-whitespace'],
    ['Café Résidence', 'cafe-residence'],
    ['Kitchen & Dining', 'kitchen-and-dining'],
    ['🏠 Villa ✨ 2024 🎉', 'villa-2024'],
    ['--Already--dashed--', 'already-dashed'],
    ['UPPER_case.Title', 'upper-case-title'],
    ['ﬁne ligature', 'fine-ligature'],
  ])('%j -> %j', (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it('returns an empty string when nothing slug-safe remains (emoji / non-latin only)', () => {
    expect(slugify('🏠🎉')).toBe('');
    expect(slugify('வீடு')).toBe('');
    expect(slugify('   ')).toBe('');
  });

  it('caps the length and never ends with a dash', () => {
    const s = slugify('word '.repeat(60));
    expect(s.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(s.endsWith('-')).toBe(false);
    expect(SLUG_RE.test(s)).toBe(true);
  });

  it('always produces a value matching the DB slug check (or empty)', () => {
    for (const input of ['a', 'A-B', ' x__y ', 'Ünïcödé façade', '1990s loft']) {
      const s = slugify(input);
      expect(s === '' || SLUG_RE.test(s)).toBe(true);
    }
  });
});

describe('uniqueSlug', () => {
  it('keeps the base when it is free', () => {
    expect(uniqueSlug('villa', [])).toBe('villa');
    expect(uniqueSlug('villa', ['villa-2'])).toBe('villa');
  });

  it('appends -2, -3 … until free', () => {
    expect(uniqueSlug('villa', ['villa'])).toBe('villa-2');
    expect(uniqueSlug('villa', ['villa', 'villa-2', 'villa-3'])).toBe('villa-4');
  });

  it('trims a long base so the suffixed slug stays within the max length', () => {
    const base = 'a'.repeat(MAX_SLUG_LENGTH);
    const s = uniqueSlug(base, [base]);
    expect(s.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH);
    expect(s.endsWith('-2')).toBe(true);
    expect(SLUG_RE.test(s)).toBe(true);
  });

  it('does not leave a dangling dash when trimming lands on one', () => {
    const base = `${'a'.repeat(MAX_SLUG_LENGTH - 3)}-bb`;
    const s = uniqueSlug(base, [base]);
    expect(SLUG_RE.test(s)).toBe(true);
  });
});

describe('normalizePhone', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['98765-43210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['+91-98765-43210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['0091 98765 43210', '+919876543210'],
    ['(+91) 98765.43210', '+919876543210'],
    ['6000000000', '+916000000000'],
    ['9198765432', '+919198765432'],
    ['+1 (555) 123-4567', '+15551234567'],
    ['+44 20 7946 0958', '+442079460958'],
    ['+971 50 123 4567', '+971501234567'],
  ])('accepts %j as %j', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  it.each([
    ['', 'empty'],
    ['12345', 'too short'],
    ['5551234567', '10 digits not starting 6-9 without +'],
    ['+91 12345 67890', '+91 but not a mobile'],
    ['+91 98765', '+91 too short'],
    ['+1234567', 'international, 7 digits'],
    ['+1234567890123456', 'international, 16 digits'],
    ['+0123456789', 'country code cannot start with 0'],
    ['98765abc10', 'letters'],
    ['+91 98765 432101', 'mobile with an extra digit'],
    ['phone', 'text'],
  ])('rejects %j (%s)', (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });

  it('rejects non-strings', () => {
    expect(normalizePhone(undefined as unknown as string)).toBeNull();
    expect(normalizePhone(9876543210 as unknown as string)).toBeNull();
  });
});

describe('sanitizeFileName', () => {
  it('lowercases and keeps a matching extension', () => {
    expect(sanitizeFileName('Living Room.JPG', 'image/jpeg')).toBe('living-room.jpg');
    expect(sanitizeFileName('photo.jpeg', 'image/jpeg')).toBe('photo.jpeg');
    expect(sanitizeFileName('a.webp', 'image/webp')).toBe('a.webp');
    expect(sanitizeFileName('a.avif', 'image/avif')).toBe('a.avif');
  });

  it('replaces a mismatched / missing extension with the content type one', () => {
    expect(sanitizeFileName('evil.html', 'image/png')).toBe('evil.png');
    expect(sanitizeFileName('noext', 'image/webp')).toBe('noext.webp');
    expect(sanitizeFileName('shell.php.jpg', 'image/png')).toBe('shell.php.png');
  });

  it('strips directories, traversal, unicode and unsafe characters', () => {
    expect(sanitizeFileName('../../etc/passwd', 'image/png')).toBe('passwd.png');
    expect(sanitizeFileName('C:\\Users\\me\\Pic 1.png', 'image/png')).toBe('pic-1.png');
    expect(sanitizeFileName('Résidence  façade!!.png', 'image/png')).toBe('residence-facade.png');
    expect(sanitizeFileName('a---b___c.png', 'image/png')).toBe('a-b-c.png');
    expect(sanitizeFileName('..hidden..name.png', 'image/png')).toBe('hidden.name.png');
  });

  it('falls back to "image" when nothing safe remains', () => {
    expect(sanitizeFileName('🏠🎉.png', 'image/png')).toBe('image.png');
    expect(sanitizeFileName('.png', 'image/png')).toBe('image.png');
    expect(sanitizeFileName('', 'image/jpeg')).toBe('image.jpg');
  });

  it('caps the base name length', () => {
    const name = sanitizeFileName(`${'x'.repeat(500)}.png`, 'image/png')!;
    expect(name.length).toBeLessThanOrEqual(85);
    expect(name.endsWith('.png')).toBe(true);
  });

  it('only produces [a-z0-9.-]', () => {
    const name = sanitizeFileName('Ä b/c\u0000d<e>.JPG', 'image/jpeg')!;
    expect(name).toMatch(/^[a-z0-9.-]+$/);
  });

  it('rejects content types outside the image allow-list', () => {
    expect(sanitizeFileName('a.svg', 'image/svg+xml')).toBeNull();
    expect(sanitizeFileName('a.gif', 'image/gif')).toBeNull();
    expect(sanitizeFileName('a.pdf', 'application/pdf')).toBeNull();
  });
});

describe('isAllowedPortfolioUrl', () => {
  it('builds the bucket prefix without a double slash', () => {
    expect(portfolioPublicPrefix(`${SB}/`)).toBe(PREFIX);
    expect(portfolioPublicPrefix(SB)).toBe(PREFIX);
  });

  it('normalises the configured URL like supabase-js does (host case)', () => {
    expect(portfolioPublicPrefix('https://ABC.supabase.co')).toBe(PREFIX);
    expect(isAllowedPortfolioUrl(`${PREFIX}items/x/a.jpg`, 'https://ABC.supabase.co/')).toBe(true);
  });

  it('accepts public URLs inside our portfolio bucket', () => {
    expect(isAllowedPortfolioUrl(`${PREFIX}items/1b2c/living.jpg`, SB)).toBe(true);
    expect(isAllowedPortfolioUrl(`${PREFIX}items/1b2c/living.jpg`, `${SB}/`)).toBe(true);
    expect(
      isAllowedPortfolioUrl(
        'http://127.0.0.1:54321/storage/v1/object/public/portfolio/items/x/a.png',
        'http://127.0.0.1:54321',
      ),
    ).toBe(true);
  });

  it.each([
    ['other host', 'https://evil.example.com/storage/v1/object/public/portfolio/a.jpg'],
    ['host suffix trick', 'https://abc.supabase.co.evil.com/storage/v1/object/public/portfolio/a.jpg'],
    ['other bucket', `${SB}/storage/v1/object/public/avatars/a.jpg`],
    ['signed (not public) URL', `${SB}/storage/v1/object/sign/portfolio/a.jpg?token=x`],
    ['bucket name prefix trick', `${SB}/storage/v1/object/public/portfolio-private/a.jpg`],
    ['no object path', PREFIX],
    ['traversal', `${PREFIX}items/../../avatars/a.jpg`],
    ['encoded traversal', `${PREFIX}items/%2e%2e/a.jpg`],
    ['empty segment', `${PREFIX}items//a.jpg`],
    ['query string', `${PREFIX}items/a.jpg?download=1`],
    ['fragment', `${PREFIX}items/a.jpg#x`],
    ['malformed encoding', `${PREFIX}items/%E0%A4%A.jpg`],
    ['too long', `${PREFIX}${'a'.repeat(2100)}.jpg`],
    ['script URL', 'javascript:alert(1)'],
    ['empty', ''],
  ])('rejects: %s', (_label, url) => {
    expect(isAllowedPortfolioUrl(url, SB)).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isAllowedPortfolioUrl(null, SB)).toBe(false);
    expect(isAllowedPortfolioUrl(42, SB)).toBe(false);
  });

  describe('with SUPABASE_URL + SUPABASE_PUBLIC_URL', () => {
    const INTERNAL = 'http://kong:8000';
    const PUBLIC = 'https://supabase.example.com/';
    const BASES = [PUBLIC, INTERNAL];

    it('accepts public URLs under either prefix', () => {
      expect(
        isAllowedPortfolioUrl(
          'https://supabase.example.com/storage/v1/object/public/portfolio/items/x/a.jpg',
          BASES,
        ),
      ).toBe(true);
      expect(
        isAllowedPortfolioUrl('http://kong:8000/storage/v1/object/public/portfolio/items/x/a.jpg', BASES),
      ).toBe(true);
    });

    it('ignores unset bases (SUPABASE_PUBLIC_URL not configured)', () => {
      expect(isAllowedPortfolioUrl(`${PREFIX}items/x/a.jpg`, [undefined, SB, null, ''])).toBe(true);
      expect(isAllowedPortfolioUrl(`${PREFIX}items/x/a.jpg`, [undefined, ''])).toBe(false);
      expect(isAllowedPortfolioUrl('/storage/v1/object/public/portfolio/items/x/a.jpg', [''])).toBe(false);
    });

    it.each([
      ['other host', 'https://evil.example.com/storage/v1/object/public/portfolio/a.jpg'],
      ['host suffix trick', 'https://supabase.example.com.evil.com/storage/v1/object/public/portfolio/a.jpg'],
      ['other bucket on the public host', 'https://supabase.example.com/storage/v1/object/public/avatars/a.jpg'],
      ['signed URL on the public host', 'https://supabase.example.com/storage/v1/object/sign/portfolio/a.jpg?token=x'],
      ['traversal on the internal host', 'http://kong:8000/storage/v1/object/public/portfolio/items/../../x.jpg'],
      ['query on the public host', 'https://supabase.example.com/storage/v1/object/public/portfolio/a.jpg?x=1'],
    ])('still rejects: %s', (_label, url) => {
      expect(isAllowedPortfolioUrl(url, BASES)).toBe(false);
    });
  });
});

describe('normalizeSupabaseBase', () => {
  it.each([
    ['https://ABC.supabase.co/', 'https://abc.supabase.co'],
    ['https://abc.supabase.co:443', 'https://abc.supabase.co'],
    ['http://kong:8000', 'http://kong:8000'],
    ['  http://127.0.0.1:54321//  ', 'http://127.0.0.1:54321'],
    ['not a url/', 'not a url'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeSupabaseBase(input)).toBe(expected);
  });
});

describe('invalidImageUrls', () => {
  const bases = ['https://supabase.example.com', 'http://kong:8000'];
  const ok = (base: string) => `${base}/storage/v1/object/public/portfolio/items/x/a.jpg`;

  it('returns only the URLs outside every configured prefix', () => {
    const bad = 'https://evil.example.com/a.jpg';
    expect(
      invalidImageUrls({ coverImageUrl: ok(bases[0]), imageUrls: [ok(bases[1]), bad] }, bases),
    ).toEqual([bad]);
  });

  it('still accepts a single SUPABASE_URL string', () => {
    expect(invalidImageUrls({ coverImageUrl: `${PREFIX}items/a.jpg` }, SB)).toEqual([]);
    expect(invalidImageUrls({ coverImageUrl: null, imageUrls: [] }, SB)).toEqual([]);
  });
});

describe('parseCategory', () => {
  it('returns undefined when absent', () => {
    expect(parseCategory(undefined)).toBeUndefined();
    expect(parseCategory('')).toBeUndefined();
  });

  it('accepts known categories case-insensitively', () => {
    expect(parseCategory('kitchen')).toBe('kitchen');
    expect(parseCategory('Office')).toBe('office');
  });

  it('returns null for unknown values (caller answers 400)', () => {
    expect(parseCategory('villa')).toBeNull();
    expect(parseCategory(['kitchen', 'office'])).toBeNull();
  });
});

describe('cleanSingleLine / cleanMultiLine', () => {
  it('single-line: trims, collapses whitespace/newlines and drops control chars', () => {
    expect(cleanSingleLine('  Asha \n\t Raman\u0000 ')).toBe('Asha Raman');
    expect(cleanSingleLine('a\u200bb')).toBe('ab');
  });

  it('multi-line: keeps line breaks, normalises CRLF, drops other control chars', () => {
    expect(cleanMultiLine('  line 1\r\nline 2\u0007 \n\n\n\nline 3  ')).toBe(
      'line 1\nline 2\n\nline 3',
    );
  });

  it('leaves non-strings untouched (the validator rejects them)', () => {
    expect(cleanSingleLine(42)).toBe(42);
    expect(cleanMultiLine(null)).toBeNull();
  });
});

describe('isHoneypotTripped', () => {
  it('is false for missing / empty / whitespace values', () => {
    expect(isHoneypotTripped(undefined)).toBe(false);
    expect(isHoneypotTripped(null)).toBe(false);
    expect(isHoneypotTripped('')).toBe(false);
    expect(isHoneypotTripped('   ')).toBe(false);
  });

  it('is true for any filled value', () => {
    expect(isHoneypotTripped('ACME Corp')).toBe(true);
    expect(isHoneypotTripped(1)).toBe(true);
  });
});

describe('buildLeadRow', () => {
  it('maps an enquiry onto the leads columns with website source and new status', () => {
    expect(
      buildLeadRow({
        name: 'Asha',
        phone: '+919876543210',
        location: 'Adyar, Chennai',
        projectType: 'Residential',
        budgetRange: '10-20 L',
        message: 'Full 3BHK interior',
      }),
    ).toEqual({
      client_name: 'Asha',
      client_phone: '+919876543210',
      area: 'Adyar, Chennai',
      project_type: 'Residential',
      estimated_budget: '10-20 L',
      notes: 'Full 3BHK interior',
      source: 'website',
      status: 'new',
    });
  });

  it('appends the email to the notes on a new line', () => {
    const row = buildLeadRow({
      name: 'Asha',
      phone: '+919876543210',
      email: 'asha@example.com',
      message: 'Call after 6pm',
    });
    expect(row.notes).toBe('Call after 6pm\nEmail: asha@example.com');
  });

  it('stores just the email line when there is no message', () => {
    const row = buildLeadRow({ name: 'Asha', phone: '+919876543210', email: 'a@b.co' });
    expect(row.notes).toBe('Email: a@b.co');
  });

  it('uses null for every missing optional field', () => {
    expect(buildLeadRow({ name: 'Asha', phone: '+919876543210' })).toEqual({
      client_name: 'Asha',
      client_phone: '+919876543210',
      area: null,
      project_type: null,
      estimated_budget: null,
      notes: null,
      source: 'website',
      status: 'new',
    });
  });

  it('never copies the honeypot field into the lead', () => {
    const row = buildLeadRow({ name: 'A', phone: '+919876543210', company: 'x' } as never);
    expect(JSON.stringify(row)).not.toContain('company');
  });
});

const ROW: PortfolioRow = {
  id: '6f1c2f5e-3c1b-4d55-9a31-0d9f1f0b7a11',
  slug: 'modern-villa',
  title: 'Modern Villa',
  description: 'Open plan living',
  category: 'residential',
  location: 'Chennai',
  completion_year: 2024,
  cover_image_url: `${PREFIX}items/a/cover.jpg`,
  image_urls: [`${PREFIX}items/a/1.jpg`],
  status: 'published',
  sort_order: 3,
  project_id: '0d9f1f0b-7a11-4d55-9a31-6f1c2f5e3c1b',
  created_at: '2026-10-14T10:00:00+00:00',
  updated_at: '2026-10-14T11:00:00+00:00',
  // Columns that must never reach any response:
  created_by: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  legacy_firestore_id: 'legacy-1',
};

describe('portfolio mappers', () => {
  it('toPortfolioDto returns the full camelCase contract and nothing else', () => {
    expect(toPortfolioDto(ROW)).toEqual({
      id: ROW.id,
      slug: 'modern-villa',
      title: 'Modern Villa',
      description: 'Open plan living',
      category: 'residential',
      location: 'Chennai',
      completionYear: 2024,
      coverImageUrl: ROW.cover_image_url,
      imageUrls: ROW.image_urls,
      status: 'published',
      sortOrder: 3,
      projectId: ROW.project_id,
      createdAt: ROW.created_at,
      updatedAt: ROW.updated_at,
    });
  });

  it('toPublicPortfolioDto hides status, projectId and internal columns', () => {
    const dto = toPublicPortfolioDto(ROW);
    expect(dto).not.toHaveProperty('status');
    expect(dto).not.toHaveProperty('projectId');
    expect(dto).not.toHaveProperty('project_id');
    expect(dto).not.toHaveProperty('createdBy');
    expect(dto).not.toHaveProperty('created_by');
    expect(dto).not.toHaveProperty('legacyFirestoreId');
    expect(Object.keys(dto).sort()).toEqual(
      [
        'id', 'slug', 'title', 'description', 'category', 'location', 'completionYear',
        'coverImageUrl', 'imageUrls', 'sortOrder', 'createdAt', 'updatedAt',
      ].sort(),
    );
  });

  it('normalises nullable columns', () => {
    const dto = toPortfolioDto({
      ...ROW,
      description: undefined,
      location: undefined,
      completion_year: null,
      cover_image_url: null,
      image_urls: null,
      project_id: undefined,
    } as unknown as PortfolioRow);
    expect(dto.description).toBeNull();
    expect(dto.location).toBeNull();
    expect(dto.completionYear).toBeNull();
    expect(dto.coverImageUrl).toBeNull();
    expect(dto.imageUrls).toEqual([]);
    expect(dto.projectId).toBeNull();
  });
});

describe('buildPortfolioPatch', () => {
  it('includes only provided fields, in snake_case', () => {
    expect(buildPortfolioPatch({ title: 'New', sortOrder: 2 })).toEqual({
      title: 'New',
      sort_order: 2,
    });
  });

  it('passes explicit nulls through so nullable fields can be cleared', () => {
    expect(
      buildPortfolioPatch({
        description: null,
        location: null,
        completionYear: null,
        coverImageUrl: null,
        projectId: null,
      }),
    ).toEqual({
      description: null,
      location: null,
      completion_year: null,
      cover_image_url: null,
      project_id: null,
    });
  });

  it('returns an empty object for an empty body', () => {
    expect(buildPortfolioPatch({})).toEqual({});
  });
});
