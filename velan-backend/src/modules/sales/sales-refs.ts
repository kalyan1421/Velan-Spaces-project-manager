import { validateObjectPath } from '../storage/storage-policy';
import { parseStorageRef, StorageRef, toRef, REF_PREFIX } from '../storage/storage-refs';
import { QUOTATION_BUCKET } from './sales.constants';

/**
 * File references stored on sales rows (quote pdfUrl; settings logo /
 * watermark / cover image). Same convention as project files: rows hold
 * `sb://quotations/<path>` and responses carry signed URLs.
 *
 * Accepted on write:
 *  - `sb://quotations/quotation(s)/...` or one of OUR storage URLs for that
 *    bucket/folder (clients echo back the signed URLs they were given)
 *    -> stored as the canonical `sb://` reference;
 *  - any other https URL (legacy Firebase download URLs) -> kept as-is; it is
 *    never signed, so it cannot reach our private buckets;
 *  - '' / null -> null (clears the field).
 * The bucket/folder restriction matters because the signing interceptor signs
 * every ref in a response: a ref to another bucket would hand managers a URL
 * for a file they may not otherwise read.
 */
export type SalesRefResult = { ok: true; value: string | null } | { ok: false; reason: string };

const QUOTATION_FOLDERS = ['quotation', 'quotations'];
export const MAX_REF_LENGTH = 1000;

export function normalizeQuotationRef(value: unknown, supabaseUrls: readonly string[]): SalesRefResult {
  if (value === undefined || value === null) return { ok: true, value: null };
  if (typeof value !== 'string') return { ok: false, reason: 'File reference must be a string' };
  const v = value.trim();
  if (v === '') return { ok: true, value: null };
  if (v.length > MAX_REF_LENGTH) return { ok: false, reason: 'File reference is too long' };

  const ref = parseOurRef(v, supabaseUrls);
  if (ref) {
    if (ref.bucket !== QUOTATION_BUCKET) {
      return { ok: false, reason: `Quotation files must be stored in the ${QUOTATION_BUCKET} bucket` };
    }
    const pathError = validateObjectPath(ref.path);
    if (pathError) return { ok: false, reason: pathError };
    if (!QUOTATION_FOLDERS.includes(ref.path.split('/')[0])) {
      return { ok: false, reason: 'Quotation files must be under quotation/' };
    }
    return { ok: true, value: toRef(ref) };
  }
  if (v.startsWith(REF_PREFIX)) return { ok: false, reason: 'Malformed file reference' };
  if (/^https:\/\/[^\s]+$/i.test(v)) return { ok: true, value: v };
  return { ok: false, reason: 'Unsupported file reference' };
}

export function parseOurRef(value: string, supabaseUrls: readonly string[]): StorageRef | null {
  if (value.startsWith(REF_PREFIX)) return parseStorageRef(value, '');
  for (const base of supabaseUrls) {
    const ref = parseStorageRef(value, base);
    if (ref) return ref;
  }
  return null;
}

/**
 * Hosts the PDF renderer may download legacy (pre-migration) images from.
 * Anything else is skipped so a stored URL can never make the server fetch an
 * arbitrary address (SSRF).
 */
export const LEGACY_IMAGE_HOSTS = ['firebasestorage.googleapis.com', 'storage.googleapis.com'];

export function isAllowedLegacyImageUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && LEGACY_IMAGE_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}
