import { z } from "zod";

/**
 * Server environment, validated once per process. Read it through `getEnv()`
 * from server code only; values are evaluated at runtime (not inlined at build),
 * so one Docker image can be promoted across environments.
 */

export type EnvVarDoc = {
  name: string;
  required: boolean;
  default?: string;
  description: string;
};

/** For docs / .env.example generation. Keep in sync with the schema below. */
export const ENV_VARS: readonly EnvVarDoc[] = [
  {
    name: "API_URL",
    required: false,
    default: "http://localhost:3000/api/v1",
    description: "Base URL of the NestJS API (server-side only; the browser never calls it directly).",
  },
  {
    name: "APP_URL",
    required: false,
    default: "http://localhost:3100",
    description: "Public URL of this web app. Used for metadataBase and the CSRF origin check.",
  },
  {
    name: "NEXT_PUBLIC_GOOGLE_CLIENT_ID",
    required: false,
    description: "Google OAuth web client ID. When unset, the Google sign-in button is hidden.",
  },
];

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const httpUrl = (name: string, fallback: string) =>
  z.preprocess(
    blankToUndefined,
    z
      .string()
      .trim()
      .default(fallback)
      .refine((v) => {
        try {
          const u = new URL(v);
          return u.protocol === "http:" || u.protocol === "https:";
        } catch {
          return false;
        }
      }, `${name} must be an http(s) URL`)
      .transform((v) => v.replace(/\/+$/, "")),
  );

const schema = z.object({
  API_URL: httpUrl("API_URL", "http://localhost:3000/api/v1"),
  APP_URL: httpUrl("APP_URL", "http://localhost:3100"),
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.preprocess(blankToUndefined, z.string().trim().max(256).optional()),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${issues}`);
  }
  return result.data;
}

let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}
