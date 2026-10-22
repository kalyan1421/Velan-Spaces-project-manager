# Velan Spaces API (NestJS) — production image.
#
#   docker build -t velan-api ./velan-backend        (context = velan-backend/)
#   docker run --env-file velan-backend/.env -p 127.0.0.1:3000:3000 velan-api
#
# All configuration is runtime env (see deploy/DEPLOYMENT.md); nothing secret is
# baked into the image. Pin NODE_IMAGE to a digest for fully reproducible builds:
#   --build-arg NODE_IMAGE=node:22-alpine@sha256:<digest>
ARG NODE_IMAGE=node:22-alpine

# ---- deps: full dependency tree (incl. dev) for compiling -------------------
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts: no dependency install scripts run during the build (the only
# ones in the lockfile are an @nestjs/core donation banner and an optional
# protobufjs CLI hook — neither is needed at runtime).
RUN npm ci --ignore-scripts --no-audit --no-fund

# ---- build: compile src/ -> dist/ (tsconfig.build.json excludes scripts/ + specs)
FROM deps AS build
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---- prod-deps: runtime dependencies only ------------------------------------
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
 && npm cache clean --force

# ---- runtime -----------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
# Code stays root-owned (read-only to the app user); the API writes nothing to disk.
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Runtime files read from <cwd>/assets: quote PDF fonts (Noto Sans, OFL licence
# alongside) and the logo. WORKDIR is /app, so they resolve to /app/assets.
COPY assets ./assets
COPY package.json ./
USER node
EXPOSE 3000
# Liveness: GET /<API_PREFIX>/health (public, unthrottled). It returns 200 with
# {"status":"degraded"} when the DB is unreachable, so a Supabase blip does not
# mark the container unhealthy — alert on the body for DB health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/'+(process.env.API_PREFIX||'api/v1')+'/health',{signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# exec form: node is PID 1 and receives SIGTERM directly (Nest shutdown hooks run).
CMD ["node", "dist/main.js"]
