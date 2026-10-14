# Velan Spaces web (Next.js 16, output: "standalone") — production image.
#
#   docker build -t velan-web \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://velanspaces.example \
#     --build-arg IMAGE_REMOTE_HOSTS=<project-ref>.supabase.co \
#     --build-arg NEXT_PUBLIC_GOOGLE_CLIENT_ID=<optional> \
#     ./velan-web                                       (context = velan-web/)
#   docker run -e API_URL=http://api:3000/api/v1 -e APP_URL=https://example.com -p 127.0.0.1:3100:3100 velan-web
#
# BUILD-TIME (baked into the image — changing them needs a rebuild):
#   NEXT_PUBLIC_SITE_URL          canonical public origin for SEO (sitemap, OG, canonical links)
#   NEXT_PUBLIC_GOOGLE_CLIENT_ID  inlined into the browser bundle (public value, not a secret)
#   IMAGE_REMOTE_HOSTS            read by next.config.ts -> images.remotePatterns
#   IMAGE_ALLOW_LOCAL_IP          "true" only if Supabase Storage resolves to a private IP
#   (the NEXT_PUBLIC_* values are also kept as runtime ENV so server code reading
#    process.env at request time sees the same value as the browser bundle)
# RUNTIME (server-only, never baked): API_URL, APP_URL — see deploy/DEPLOYMENT.md.
ARG NODE_IMAGE=node:22-alpine

# ---- deps --------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
# Native toolchain shims some prebuilt binaries expect on Alpine/musl.
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: dependency install scripts never run in the image build.
# (Lockfile scripts: esbuild/unrs-resolver/fsevents — dev tooling, not used by `next build`.)
RUN npm ci --ignore-scripts --no-audit --no-fund

# ---- build -------------------------------------------------------------------
FROM deps AS build
WORKDIR /app
COPY . .
ARG NEXT_PUBLIC_SITE_URL=""
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ARG IMAGE_REMOTE_HOSTS=""
ARG IMAGE_ALLOW_LOCAL_IP=""
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID} \
    IMAGE_REMOTE_HOSTS=${IMAGE_REMOTE_HOSTS} \
    IMAGE_ALLOW_LOCAL_IP=${IMAGE_ALLOW_LOCAL_IP}
RUN npm run build

# ---- runtime -----------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
WORKDIR /app
ARG NEXT_PUBLIC_SITE_URL=""
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3100 \
    HOSTNAME=0.0.0.0 \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID}
# Standalone server + traced node_modules, plus the static assets it serves.
# Owned by `node` because Next writes its runtime cache under .next/ (ISR,
# optimized images). Mount a volume on /app/.next/cache to keep it across restarts.
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
# Pre-create the cache dir as `node` so a named volume mounted here inherits the owner.
RUN mkdir -p .next/cache && chown node:node .next/cache
USER node
EXPOSE 3100
# Liveness: the public home page renders. Override HEALTHCHECK_PATH for a lighter route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3100)+(process.env.HEALTHCHECK_PATH||'/'),{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# exec form: node is PID 1 and gets SIGTERM for a graceful shutdown.
CMD ["node", "server.js"]
