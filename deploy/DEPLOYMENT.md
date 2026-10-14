# Velan Spaces — Deployment Guide (self-hosted)

For the operations person installing Velan Spaces on the client's own infrastructure.
Everything ships as two Docker images (API and web) configured by environment
variables. No hosting-vendor features are used, so any Linux host, VM or container
platform that runs Docker images will work.

Items marked **TODO(client)** depend on decisions or values we do not have yet.

---

## 1. Architecture

```
                     Internet (browsers, iOS/Android apps)
                                   │  HTTPS :443
                     ┌─────────────▼──────────────┐
                     │ Reverse proxy (TLS)        │  Caddy (compose profile "proxy")
                     │ velanspaces.example        │  or your own nginx (deploy/nginx.conf)
                     │ api.velanspaces.example ───┼──────────────┐  (mobile apps only)
                     └─────────────┬──────────────┘              │
                                   │ http + X-Forwarded-For       │
                     ┌─────────────▼──────────────┐              │
                     │ web — Next.js  :3100       │              │
                     │ public site, staff app,    │              │
                     │ client portal, /api/bff/*  │              │
                     └─────────────┬──────────────┘              │
                                   │ http://api:3000/api/v1       │
                                   │ (internal Docker network)    │
                     ┌─────────────▼──────────────┐◄─────────────┘
                     │ api — NestJS   :3000       │
                     └─────────────┬──────────────┘
                                   │ HTTPS (service-role key; JWKS token checks)
       ┌───────────────────────────▼──────────────────────────────┐
       │ Supabase — EXTERNAL (Supabase Cloud or self-hosted)      │
       │ Postgres · Auth · Storage                                │
       └──────────────────────────────────────────────────────────┘
  Browsers and apps upload and download file bytes directly to and from Supabase
  Storage using short-lived signed URLs that the API issues.
```

Points to keep in mind:

- **The browser never calls the API directly.** The web app is a BFF: Next.js
  route handlers keep the session in httpOnly cookies and call the API
  server-side over the internal network.
- **Supabase is not part of this stack.** `docker-compose.yml` runs only `api`,
  `web` and, optionally, `proxy`. The database, auth and file storage are Supabase
  Cloud or the client's own self-hosted Supabase.
- The API can also be published at `api.<domain>`, for the mobile apps and the
  Flutter web build.

## 2. Prerequisites

| Item | Notes |
|---|---|
| Linux server or VM | 2 vCPU / 4 GB RAM is a reasonable start. The web image build (`next build`) is the heaviest step. TODO(client): size for real traffic. |
| Docker Engine 24+ with Compose v2.24+ | `docker compose version`. Podman with compose should work but has not been tested. |
| A domain and DNS access | `velanspaces.example` (web) and optionally `api.velanspaces.example` (mobile API). TODO(client): real names. |
| Ports 80 and 443 open | Needed for HTTPS and ACME certificate issuance. Nothing else needs to be public. |
| A Supabase project | Supabase Cloud, or a self-hosted Supabase that meets the JWT requirement in §3.4. |
| A git checkout of this repository | The images are built from `velan-backend/` and `velan-web/`. |
| Node 22 and npm (one-off) | Only for running the seed script and the Supabase CLI from a workstation (§3.6). |
| Firebase service account (optional) | For push notifications (FCM) only. |

CPU architecture: both images build on `linux/amd64` and `linux/arm64`. The
lockfiles include the musl (Alpine) native binaries for both.

## 3. Supabase setup

### 3.1 Create the project
- **Supabase Cloud:** create a project in the region nearest the users.
  TODO(client): choose the region and plan. Backups and PITR depend on the plan
  (see §11).
- **Self-hosted Supabase:** follow Supabase's self-hosting guide, and read §3.4
  before you go further.

Record these values for the API env file (§4.2):
- Project URL → `SUPABASE_URL`
- anon key → `SUPABASE_ANON_KEY`
- service_role key → `SUPABASE_SERVICE_ROLE_KEY` (**secret**: it bypasses RLS)

### 3.2 Apply the database migrations
The schema is in `velan-backend/supabase/migrations/`. Apply **every** file in
filename (timestamp) order. Use the Supabase CLI so the applied migrations are
recorded:

```bash
cd velan-backend
npx supabase@latest link --project-ref <project-ref>     # Supabase Cloud
npx supabase@latest db push                              # applies pending migrations in order
# self-hosted (or no CLI link): pass the Postgres URL directly
npx supabase@latest db push --db-url "postgresql://postgres:<password>@<host>:5432/postgres"
```

- At the time of writing the folder holds `20260618170001` through `20260618170008`.
  More files are on the way, among them `20261014100000_timeline_replace.sql` and
  `20261014200000_website_portfolio.sql`. Always apply the folder as it is in the
  release you deploy.
- Do **not** use `supabase/schema_combined.sql` for production. It is a Phase 1
  snapshot and leaves out the later migrations.
- Migrations are forward-only. Take a backup (§11) before you apply new ones.

### 3.3 Storage buckets
The migrations create the buckets, so do not create them by hand:
- Private: `project-files`, `designs`, `update-images`, `quotations`, `avatars`
  (migration `…0007`). These are reachable only through signed URLs that the API issues.
- Public: `portfolio`, for website portfolio images. It is added by the website
  migration that is still in progress.

Check that the project's global upload size limit (Storage settings) is at least
as large as the biggest file users upload. Portfolio images are capped at 10 MB.
TODO(client): confirm the limit for project files.

### 3.4 Auth settings (all required)
| Setting | Value | Why |
|---|---|---|
| **JWT signing keys** | **Asymmetric keys (ECC P-256 / ES256)** | The API checks every access token against `<SUPABASE_URL>/auth/v1/.well-known/jwks.json` and accepts only `ES256`, `RS256` or `EdDSA`. Projects that still sign with the legacy shared secret (HS256) get **401 on every request**. On Supabase Cloud, migrate under Project Settings → JWT Keys. **Self-hosted:** TODO(client) confirm your Supabase/GoTrue version can sign with asymmetric keys and serves the JWKS endpoint. |
| Allow new users to sign up | **Off** | Accounts are created by the API (service role) and by invites. The anon key is public, so with sign-up left on anyone could create auth users directly. |
| Minimum password length | **8** | Matches the API's new-password rule (8–72 characters). |
| Email confirmations / SMTP | TODO(client) | Configure SMTP only if Supabase emails are used. Web invites and password resets use the app's own links. |
| Site URL / Redirect URLs | `https://velanspaces.example` | TODO(client): set to the real web domain. |

`SUPABASE_JWT_SECRET` (the legacy secret) is not used to verify tokens. Leave it empty.

### 3.5 Google sign-in (optional)
Create OAuth client IDs in Google Cloud (web, iOS, Android) and list all of them
in the API's `GOOGLE_CLIENT_IDS`. To show the button on the web login page, also
set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (a web build value). Google sign-in works only
for accounts that already exist. TODO(client): the OAuth consent screen and the
authorized JavaScript origin (`https://velanspaces.example`).

### 3.6 First admin (head) user
The seed script is not shipped in the image. Run it once from a checkout:

```bash
cd velan-backend && npm ci
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
SEED_HEAD_EMAIL=<real head email> SEED_HEAD_PASSWORD='<strong unique password>' \
  npm run seed
```

- The script **prints the password to the terminal**. Run it in a private
  session and clear the scrollback afterwards.
- It also creates a sample project, `VS-DEMO-001 / Demo Project`. Delete it
  before go-live.
- **Never run `npm run seed:demo` against production.** It creates
  `manager@`, `worker@` and `client@velanspaces.com` with the default password
  the default seed password from `velan-backend/scripts/seed.ts`.

## 4. Configuration reference

There are three places where values go. None of them are committed to git.

| File | Used by | Contains secrets? |
|---|---|---|
| `.env` at the repo root (template `deploy/compose.env.example`) | Docker Compose variable substitution | No |
| `API_ENV_FILE` (template `velan-backend/.env.example`), e.g. `/etc/velan/api.env`, `chmod 600` | `api` container | **Yes** |
| Web build args and env, all set through the compose `.env` | `web` image and container | No |

### 4.1 Compose variables (`.env` at the repo root)
| Variable | Default | Meaning |
|---|---|---|
| `APP_URL` | required | Public HTTPS URL of the web app, without a trailing slash. |
| `API_ENV_FILE` | `./velan-backend/.env` | Path to the API secrets file. |
| `NEXT_PUBLIC_SITE_URL` | `APP_URL` | Web build value, see §4.3. |
| `IMAGE_REMOTE_HOSTS` | any `*.supabase.co` | Web build value, see §4.3. |
| `IMAGE_ALLOW_LOCAL_IP` | empty | Web build value, see §4.3. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | empty | Web build value, see §4.3. |
| `BIND_ADDR` | `127.0.0.1` | Host interface that the API and web ports are published on. |
| `API_PORT` / `WEB_PORT` | `3000` / `3100` | Host ports. The container ports stay at 3000 and 3100. |
| `IMAGE_PREFIX` / `IMAGE_TAG` | `velan` / `latest` | Image names. Use the git SHA as the tag so you can roll back (§10). |
| `SITE_DOMAIN`, `API_DOMAIN`, `ACME_EMAIL` | none | Needed only with `--profile proxy` (Caddy). |

### 4.2 API (`velan-backend`): runtime env, file `API_ENV_FILE`
Source of truth: `velan-backend/src/config/env.validation.ts`. The API refuses to
start if a required value is missing or malformed.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `SUPABASE_URL` | ✅ | none | `https://<ref>.supabase.co` or the self-hosted URL. Token issuer and JWKS are derived from it. |
| `SUPABASE_ANON_KEY` | ✅ | none | Used only for the password sign-in call. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ secret | none | Full database and storage access. Lives only in this file. |
| `NODE_ENV` | | `production` | Compose pins it to `production`. `development` turns on permissive CORS and Swagger. |
| `PORT` | | `3000` | Compose pins it to `3000`. The web app's `API_URL` depends on it. |
| `API_PREFIX` | | `api/v1` | If you change it, also change the web `API_URL` in `docker-compose.yml`. |
| `TRUST_PROXY_HOPS` | ✅ for prod | `0` | Set it to **`1`** for the reference setup. See §7. |
| `CORS_ORIGINS` | | empty (CORS off in prod) | Only the Flutter web build's origin, if one exists. See §8. |
| `ENABLE_SWAGGER` | | off in prod | Keep it off on the public API. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | | empty | FCM push. Raw or base64 JSON. If empty, push is disabled (a warning is logged). |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | | empty | Alternative to the JSON variable. Mount the file read-only (see the comment in compose). |
| `GOOGLE_CLIENT_IDS` | | empty (Google sign-in off) | Comma-separated OAuth client IDs (web, iOS, Android). *Added by the mobile-migration branch.* |
| `SUPABASE_JWT_SECRET` | | empty | Legacy and not used for verification. Leave it unset. |
| `DATABASE_URL` | | empty | Not read by the running API. Leave it unset in production. |

Script-only variables, which are never in the image: `SEED_HEAD_EMAIL`,
`SEED_HEAD_PASSWORD`, `SEED_DEMO_PASSWORD`.

### 4.3 Web (`velan-web`)
| Variable | When | Required | Notes |
|---|---|---|---|
| `API_URL` | runtime | ✅ | Internal API base. Compose sets `http://api:3000/api/v1`. Server-side only. |
| `APP_URL` | runtime | ✅ | Public origin of the web app, e.g. `https://velanspaces.example`. Used for `metadataBase` **and the CSRF origin check**: it must match the URL in the browser's address bar exactly (scheme + host, no trailing slash), or every sign-in and form submit is rejected. |
| `NEXT_PUBLIC_SITE_URL` | **build** | recommended | Canonical origin for SEO (sitemap, canonical and OG URLs). Compose defaults it to `APP_URL`. If unset in a bare `docker build`, the site falls back to `https://velanspaces.com`. |
| `IMAGE_REMOTE_HOSTS` | **build** | recommended | The hosts that `next/image` may load from. Grammar: `[https://]host[:port][/path/**]`, comma-separated; the path defaults to `/storage/v1/**`. Production should use the exact host (`<ref>.supabase.co` or your self-hosted Supabase host). If unset, any `*.supabase.co` is allowed. A malformed entry fails the build. |
| `IMAGE_ALLOW_LOCAL_IP` | **build** | no | Set it to `true` only if Supabase Storage resolves to a private IP (self-hosted on a LAN or with split DNS). It turns off Next's SSRF guard for private IPs. |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | **build** | no | Inlined into the browser bundle and also kept as runtime env in the image, so the server and browser agree. It is public and not a secret. If empty, the Google button is hidden. |
| `PORT` / `HOSTNAME` | runtime | preset | `3100` / `0.0.0.0` |
| `HEALTHCHECK_PATH` | runtime | no | Path probed by the image health check. Default `/`. |

**Build values are baked into the image.** `next.config.ts` is read during
`next build`, and `NEXT_PUBLIC_*` values are inlined into JavaScript. After you
change one, rebuild: `docker compose build web && docker compose up -d web`.

**The web app must be served over HTTPS in production.** Session cookies are
`Secure`, so a login over `http://server-ip:3100` silently fails to keep the session.

Source of truth for runtime web variables: `velan-web/src/lib/env.ts` (`ENV_VARS`). Keep this table in sync when that list changes.

## 5. Build and run with Docker Compose

```bash
git clone <repo> velan && cd velan
git checkout <release tag or commit>          # TODO(client): release process

cp deploy/compose.env.example .env            # edit APP_URL, IMAGE_REMOTE_HOSTS, domains…
# API secrets outside the checkout, readable only by the user that runs `docker compose`
sudo install -D -m 600 -o "$USER" velan-backend/.env.example /etc/velan/api.env   # then edit it
echo "API_ENV_FILE=/etc/velan/api.env" >> .env

export IMAGE_TAG=$(git rev-parse --short HEAD)
docker compose build                          # api + web images
docker compose up -d                          # starts api; web starts once api is healthy
docker compose ps                             # both should show "healthy" within ~1 min
curl -fsS http://127.0.0.1:3000/api/v1/health # {"status":"ok","db":"ok",…}
curl -fsSI http://127.0.0.1:3100/ | head -1   # HTTP/1.1 200 OK
```

Hardening that is already in `docker-compose.yml`:
- Both containers run as the non-root `node` user, with `cap_drop: ALL` and
  `no-new-privileges`.
- The API's filesystem is read-only, with a tmpfs for `/tmp`.
- Ports are published on `127.0.0.1` only. Docker-published ports bypass host
  firewalls such as `ufw`, so binding to loopback keeps the containers off the
  internet. Only the reverse proxy is public.
- Logs rotate at 10 MB × 5 files per container.

Building somewhere else (CI or a registry): `docker build ./velan-backend` and
`docker build --build-arg IMAGE_REMOTE_HOSTS=… ./velan-web`, then push to the
client's registry and set `IMAGE_PREFIX` and `IMAGE_TAG` on the server.
TODO(client): container registry.

## 6. Reverse proxy and TLS

Pick one of the two options.

**A. Caddy, bundled (simplest).** Set `SITE_DOMAIN`, `API_DOMAIN` and `ACME_EMAIL`
in `.env`, point DNS at the server, then:

```bash
docker compose --profile proxy up -d
```

Caddy gets and renews the certificates automatically, routes `SITE_DOMAIN` →
`web:3100` and `API_DOMAIN` → `api:3000`, and keeps certificates in the
`caddy_data` volume. Config: `deploy/Caddyfile`. If the API should not be
public, delete the `{$API_DOMAIN}` block.

**B. nginx on the host (with certbot), or an existing corporate proxy or load
balancer.** Start from `deploy/nginx.conf`. It routes the web domain →
`127.0.0.1:3100` and `api.` → `127.0.0.1:3000`, redirects HTTP to HTTPS, and
turns off response buffering for Next.js streaming. Whichever proxy you use,
it **must**:
1. Terminate TLS and redirect HTTP to HTTPS.
2. **Overwrite** `X-Forwarded-For` with the real client IP. Do not append to it (§7).
3. Not buffer responses for the web app (`proxy_buffering off` in nginx).
4. Allow request bodies up to about 10 MB.

HSTS is sent by the web app (`max-age=31536000`) and by the API (helmet).
TODO(client): add `includeSubDomains` and `preload` only once every subdomain is HTTPS.

## 7. Client IPs and `TRUST_PROXY_HOPS` (read before go-live)

The API rate-limits **per client IP**:

| Endpoint | Limit |
|---|---|
| `POST /auth/login`, `POST /auth/google` | 8 / minute |
| `POST /auth/change-password` | 5 / minute |
| `POST /auth/refresh` | 20 / minute |
| everything else | 120 / minute |

The API reads the client IP from `X-Forwarded-For`. It trusts exactly
`TRUST_PROXY_HOPS` entries counted from the right, that is, the entries written
by your own infrastructure.

Requests reach the API on two paths:

```
web:     browser ─► proxy (sets XFF = client) ─► web BFF (forwards XFF = client) ─► api   → 1 hop
mobile:  app     ─► proxy (sets XFF = client) ──────────────────────────────────► api     → 1 hop
```

**Set `TRUST_PROXY_HOPS=1`.** Here is why that number is right on both paths:
- The edge proxy writes the real client IP as the **right-most**
  `X-Forwarded-For` entry. Our configs go further and **overwrite** the header
  with that single IP (Caddy: `header_up X-Forwarded-For {client_ip}`; nginx:
  `proxy_set_header X-Forwarded-For $remote_addr`), so a client-supplied value
  never survives.
- The web BFF (`velan-web/src/lib/api/forwarding.ts`) passes the header it
  received **unchanged** and does not add its own hop. Next.js fills it in only
  when it is missing. Every web→API call, both `/api/bff/*` and server-side
  rendering, must forward it.
- The API's direct peer is either the web container or the proxy, and the entry
  next to that peer is the client in both cases. That is one trusted hop, never two.

Why it matters:
- **Too low (0)**: every request seems to come from the web container. All users
  share one bucket, so the 9th login attempt in a minute *across the whole
  company* gets `429`, anyone can lock everybody out by sending bad passwords,
  and server-rendered pages hit the 120/min limit under normal traffic.
- **Too high (2 or more with one proxy)**: the API trusts an IP the attacker
  wrote into the header. Rotating fake IPs then allows unlimited password guessing.

If a CDN or cloud load balancer sits **in front of** the proxy, make the proxy
resolve the real client IP from it and still send one IP. Caddy:
`trusted_proxies` (commented in the Caddyfile). nginx: `set_real_ip_from <cdn ranges>;
real_ip_header X-Forwarded-For; real_ip_recursive on;`. Keep
`TRUST_PROXY_HOPS=1`. Do not publish the API port anywhere except through the proxy.

**Verify after deploy:** from one network, send 9 wrong-password logins within a
minute. The 9th should return `429`. A login from a *different* network in the
same minute must still be accepted.

Scaling note: the rate limiter keeps its counters in memory, per API instance.
Running N API replicas multiplies the limits by N. Run **one** API instance, or
TODO: add a shared throttler store before you scale out.

## 8. CORS

The web app calls the API **server-side**, so it needs no CORS. Native mobile
apps ignore CORS. Set `CORS_ORIGINS` only if a browser build of the Flutter app
is hosted somewhere, and then only to that exact origin, e.g.
`https://app.velanspaces.example`. In production, leaving it empty turns CORS off.
Never use `*`.

Browsers upload directly to Supabase Storage. Supabase Cloud allows this.
Self-hosted: TODO(client) confirm that the gateway allows `PUT`/`GET` from the web origin.

## 9. Health checks and monitoring

| Check | What it means |
|---|---|
| `GET /api/v1/health` (public, not rate-limited) | `{"status":"ok","db":"ok"}`, or `"degraded"`/`"error"` when the database is unreachable. It **always returns HTTP 200** while the process is alive, so alert on the body (`"status":"ok"`), not just the status code. |
| Docker `HEALTHCHECK` (both images) | API: the URL above. Web: `GET /` returns 2xx. Every 30 s, unhealthy after 3 failures. `docker compose ps` shows the state. |
| External uptime monitor | TODO(client): monitor `https://velanspaces.example/` and `https://api.velanspaces.example/api/v1/health` (body contains `"ok"`). Alert by email or phone. |

Docker does **not** restart an *unhealthy* container by itself. `restart:
unless-stopped` covers crashes only. If you need auto-healing, use an
orchestrator or a watchdog. TODO(client).

## 10. Logs, updates and rollback

```bash
docker compose logs -f --tail=200 api web proxy
```
- Logs go to stdout and are rotated by Docker (10 MB × 5). Caddy writes JSON access logs.
- TODO(client): ship logs to the client's log platform, and keep tokens and
  passwords out of any added log fields.

**Update:**
```bash
git fetch && git checkout <new release>
# back up first if the release adds migrations (§11), then apply them (§3.2)
export IMAGE_TAG=$(git rev-parse --short HEAD)
docker compose build && docker compose up -d
```

**Roll back:** set `IMAGE_TAG` to the previous tag (the old images stay on the
host), then run `docker compose up -d`. Database migrations do not roll back
automatically. If a release changed the schema, restore from the backup taken
before it, or apply a hand-written down-migration.

Multi-instance web (more than one `web` replica) needs extra settings:
- the same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` at build time,
- a `deploymentId` for version skew,
- a shared cache handler.

See the Next.js self-hosting guide (`velan-web/node_modules/next/dist/docs/01-app/02-guides/self-hosting.md`).
One instance is the supported setup for now.

## 11. Backups

| What | How |
|---|---|
| Database (Supabase Cloud) | Daily backups depend on the plan, and Point-in-Time Recovery is an add-on. TODO(client): choose the plan and retention. |
| Database (any, self-managed copy) | Nightly logical dump with the Supabase CLI: `supabase db dump --db-url "$DB_URL" -f roles.sql --role-only`, `… -f schema.sql`, `… -f data.sql --use-copy --data-only`. Or `pg_dump -Fc "$DB_URL"`. Encrypt the dumps and store them off-site. |
| Storage files | **Not** included in database dumps. Copy the buckets (Supabase Storage has an S3-compatible API, e.g. `rclone`) to separate storage. TODO(client). |
| Config | Keep the API env file and compose `.env` in the client's password manager or vault. |
| Caddy `caddy_data` volume | Certificates and the ACME account. They can be re-issued, but back them up to avoid ACME rate limits. |

Test a restore into a scratch Supabase project at least once before go-live,
then every quarter.

## 12. Secrets and rotation

| Secret | Rotate by |
|---|---|
| Supabase service-role / secret key | Create a new key in Supabase, update `API_ENV_FILE`, run `docker compose up -d --force-recreate api`, then revoke the old key. (With legacy JWT-based keys, rotating means rotating the JWT secret, which also changes the anon key used by the mobile apps. Plan an app release.) |
| Supabase JWT signing key | Rotate in Supabase (create a standby key, then rotate). The API reads the new public key from JWKS automatically. Users may need to sign in again. |
| Firebase service account | Create a new key in Google Cloud, update the env file, recreate `api`, then delete the old key. |
| Seed passwords | Change the head password after the first login. |

Rules: secrets go only in `API_ENV_FILE` (chmod 600), never in git, in images,
in `docker-compose.yml` or in build args. `NEXT_PUBLIC_*` values are public by design.

**Before go-live, delete all seed and demo data:** the users `manager@`,
`worker@` and `client@velanspaces.com` (Supabase Auth **and** the `users` table),
the project `VS-DEMO-001`, and any account that ever used the default password
the default seed password from `velan-backend/scripts/seed.ts`.

## 13. Go-live checklist

- [ ] Supabase: every migration applied (§3.2). Buckets exist, including `portfolio` (§3.3).
- [ ] Supabase Auth: **asymmetric JWT signing keys**, sign-ups **off**, minimum password length 8 (§3.4).
- [ ] The API env file has real keys, `TRUST_PROXY_HOPS=1`, Swagger off, and `CORS_ORIGINS` empty unless the Flutter web build needs it.
- [ ] Web built with `IMAGE_REMOTE_HOSTS=<exact Supabase host>`, the right `NEXT_PUBLIC_SITE_URL`, and the right `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (or none). `APP_URL` matches the real public origin.
- [ ] DNS points at the server. HTTPS works on the web and API domains, and HTTP redirects to HTTPS.
- [ ] `docker compose ps` shows `api` and `web` healthy, and the API health body says `"status":"ok"`.
- [ ] Ports 3000 and 3100 are **not** reachable from the internet (test from outside the server).
- [ ] Rate-limit test from §7 passes (per-IP, not global).
- [ ] Head can log in on the web and the mobile app. Each role lands on the right area. Uploads and images load.
- [ ] Seed and demo accounts and `VS-DEMO-001` are deleted (§12). The head password has been changed.
- [ ] Backups are configured and one restore has been tested (§11). The uptime monitor is set up (§9).
- [ ] The rollback tag is written down (the previous `IMAGE_TAG`).

## 14. Known gaps / follow-ups

- **Backend CI does not run.** `velan-backend/.github/workflows/backend-ci.yml` is
  nested inside `velan-backend/`. GitHub only runs workflows from the repository's
  root `.github/workflows/`. It also uses Node 20, while the image uses Node 22.
  TODO (owned by the mobile-migration session): move it to the root, and add a
  backend `docker build` job like `web-ci.yml`.
- **Dependency audit:** `npm audit --omit=dev` reports 1 critical and 8 high
  findings in the API's production dependencies, and 7 high in the web app (all
  from the `shadcn` CLI, which belongs in devDependencies). They need triage by
  reachability before go-live.
- **Content-Security-Policy:** only `frame-ancestors`, `base-uri` and `object-src`
  are set today. A nonce-based `script-src` CSP is a P1 follow-up.
- **Single instance only** until the API rate limiter and the Next.js cache are shared (§7, §10).
- Base images use the floating `node:22-alpine` tag. For reproducible builds, pin
  a digest with `--build-arg NODE_IMAGE=node:22-alpine@sha256:<digest>`.
