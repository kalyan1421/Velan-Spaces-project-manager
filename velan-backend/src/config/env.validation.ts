import { z } from 'zod';

/** Optional var where an empty value (`FOO=` in .env) means "unset". */
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

/**
 * Typed, validated environment. The app refuses to boot if required vars
 * are missing or malformed (fail fast instead of mysterious runtime errors).
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('api/v1'),

  SUPABASE_URL: z.string().url(),
  // Address phones/browsers use to reach Supabase Storage, when it differs
  // from SUPABASE_URL (e.g. self-hosted behind an internal Docker hostname).
  // Signed URLs handed to clients are rewritten to it. Defaults to SUPABASE_URL.
  SUPABASE_PUBLIC_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Tokens are verified via the project JWKS (asymmetric keys), so the legacy
  // shared secret is optional and kept only for reference / legacy fallback.
  SUPABASE_JWT_SECRET: z.string().optional(),

  DATABASE_URL: z.string().optional(),

  // Push (FCM). Provide EITHER a file path (local dev) OR the JSON / base64
  // JSON inline (PaaS hosts like Render/Railway have no persistent file).
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),

  // Google sign-in: comma-separated OAuth client IDs whose ID tokens are
  // accepted (iOS, Android and web clients). Unset = Google sign-in disabled.
  GOOGLE_CLIENT_IDS: z.string().optional(),

  // Web app address used in invite / password-reset links handed to people.
  APP_PUBLIC_URL: z.string().url().default('http://localhost:3100'),
  // Non-deliverable domain for workers' auth accounts (they log in by username).
  WORKER_EMAIL_DOMAIN: z.string().min(3).default('workers.velanspaces.invalid'),

  // Comma-separated browser origins allowed by CORS (the Flutter web build).
  // Native mobile apps do not need CORS. In production, unset = CORS disabled.
  CORS_ORIGINS: z.string().optional(),
  // Swagger UI at /docs. Defaults to on in dev, off in production.
  ENABLE_SWAGGER: z.enum(['true', 'false']).optional(),
  // Number of reverse-proxy hops in front of the app (Render/Railway = 1) so
  // rate limiting sees the real client IP.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),

  // Email (SMTP via nodemailer). Unset SMTP_HOST = email disabled (logged once).
  SMTP_HOST: z.preprocess(blankToUndefined, z.string().optional()),
  SMTP_PORT: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(65535).optional()),
  // true = implicit TLS (port 465). Default: true only when SMTP_PORT is 465.
  SMTP_SECURE: z.preprocess(blankToUndefined, z.enum(['true', 'false']).optional()),
  SMTP_USER: z.preprocess(blankToUndefined, z.string().optional()),
  SMTP_PASS: z.preprocess(blankToUndefined, z.string().optional()),
  // Sender, e.g. "Velan Spaces <no-reply@example.com>". Defaults to SMTP_USER.
  MAIL_FROM: z.preprocess(blankToUndefined, z.string().optional()),
  // Comma-separated recipients of website-enquiry emails. Unset = all active heads.
  ENQUIRY_NOTIFY_EMAILS: z.preprocess(blankToUndefined, z.string().optional()),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
