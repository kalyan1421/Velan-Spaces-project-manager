import { validateObjectPath } from './storage-policy';

/**
 * Storage references. Buckets are private, so rows store a reference
 * (`sb://<bucket>/<path>`) instead of a URL; responses swap references for
 * short-lived signed URLs (see sign-storage-refs.interceptor.ts).
 *
 * Writes accept a reference or one of OUR signed/object URLs (the app echoes
 * back URLs it was given) and store the canonical reference. A reference is
 * only accepted inside the project's own `projects/<projectId>/` folder of an
 * allowed bucket: otherwise anyone could plant `sb://quotations/...` on a row
 * they can read and receive a signed URL for a file they may not access.
 */
export const REF_PREFIX = 'sb://';

export interface StorageRef {
  bucket: string;
  path: string;
}

export const toRef = (r: StorageRef): string => `${REF_PREFIX}${r.bucket}/${r.path}`;

export const isRef = (v: unknown): v is string =>
  typeof v === 'string' && v.startsWith(REF_PREFIX);

const OBJECT_URL_KINDS = ['sign', 'public', 'authenticated'];

/** Parse `sb://bucket/path` or a URL of OUR storage (`<supabaseUrl>/storage/v1/object/...`). */
export function parseStorageRef(value: string, supabaseUrl: string): StorageRef | null {
  if (value.startsWith(REF_PREFIX)) {
    const rest = value.slice(REF_PREFIX.length);
    const slash = rest.indexOf('/');
    if (slash <= 0 || slash === rest.length - 1) return null;
    return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
  }

  const base = `${supabaseUrl.replace(/\/+$/, '')}/storage/v1/object/`;
  if (!value.startsWith(base)) return null;
  const withoutQuery = value.slice(base.length).split(/[?#]/)[0];
  const segments = withoutQuery.split('/');
  if (segments.length < 3 || !OBJECT_URL_KINDS.includes(segments[0])) return null;
  try {
    const [bucket, ...pathSegs] = segments.slice(1).map((s) => decodeURIComponent(s));
    if (!bucket || pathSegs.length === 0) return null;
    return { bucket, path: pathSegs.join('/') };
  } catch {
    return null; // malformed percent-encoding
  }
}

export type RefCheck = { ok: true; value: string } | { ok: false; reason: string };

/**
 * Canonicalise one file reference for a project-scoped row.
 *  - our reference / storage URL -> `sb://bucket/path`, only inside
 *    `projects/<projectId>/` of an allowed bucket
 *  - any other http(s) URL (e.g. legacy Firebase download URLs) -> kept as-is;
 *    it is never signed, so it cannot be used to reach our private buckets
 */
export function normalizeProjectRef(
  value: string,
  opts: { supabaseUrl: string; projectId: string; buckets: readonly string[] },
): RefCheck {
  if (typeof value !== 'string' || value.trim() === '') {
    return { ok: false, reason: 'Empty file reference' };
  }
  const v = value.trim();
  const ref = parseStorageRef(v, opts.supabaseUrl);
  if (ref) {
    if (!opts.buckets.includes(ref.bucket)) {
      return { ok: false, reason: `Files here must be stored in: ${opts.buckets.join(', ')}` };
    }
    const pathError = validateObjectPath(ref.path);
    if (pathError) return { ok: false, reason: pathError };
    const prefix = `projects/${opts.projectId.toLowerCase()}/`;
    if (!ref.path.toLowerCase().startsWith(prefix)) {
      return { ok: false, reason: 'File belongs to a different project' };
    }
    return { ok: true, value: toRef(ref) };
  }
  if (v.startsWith(REF_PREFIX)) return { ok: false, reason: 'Malformed file reference' };
  if (/^https?:\/\/[^\s]+$/i.test(v)) return { ok: true, value: v };
  return { ok: false, reason: 'Unsupported file reference' };
}
