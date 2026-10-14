import { z } from 'zod';

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

  // Comma-separated browser origins allowed by CORS (the Flutter web build).
  // Native mobile apps do not need CORS. In production, unset = CORS disabled.
  CORS_ORIGINS: z.string().optional(),
  // Swagger UI at /docs. Defaults to on in dev, off in production.
  ENABLE_SWAGGER: z.enum(['true', 'false']).optional(),
  // Number of reverse-proxy hops in front of the app (Render/Railway = 1) so
  // rate limiting sees the real client IP.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
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
