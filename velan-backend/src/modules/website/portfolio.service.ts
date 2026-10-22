import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service';
import { Env } from '../../config/env.validation';
import { publicizeStorageUrl } from '../storage/storage-refs';
import { CreatePortfolioDto, SignPortfolioUploadDto, UpdatePortfolioDto } from './dto';
import {
  buildPortfolioPatch,
  invalidImageUrls,
  MAX_PORTFOLIO_IMAGE_BYTES,
  MAX_SLUG_LENGTH,
  normalizeSupabaseBase,
  PORTFOLIO_BUCKET,
  PORTFOLIO_COLUMNS,
  PortfolioCategory,
  PortfolioItem,
  PortfolioRow,
  PUBLIC_PORTFOLIO_COLUMNS,
  PublicPortfolioItem,
  sanitizeFileName,
  slugify,
  slugSearchPrefix,
  SLUG_RE,
  toPortfolioDto,
  toPublicPortfolioDto,
  uniqueSlug,
} from './website.util';

const TABLE = 'portfolio_items';
/** Safety cap on list size (the portfolio is curated: tens of items, not thousands). */
const MAX_LIST = 500;
const SLUG_FALLBACK = 'project';
const SLUG_ATTEMPTS = 3;

interface PgError {
  code?: string;
  message: string;
}

/**
 * Portfolio items shown on the public website. Reads for the website are
 * public (published only); every write is head-only (enforced by the
 * controller's @Roles). Images live in the public `portfolio` bucket and
 * only URLs inside that bucket may be stored on an item.
 */
@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private db() {
    return this.supabase.admin();
  }

  /**
   * Addresses our Storage is reached at: SUPABASE_URL (what the API uses) and,
   * when set, SUPABASE_PUBLIC_URL (what browsers use, e.g. self-hosted Supabase
   * behind an internal Docker hostname). Public first.
   */
  private storageBases(): string[] {
    const internal = this.config.get('SUPABASE_URL', { infer: true });
    const pub = this.config.get('SUPABASE_PUBLIC_URL', { infer: true });
    return pub ? [pub, internal] : [internal];
  }

  /** A storage URL built by supabase-js (internal base) -> one clients can reach. */
  private publicUrl(url: string): string {
    const pub = this.config.get('SUPABASE_PUBLIC_URL', { infer: true });
    return publicizeStorageUrl(
      url,
      normalizeSupabaseBase(this.config.get('SUPABASE_URL', { infer: true })),
      pub ? normalizeSupabaseBase(pub) : undefined,
    );
  }

  // ------------------------------------------------------------ public reads
  async listPublic(category?: PortfolioCategory): Promise<PublicPortfolioItem[]> {
    let query = this.db().from(TABLE).select(PUBLIC_PORTFOLIO_COLUMNS).eq('status', 'published');
    if (category) query = query.eq('category', category);
    const { data, error } = await query
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(MAX_LIST);
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as PortfolioRow[]).map(toPublicPortfolioDto);
  }

  async getPublicBySlug(slug: string): Promise<PublicPortfolioItem> {
    // Malformed slugs cannot exist (DB CHECK) — skip the query.
    if (slug.length > MAX_SLUG_LENGTH * 2 || !SLUG_RE.test(slug)) throw this.notFound();
    const { data, error } = await this.db()
      .from(TABLE)
      .select(PUBLIC_PORTFOLIO_COLUMNS)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw this.notFound();
    return toPublicPortfolioDto(data as unknown as PortfolioRow);
  }

  // ------------------------------------------------------------ head admin
  async listAll(): Promise<PortfolioItem[]> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select(PORTFOLIO_COLUMNS)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(MAX_LIST);
    if (error) throw new Error(error.message);
    return ((data ?? []) as unknown as PortfolioRow[]).map(toPortfolioDto);
  }

  async create(userId: string, dto: CreatePortfolioDto): Promise<PortfolioItem> {
    this.assertImageUrls(dto);
    const { slug: explicitSlug, ...fields } = buildPortfolioPatch(dto);

    for (let attempt = 1; attempt <= SLUG_ATTEMPTS; attempt++) {
      const slug = (explicitSlug as string | undefined) ?? (await this.generateSlug(dto.title));
      const { data, error } = await this.db()
        .from(TABLE)
        .insert({ ...fields, slug, created_by: userId })
        .select(PORTFOLIO_COLUMNS)
        .single();
      if (!error) return toPortfolioDto(data as unknown as PortfolioRow);

      // Generated slug taken by a concurrent insert: derive the next one and retry.
      if (error.code === '23505' && explicitSlug === undefined && attempt < SLUG_ATTEMPTS) continue;
      throw this.writeError(error);
    }
    throw new ConflictException('Could not allocate a unique slug, please retry');
  }

  async update(id: string, dto: UpdatePortfolioDto): Promise<PortfolioItem> {
    this.assertImageUrls(dto);
    const patch = buildPortfolioPatch(dto);
    if (Object.keys(patch).length === 0) return this.getById(id);

    const { data, error } = await this.db()
      .from(TABLE)
      .update(patch)
      .eq('id', id)
      .select(PORTFOLIO_COLUMNS)
      .maybeSingle();
    if (error) throw this.writeError(error);
    if (!data) throw this.notFound();
    return toPortfolioDto(data as unknown as PortfolioRow);
  }

  async remove(id: string): Promise<{ ok: true }> {
    // Images stay in the bucket: deleting objects derived from stored URLs is
    // a destructive op we avoid here; orphan cleanup can be a separate job.
    const { data, error } = await this.db().from(TABLE).delete().eq('id', id).select('id');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw this.notFound();
    return { ok: true };
  }

  /** sort_order = index of each id, atomically (portfolio_reorder() raises if any id is unknown). */
  async reorder(ids: string[]): Promise<PortfolioItem[]> {
    const { error } = await this.db().rpc('portfolio_reorder', { p_ids: ids });
    if (error) {
      if (error.code === 'P0002') {
        throw new BadRequestException('One or more portfolio items do not exist');
      }
      throw new Error(error.message);
    }
    return this.listAll();
  }

  async signUpload(dto: SignPortfolioUploadDto) {
    const fileName = sanitizeFileName(dto.fileName, dto.contentType);
    if (!fileName) throw new BadRequestException('Only JPEG, PNG, WebP or AVIF images are allowed');
    if (!Number.isInteger(dto.size) || dto.size < 1 || dto.size > MAX_PORTFOLIO_IMAGE_BYTES) {
      throw new BadRequestException('Images must be at most 10 MB');
    }

    const path = `items/${randomUUID()}/${fileName}`;
    const bucket = this.db().storage.from(PORTFOLIO_BUCKET);
    const { data, error } = await bucket.createSignedUploadUrl(path);
    if (error || !data) {
      this.logger.warn(`Portfolio upload signing failed: ${error?.message ?? 'no data'}`);
      throw new BadRequestException('Could not create upload URL');
    }
    // Both URLs are built from SUPABASE_URL; hand out the public address.
    const publicUrl = this.publicUrl(bucket.getPublicUrl(path).data.publicUrl);
    return { path, signedUrl: this.publicUrl(data.signedUrl), token: data.token, publicUrl };
  }

  // ------------------------------------------------------------ helpers
  private async getById(id: string): Promise<PortfolioItem> {
    const { data, error } = await this.db()
      .from(TABLE)
      .select(PORTFOLIO_COLUMNS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw this.notFound();
    return toPortfolioDto(data as unknown as PortfolioRow);
  }

  private async generateSlug(title: string): Promise<string> {
    const base = slugify(title) || SLUG_FALLBACK;
    const { data, error } = await this.db()
      .from(TABLE)
      .select('slug')
      .like('slug', `${slugSearchPrefix(base)}%`)
      .limit(1000);
    if (error) throw new Error(error.message);
    return uniqueSlug(
      base,
      ((data ?? []) as { slug: string }[]).map((r) => r.slug),
    );
  }

  private assertImageUrls(dto: CreatePortfolioDto | UpdatePortfolioDto): void {
    const invalid = invalidImageUrls(dto, this.storageBases());
    if (invalid.length > 0) {
      throw new BadRequestException({
        message: 'Images must be uploaded to the portfolio bucket (POST /portfolio/uploads/sign)',
        details: { invalidUrls: invalid.slice(0, 5).map((u) => u.slice(0, 200)) },
      });
    }
  }

  /** Maps constraint violations to 4xx; anything else stays a (sanitised) 500. */
  private writeError(error: PgError): Error {
    switch (error.code) {
      case '23505':
        return new ConflictException('Slug already in use');
      case '23503':
        return new BadRequestException('projectId does not reference an existing project');
      case '23514':
      case '22P02':
        return new BadRequestException('Invalid portfolio item');
      default:
        return new Error(error.message);
    }
  }

  private notFound() {
    return new NotFoundException('Portfolio item not found');
  }
}
