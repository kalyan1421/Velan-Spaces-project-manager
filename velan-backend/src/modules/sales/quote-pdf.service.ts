import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import { SupabaseService } from '../../supabase/supabase.service';
import { isRef } from '../storage/storage-refs';
import { quotePdfFileName } from './quote-number';
import { parseQuoteSections } from './quote-sections';
import { renderQuotePdf } from './quote-pdf';
import { QuotationSettingsService } from './quotation-settings.service';
import { QuotesService } from './quotes.service';
import { isAllowedLegacyImageUrl, parseOurRef } from './sales-refs';
import { QUOTATION_BUCKET } from './sales.constants';

const IMAGE_TIMEOUT_MS = 8000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

/**
 * `<cwd>/assets` (Docker: /app/assets next to dist/), else relative to this
 * file (src/modules/sales or dist/modules/sales -> ../../../assets).
 */
export function resolveAssetsDir(): string {
  const candidates = [join(process.cwd(), 'assets'), resolve(__dirname, '..', '..', '..', 'assets')];
  return candidates.find((d) => existsSync(join(d, 'fonts', 'NotoSans-Regular.ttf'))) ?? candidates[0];
}

interface StaticAssets {
  fontRegular: Buffer | null;
  fontBold: Buffer | null;
  logo: Buffer | null;
}

let cachedAssets: StaticAssets | null = null;

/** Fonts + fallback logo, read once. Missing files degrade (Helvetica / no logo). */
export function loadStaticAssets(logger?: Logger): StaticAssets {
  if (cachedAssets) return cachedAssets;
  const dir = resolveAssetsDir();
  const read = (rel: string) => {
    try {
      return readFileSync(join(dir, rel));
    } catch {
      logger?.warn(`PDF asset missing: ${join(dir, rel)}`);
      return null;
    }
  };
  cachedAssets = {
    fontRegular: read('fonts/NotoSans-Regular.ttf'),
    fontBold: read('fonts/NotoSans-Bold.ttf'),
    logo: read('logo.png'),
  };
  return cachedAssets;
}

/** GET /quotes/:id/pdf — builds the proposal PDF from the stored quote + settings. */
@Injectable()
export class QuotePdfService {
  private readonly logger = new Logger(QuotePdfService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly quotes: QuotesService,
    private readonly settings: QuotationSettingsService,
  ) {}

  async render(id: string): Promise<{ fileName: string; pdf: Buffer }> {
    const quote = await this.quotes.get(id);
    const settings = await this.settings.getEffective();
    const statics = loadStaticAssets(this.logger);
    const [cover, logo, watermark] = await Promise.all([
      this.loadImage(settings.cover_image_url),
      this.loadImage(settings.logo_url),
      this.loadImage(settings.watermark_logo_url),
    ]);
    // Sanitise stored sections (legacy rows may carry numeric strings).
    const sections = parseQuoteSections(quote.sections).value;
    const pdf = await renderQuotePdf({ ...quote, sections }, settings, {
      fontRegular: statics.fontRegular,
      fontBold: statics.fontBold,
      cover,
      logo: logo ?? statics.logo,
      // Watermark falls back to the header logo (mobile rule), then the bundled logo.
      watermark: watermark ?? logo ?? statics.logo,
    });
    return { fileName: quotePdfFileName(quote.quote_number), pdf };
  }

  /**
   * Image bytes for a settings field, or null (missing, failed, or not ours).
   * `sb://quotations/...` refs are downloaded with the service role; legacy
   * Firebase Storage URLs are fetched; any other URL is skipped (no SSRF).
   */
  private async loadImage(value: string | null | undefined): Promise<Buffer | null> {
    if (!value) return null;
    try {
      if (isRef(value)) {
        const ref = parseOurRef(value, []);
        if (!ref || ref.bucket !== QUOTATION_BUCKET) return null;
        const { data, error } = await withTimeout(
          this.supabase.admin().storage.from(ref.bucket).download(ref.path),
        );
        if (error || !data) throw new Error(error?.message ?? 'no data');
        return capped(Buffer.from(await data.arrayBuffer()));
      }
      if (isAllowedLegacyImageUrl(value)) {
        const res = await fetch(value, { signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS), redirect: 'error' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return capped(Buffer.from(await res.arrayBuffer()));
      }
      return null;
    } catch (e) {
      // Never log the URL (signed/legacy URLs carry tokens).
      this.logger.warn(`Quote PDF: skipped an image (${(e as Error).message})`);
      return null;
    }
  }
}

function capped(buf: Buffer): Buffer | null {
  return buf.length > 0 && buf.length <= MAX_IMAGE_BYTES ? buf : null;
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), IMAGE_TIMEOUT_MS).unref()),
  ]);
}
