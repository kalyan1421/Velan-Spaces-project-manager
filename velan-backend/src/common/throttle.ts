import type { ExecutionContext } from '@nestjs/common';
import type { ThrottlerOptions } from '@nestjs/throttler';

/**
 * `sub` of a bearer JWT, read WITHOUT verifying it. Only used to bucket rate
 * limits per account — JwtAuthGuard (which runs after the throttler) still
 * rejects bad tokens, and the per-IP limit caps anyone rotating fake subjects.
 */
export function bearerSubject(authorization: unknown): string | null {
  if (typeof authorization !== 'string') return null;
  const m = /^Bearer\s+[\w-]+\.([\w-]+)\.[\w-]*$/i.exec(authorization.trim());
  if (!m) return null;
  try {
    const payload: unknown = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
    const sub = (payload as { sub?: unknown } | null)?.sub;
    return typeof sub === 'string' && sub.length > 0 && sub.length <= 100 ? sub : null;
  } catch {
    return null;
  }
}

const authHeader = (context: ExecutionContext): unknown =>
  context.switchToHttp().getRequest<{ headers?: Record<string, unknown> }>().headers?.authorization;

/**
 * Global rate limits. `default` is per client IP and deliberately generous:
 * a whole office behind one public IP shares it, and each page load makes
 * several API calls. `user` is per signed-in account, so one heavy user can't
 * use up the office's allowance. Sensitive routes (login, links, enquiries)
 * override `default` with much stricter per-IP limits via @Throttle.
 */
export const THROTTLERS: ThrottlerOptions[] = [
  { name: 'default', ttl: 60_000, limit: 600 },
  {
    name: 'user',
    ttl: 60_000,
    limit: 240,
    skipIf: (context) => bearerSubject(authHeader(context)) === null,
    getTracker: (req) => `user:${bearerSubject((req.headers as Record<string, unknown> | undefined)?.authorization)}`,
  },
];
