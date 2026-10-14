import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { parseStorageRef } from './storage-refs';

const TTL_SECONDS = 3600;
/** Re-sign when less than this much validity is left. */
const MIN_REMAINING_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 5000;

/**
 * Turns `sb://bucket/path` references into signed download URLs.
 *
 * Signed URLs are cached so that screens which poll (every few seconds) get
 * the SAME URL back — a new token on every poll would defeat the app's image
 * cache and re-download every photo.
 */
@Injectable()
export class StorageSignerService {
  private readonly logger = new Logger(StorageSignerService.name);
  private readonly cache = new Map<string, { url: string; expiresAt: number }>();

  constructor(private readonly supabase: SupabaseService) {}

  /** ref -> signed URL. Refs that fail to sign are left out (caller keeps the ref). */
  async signRefs(refs: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const now = Date.now();
    const byBucket = new Map<string, { ref: string; path: string }[]>();

    for (const ref of new Set(refs)) {
      const hit = this.cache.get(ref);
      if (hit && hit.expiresAt - now > MIN_REMAINING_MS) {
        out.set(ref, hit.url);
        continue;
      }
      const parsed = parseStorageRef(ref, '');
      if (!parsed) continue;
      const list = byBucket.get(parsed.bucket) ?? [];
      list.push({ ref, path: parsed.path });
      byBucket.set(parsed.bucket, list);
    }

    for (const [bucket, items] of byBucket) {
      const { data, error } = await this.supabase
        .admin()
        .storage.from(bucket)
        .createSignedUrls(
          items.map((i) => i.path),
          TTL_SECONDS,
        );
      if (error || !data) {
        this.logger.warn(`sign ${bucket}: ${error?.message ?? 'no data'}`);
        continue;
      }
      const expiresAt = now + TTL_SECONDS * 1000;
      data.forEach((d, idx) => {
        if (d.error || !d.signedUrl) return; // e.g. object not uploaded yet
        const ref = items[idx].ref;
        out.set(ref, d.signedUrl);
        this.remember(ref, d.signedUrl, expiresAt);
      });
    }
    return out;
  }

  private remember(ref: string, url: string, expiresAt: number) {
    if (this.cache.size >= MAX_ENTRIES) {
      // Map keeps insertion order: drop the oldest tenth.
      let n = Math.ceil(MAX_ENTRIES / 10);
      for (const k of this.cache.keys()) {
        this.cache.delete(k);
        if (--n === 0) break;
      }
    }
    this.cache.set(ref, { url, expiresAt });
  }
}
