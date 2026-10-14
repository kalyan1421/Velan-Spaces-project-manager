import type { NextConfig } from "next";

/*
 * NOTE: this file is evaluated at `next build` time and serialized into the
 * standalone `server.js`. Anything read from process.env here (IMAGE_REMOTE_HOSTS,
 * IMAGE_ALLOW_LOCAL_IP, NODE_ENV) is BAKED INTO THE BUILD — pass it as a Docker
 * build arg, not as a runtime env var. See deploy/DEPLOYMENT.md.
 * (`next build` always runs with NODE_ENV=production; `next dev` with development.)
 */
const isProd = process.env.NODE_ENV === "production";

type RemotePattern = Exclude<
  NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]>[number],
  URL
>;

/** Supabase Storage (cloud or self-hosted) serves public + signed objects under this prefix. */
const SUPABASE_STORAGE_PATH = "/storage/v1/**";

/**
 * IMAGE_REMOTE_HOSTS: comma-separated list of hosts next/image may optimize from.
 * Entry grammar: `[http://|https://]hostname[:port][/path-glob]`
 *   - scheme defaults to https (http only when written explicitly)
 *   - hostname may start with `*.` or `**.` (subdomain wildcards)
 *   - path defaults to the Supabase Storage prefix `/storage/v1/**`
 * Examples: `abcd1234.supabase.co`, `supabase.example.com:8443`, `cdn.example.com/media/**`
 * A malformed entry fails the build (fail fast instead of silently broken images).
 * No `search` restriction: Supabase signed URLs carry a `?token=` query string.
 */
const ENTRY_RE =
  /^(?:(https?):\/\/)?((?:\*{1,2}\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*)(?::(\d{1,5}))?(\/[^\s?#]*)?$/i;

function parseImageRemoteHosts(raw: string): RemotePattern[] {
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const match = ENTRY_RE.exec(entry);
      if (!match) {
        throw new Error(
          `IMAGE_REMOTE_HOSTS: invalid entry "${entry}" (expected [https://]host[:port][/path/**])`,
        );
      }
      const [, scheme, hostname, port, pathname] = match;
      return {
        protocol: scheme?.toLowerCase() === "http" ? "http" : "https",
        hostname: hostname.toLowerCase(),
        port: port ?? "", // "" = default port only
        pathname: pathname && pathname !== "/" ? pathname : SUPABASE_STORAGE_PATH,
      } satisfies RemotePattern;
    });
}

const configuredHosts = process.env.IMAGE_REMOTE_HOSTS?.trim();

const remotePatterns: RemotePattern[] = configuredHosts
  ? parseImageRemoteHosts(configuredHosts)
  : // Default when unset: any Supabase Cloud project. Production should set
    // IMAGE_REMOTE_HOSTS to the exact project host so the optimizer can't be
    // used as an image proxy for other people's Supabase buckets.
    [{ protocol: "https", hostname: "**.supabase.co", port: "", pathname: SUPABASE_STORAGE_PATH }];

if (!isProd) {
  // Local Supabase (`supabase start`, API on :54321) — development only.
  remotePatterns.push(
    { protocol: "http", hostname: "localhost", port: "54321", pathname: SUPABASE_STORAGE_PATH },
    { protocol: "http", hostname: "127.0.0.1", port: "54321", pathname: SUPABASE_STORAGE_PATH },
  );
}

/*
 * Security headers for every route. Intentionally NO script-src CSP yet: a
 * script CSP needs per-request nonces for Next's inline bootstrap scripts
 * (proxy.ts + `headers()`); doing it statically here would break the app.
 * TODO(P1): nonce-based Content-Security-Policy (script-src/style-src/connect-src/img-src).
 * The CSP below only carries directives that cannot break Next's inline scripts.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS only for production builds (browsers ignore it over plain http anyway).
  // No includeSubDomains/preload by default: other subdomains of the client's
  // domain may still be HTTP-only. TODO(client): add once every subdomain is HTTPS.
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },

  // Self-hosting: emit .next/standalone (minimal server.js + traced node_modules)
  // for the Docker image. No platform-specific features are used.
  output: "standalone",
  poweredByHeader: false,

  images: {
    remotePatterns,
    // Next 16 blocks optimizing images that resolve to private/loopback IPs (SSRF
    // guard). Allowed in dev for local Supabase; in production only with an explicit
    // opt-in (self-hosted Supabase on a private network / split-horizon DNS).
    dangerouslyAllowLocalIP: !isProd || process.env.IMAGE_ALLOW_LOCAL_IP === "true",
    // Supabase Storage answers object reads directly; redirect targets are not
    // re-checked against remotePatterns, so don't follow any.
    maximumRedirects: 0,
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
