import { AppRole } from '../../common/types/authenticated-user';

export type StorageMode = 'upload' | 'download';

export type StorageDecision =
  | { allowed: true; projectId?: string }
  // status 400 = malformed request (bad path / file type), 403 = not permitted.
  | { allowed: false; reason: string; status: 400 | 403 };

export interface StorageRequest {
  bucket: string;
  path: string;
  mode: StorageMode;
  role: AppRole;
  userId: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** File types the app legitimately uploads (photos, video, PDFs, office docs). */
export const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif',
  'pdf',
  'mp4', 'mov', 'm4v',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv',
]);

const MAX_PATH_LENGTH = 300;

/** Reject traversal, absolute paths, empty segments and control characters. */
export function validateObjectPath(path: string): string | null {
  if (typeof path !== 'string' || path.length === 0) return 'Path is required';
  if (path.length > MAX_PATH_LENGTH) return 'Path too long';
  if (path.startsWith('/')) return 'Path must be relative';
  if (path.includes('\\')) return 'Invalid path';
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(path)) return 'Invalid characters in path';
  const segments = path.split('/');
  if (segments.some((s) => s === '' || s === '.' || s === '..')) {
    return 'Invalid path segment';
  }
  return null;
}

function extensionOf(path: string): string {
  const name = path.split('/').pop() ?? '';
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase();
}

const STAFF: AppRole[] = ['head', 'manager'];
const FIELD_STAFF: AppRole[] = ['head', 'manager', 'worker'];
const ALL_ROLES: AppRole[] = ['head', 'manager', 'worker', 'client'];

/** Who may upload into each project-scoped bucket. Download = any project member. */
const PROJECT_BUCKET_UPLOADERS: Record<string, AppRole[]> = {
  // Chat/complaint attachments and timeline proofs come from every role.
  'project-files': ALL_ROLES,
  // Design documents are curated by head/managers only.
  designs: STAFF,
  // Site photos/videos for updates come from the field team.
  'update-images': FIELD_STAFF,
};

/**
 * Pure authorization decision for a signed-URL request. The caller must still
 * verify project membership when `projectId` is returned.
 *
 * Path conventions (enforced here so one user cannot reach another project's
 * objects just by naming them):
 *   project-files | designs | update-images : projects/<projectId>/<...>/<file>
 *   quotations                              : quotation(s)/<...>        (head/manager)
 *   avatars                                 : users/<userId>/<file>
 */
export function evaluateStoragePolicy(req: StorageRequest): StorageDecision {
  const pathError = validateObjectPath(req.path);
  if (pathError) return { allowed: false, reason: pathError, status: 400 };

  const segments = req.path.split('/');

  if (req.mode === 'upload') {
    const ext = extensionOf(req.path);
    if (!ALLOWED_UPLOAD_EXTENSIONS.has(ext)) {
      return { allowed: false, reason: 'File type not allowed', status: 400 };
    }
  }

  if (req.bucket in PROJECT_BUCKET_UPLOADERS) {
    if (segments.length < 3 || segments[0] !== 'projects' || !UUID_RE.test(segments[1])) {
      return {
        allowed: false,
        reason: 'Path must be projects/<projectId>/.../<file>',
        status: 400,
      };
    }
    if (
      req.mode === 'upload' &&
      !PROJECT_BUCKET_UPLOADERS[req.bucket].includes(req.role)
    ) {
      return { allowed: false, reason: 'Your role cannot upload to this bucket', status: 403 };
    }
    return { allowed: true, projectId: segments[1].toLowerCase() };
  }

  if (req.bucket === 'quotations') {
    if (!STAFF.includes(req.role)) {
      return { allowed: false, reason: 'Quotations are staff-only', status: 403 };
    }
    if (segments.length < 2 || !['quotation', 'quotations'].includes(segments[0])) {
      return { allowed: false, reason: 'Path must start with quotation/', status: 400 };
    }
    return { allowed: true };
  }

  if (req.bucket === 'avatars') {
    if (req.mode === 'upload') {
      const ownFolder =
        segments.length >= 3 &&
        segments[0] === 'users' &&
        segments[1].toLowerCase() === req.userId.toLowerCase();
      if (!ownFolder) {
        return { allowed: false, reason: 'You can only upload to your own avatar folder', status: 403 };
      }
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Unknown bucket', status: 400 };
}
