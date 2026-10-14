/**
 * Pure helpers for the public website module (portfolio + enquiries).
 * No Nest / Supabase imports here so everything is unit-testable in isolation.
 */

// ---------------------------------------------------------------- constants
export const PORTFOLIO_CATEGORIES = [
  'residential',
  'commercial',
  'office',
  'kitchen',
  'other',
] as const;
export type PortfolioCategory = (typeof PORTFOLIO_CATEGORIES)[number];

export const PORTFOLIO_STATUSES = ['draft', 'published', 'hidden'] as const;
export type PortfolioStatus = (typeof PORTFOLIO_STATUSES)[number];

export const PORTFOLIO_BUCKET = 'portfolio';
export const MAX_PORTFOLIO_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_PORTFOLIO_IMAGES = 40;
export const MAX_PORTFOLIO_URL_LENGTH = 2048;
export const MAX_REORDER_IDS = 500;

/** Allowed upload MIME types -> accepted extensions (first = canonical). */
export const PORTFOLIO_IMAGE_TYPES: Readonly<Record<string, readonly string[]>> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/avif': ['avif'],
};
export const PORTFOLIO_CONTENT_TYPES = Object.keys(PORTFOLIO_IMAGE_TYPES);

/** Same rule as the `portfolio_items.slug` CHECK constraint. */
export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_SLUG_LENGTH = 80;
const MAX_FILE_BASE_LENGTH = 80;

/** Public (no status/project) columns, selected explicitly so internal columns never leak. */
export const PUBLIC_PORTFOLIO_COLUMNS =
  'id, slug, title, description, category, location, completion_year, cover_image_url, image_urls, sort_order, created_at, updated_at';
export const PORTFOLIO_COLUMNS = `${PUBLIC_PORTFOLIO_COLUMNS}, status, project_id`;

// ---------------------------------------------------------------- types
export interface PortfolioRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: PortfolioCategory;
  location: string | null;
  completion_year: number | null;
  cover_image_url: string | null;
  image_urls: string[] | null;
  status?: PortfolioStatus;
  sort_order: number;
  project_id?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  legacy_firestore_id?: string | null;
}

export interface PortfolioItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  category: PortfolioCategory;
  location: string | null;
  completionYear: number | null;
  coverImageUrl: string | null;
  imageUrls: string[];
  status: PortfolioStatus;
  sortOrder: number;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PublicPortfolioItem = Omit<PortfolioItem, 'status' | 'projectId'>;

/** Fields accepted on create/patch (already validated by the DTO layer). */
export interface PortfolioWriteInput {
  title?: string;
  slug?: string;
  description?: string | null;
  category?: PortfolioCategory;
  location?: string | null;
  completionYear?: number | null;
  coverImageUrl?: string | null;
  imageUrls?: string[];
  status?: PortfolioStatus;
  sortOrder?: number;
  projectId?: string | null;
}

/** A validated, normalised enquiry (phone already canonical). */
export interface EnquiryInput {
  name: string;
  phone: string;
  email?: string;
  location?: string;
  projectType?: string;
  budgetRange?: string;
  message?: string;
}

export interface LeadInsertRow {
  client_name: string;
  client_phone: string;
  area: string | null;
  project_type: string | null;
  estimated_budget: string | null;
  notes: string | null;
  source: 'website';
  status: 'new';
}

// ---------------------------------------------------------------- slugs
function stripDiacritics(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/**
 * URL slug from free text: ASCII-folds accents, `&` -> `and`, every other run
 * of non `[a-z0-9]` becomes one dash. Returns '' when nothing usable remains
 * (emoji / non-latin titles) so the caller can pick a fallback.
 */
export function slugify(input: string, maxLength = MAX_SLUG_LENGTH): string {
  const s = stripDiacritics(String(input ?? ''))
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (s.length <= maxLength) return s;
  return s.slice(0, maxLength).replace(/-+$/g, '');
}

/** `base`, else `base-2`, `base-3`, … — trimmed so the result fits `maxLength`. */
export function uniqueSlug(
  base: string,
  taken: Iterable<string>,
  maxLength = MAX_SLUG_LENGTH,
): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; n <= used.size + 2; n++) {
    const suffix = `-${n}`;
    const head = base.slice(0, maxLength - suffix.length).replace(/-+$/g, '');
    const candidate = `${head}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
  // Unreachable: the loop has more candidates than `used` has entries.
  throw new Error('Could not derive a unique slug');
}

/**
 * The prefix used to fetch existing slugs that could collide with `base` or its
 * suffixed variants (a long base is trimmed before the `-n` suffix is added).
 * Slugs only contain `[a-z0-9-]`, so they never contain LIKE wildcards.
 */
export function slugSearchPrefix(base: string, maxLength = MAX_SLUG_LENGTH): string {
  return base.slice(0, Math.max(1, maxLength - 8));
}

// ---------------------------------------------------------------- query params
/** undefined = no filter, null = invalid (answer 400), else the category. */
export function parseCategory(value: unknown): PortfolioCategory | undefined | null {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return (PORTFOLIO_CATEGORIES as readonly string[]).includes(v)
    ? (v as PortfolioCategory)
    : null;
}

// ---------------------------------------------------------------- phone
const INDIAN_MOBILE_RE = /^(?:\+91|91|0)?([6-9]\d{9})$/;
const INTERNATIONAL_RE = /^\+[1-9]\d{7,14}$/; // E.164: 8–15 digits

/**
 * Canonical phone for a lead, or null when invalid.
 *  - Indian mobile (10 digits starting 6–9) with optional +91 / 91 / 0 / 0091
 *    prefix -> `+91XXXXXXXXXX`
 *  - other international `+<8–15 digits>` numbers -> kept as-is (digits only)
 *  - a `+91` number that is not a valid mobile is rejected
 * Spaces, dashes, dots and parentheses are ignored.
 */
export function normalizePhone(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw.replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`;

  const mobile = INDIAN_MOBILE_RE.exec(s);
  if (mobile) return `+91${mobile[1]}`;

  if (INTERNATIONAL_RE.test(s) && !s.startsWith('+91')) return s;
  return null;
}

// ---------------------------------------------------------------- uploads
/**
 * Storage-safe file name for a portfolio image: leaf name only, lowercase,
 * `[a-z0-9.-]`, collapsed separators, capped length, and an extension that
 * matches the declared content type. Returns null for disallowed types.
 */
export function sanitizeFileName(fileName: string, contentType: string): string | null {
  const exts = PORTFOLIO_IMAGE_TYPES[contentType];
  if (!exts) return null;

  const leaf = String(fileName ?? '').split(/[\\/]/).pop() ?? '';
  const lower = stripDiacritics(leaf).toLowerCase();
  const dot = lower.lastIndexOf('.');
  const rawBase = dot >= 0 ? lower.slice(0, dot) : lower;
  const rawExt = dot >= 0 ? lower.slice(dot + 1) : '';

  let base = rawBase
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/\.{2,}/g, '.')
    .replace(/-{2,}/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, MAX_FILE_BASE_LENGTH)
    .replace(/[.-]+$/g, '');
  if (!base) base = 'image';

  const ext = exts.includes(rawExt) ? rawExt : exts[0];
  return `${base}.${ext}`;
}

/** `<SUPABASE_URL>/storage/v1/object/public/portfolio/` */
export function portfolioPublicPrefix(supabaseUrl: string): string {
  let base = supabaseUrl;
  try {
    const u = new URL(supabaseUrl);
    base = `${u.origin}${u.pathname}`; // lowercases the host, drops default ports
  } catch {
    // keep the raw value; nothing will match it anyway
  }
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/${PORTFOLIO_BUCKET}/`;
}

/**
 * Only plain public URLs of OUR portfolio bucket may be stored on an item —
 * no other hosts (hot-linking / tracking pixels), buckets, signed URLs,
 * query strings or path tricks.
 */
export function isAllowedPortfolioUrl(value: unknown, supabaseUrl: string): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value.length > MAX_PORTFOLIO_URL_LENGTH) return false;

  const prefix = portfolioPublicPrefix(supabaseUrl);
  if (!value.startsWith(prefix)) return false;
  if (value.includes('?') || value.includes('#')) return false;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

  const rest = value.slice(prefix.length);
  if (!rest) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(rest)) return false;

  let decoded: string;
  try {
    decoded = decodeURIComponent(rest);
  } catch {
    return false;
  }
  return !decoded.split('/').some((seg) => seg === '' || seg === '.' || seg === '..');
}

// ---------------------------------------------------------------- text input
const ZERO_WIDTH_RE = /[​-‍⁠﻿]/g;

/**
 * For single-line public input (names, locations): drops control / zero-width
 * characters and collapses all whitespace (incl. newlines) to single spaces.
 * Non-strings pass through so the validator can reject them.
 */
export function cleanSingleLine(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value
    .replace(ZERO_WIDTH_RE, '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000e-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** For free-text messages: like cleanSingleLine but keeps (at most double) line breaks. */
export function cleanMultiLine(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value
    .replace(ZERO_WIDTH_RE, '')
    .replace(/\r\n?|[\u2028\u2029]/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/\t/g, ' ')
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------- enquiries
/** The hidden `company` field is filled only by bots. */
export function isHoneypotTripped(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
}

/** Enquiry -> `leads` row. Email has no column, so it is appended to the notes. */
export function buildLeadRow(input: EnquiryInput): LeadInsertRow {
  const notes = [input.message, input.email ? `Email: ${input.email}` : undefined]
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .join('\n');
  return {
    client_name: input.name,
    client_phone: input.phone,
    area: input.location ?? null,
    project_type: input.projectType ?? null,
    estimated_budget: input.budgetRange ?? null,
    notes: notes.length > 0 ? notes : null,
    source: 'website',
    status: 'new',
  };
}

// ---------------------------------------------------------------- mappers
/** Explicit row -> API mapper (camelCase; internal columns are never copied). */
export function toPortfolioDto(row: PortfolioRow): PortfolioItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    category: row.category,
    location: row.location ?? null,
    completionYear: row.completion_year ?? null,
    coverImageUrl: row.cover_image_url ?? null,
    imageUrls: row.image_urls ?? [],
    status: row.status ?? 'draft',
    sortOrder: row.sort_order,
    projectId: row.project_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Public mapper: same as above minus `status` and `projectId`. */
export function toPublicPortfolioDto(row: PortfolioRow): PublicPortfolioItem {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description ?? null,
    category: row.category,
    location: row.location ?? null,
    completionYear: row.completion_year ?? null,
    coverImageUrl: row.cover_image_url ?? null,
    imageUrls: row.image_urls ?? [],
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** DTO -> snake_case column patch; only keys present on the input are included. */
export function buildPortfolioPatch(input: PortfolioWriteInput): Record<string, unknown> {
  const map: [keyof PortfolioWriteInput, string][] = [
    ['title', 'title'],
    ['slug', 'slug'],
    ['description', 'description'],
    ['category', 'category'],
    ['location', 'location'],
    ['completionYear', 'completion_year'],
    ['coverImageUrl', 'cover_image_url'],
    ['imageUrls', 'image_urls'],
    ['status', 'status'],
    ['sortOrder', 'sort_order'],
    ['projectId', 'project_id'],
  ];
  const patch: Record<string, unknown> = {};
  for (const [key, column] of map) {
    if (input[key] !== undefined) patch[column] = input[key];
  }
  return patch;
}

/** Every image URL on a write (cover + gallery) that fails the bucket check. */
export function invalidImageUrls(input: PortfolioWriteInput, supabaseUrl: string): string[] {
  const urls: unknown[] = [];
  if (input.coverImageUrl !== undefined && input.coverImageUrl !== null) {
    urls.push(input.coverImageUrl);
  }
  if (input.imageUrls) urls.push(...input.imageUrls);
  return urls
    .filter((u) => !isAllowedPortfolioUrl(u, supabaseUrl))
    .map((u) => String(u));
}
