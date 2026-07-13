# SpruVex R — Deployment Guide

> The Dockerfiles and compose file referenced here were written to standard
> pnpm-workspace/NestJS/Next.js conventions but have **not been build-verified
> in a real Docker environment** (this repo was developed in a sandbox
> without a Docker daemon). Run `docker compose -f docker-compose.prod.yml
> build` yourself (or let CI's `docker-build` job do it) before the first
> real deploy, and treat this guide as a reviewed-but-unproven starting
> point rather than a battle-tested runbook.

## Topology

```
                    ┌──────────────┐
                    │   Postgres   │
                    └──────┬───────┘
                           │
┌──────────┐        ┌──────▼───────┐        ┌───────┐
│ dashboard│───────▶│              │◀───────▶│ Redis │
│ pos      │───────▶│  api (Nest)  │        └───────┘
│ kds      │───────▶│  port 3000   │
│ ordering │───────▶│              │
│ platform │───────▶└──────────────┘
└──────────┘
```

Each frontend SPA (dashboard/pos/kds/platform) is served by its own Nginx
container, which also reverse-proxies `/api/*` and `/socket.io/*` to the
`api` service — see `infra/docker/spa.nginx.conf`. This keeps every
frontend's existing relative `/api/v1` base URL working unchanged in
production. `ordering` is Next.js SSR and talks to the API directly
server-side (`API_ORIGIN`) plus client-side for realtime order tracking
(`NEXT_PUBLIC_API_ORIGIN`).

## One-time setup

1. **DNS / TLS**: point your domains (e.g. `app.`, `pos.`, `kds.`, `order.`,
   `admin.` yourdomain.com) at the host(s) running these containers. This
   repo's compose file exposes plain HTTP on host ports (8081-8084, 3000,
   3002) — put a TLS-terminating reverse proxy or load balancer (Caddy, an
   existing Nginx, your cloud LB) in front for production; it is **not
   included** here since that choice is platform-specific. Keep the
   `platform` (port 8084) domain off any public-facing marketing DNS/CDN and
   restrict it at the network layer (VPN, IP allowlist, or auth at the LB) —
   it's SpruVex's own ops console, not customer-facing.
2. **Secrets**: copy `.env.production.example` to `.env.production` and fill
   in every value — see `docs/ENVIRONMENT.md` for what each one means and
   how to generate it. Never commit this file.
3. **Database role passwords**: `infra/postgres/init/01-roles.sql` ships
   with dev-only hardcoded passwords. Either edit that file to use the same
   values as `SPRUVEX_APP_PASSWORD`/`SPRUVEX_ADMIN_PASSWORD` in
   `.env.production` before the Postgres container's first boot, or run
   `ALTER ROLE spruvex_app PASSWORD '...'` / `ALTER ROLE spruvex_admin
   PASSWORD '...'` once against a running instance.

## Build & start

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production build
docker compose -f docker-compose.prod.yml --env-file .env.production up -d postgres redis
# wait for both to report healthy, then:
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api \
  node_modules/.bin/prisma migrate deploy
docker compose -f docker-compose.prod.yml --env-file .env.production run --rm api \
  node_modules/.bin/prisma db seed
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Migrations and seeding run as **one-off commands**, not as part of the
`api` container's normal startup — this avoids every replica racing to run
`migrate deploy` simultaneously if you ever scale `api` beyond one instance.

## Migration workflow in production

- Always `prisma migrate deploy` — never `migrate dev` (which can generate
  new migrations interactively) against a production database.
- Migrations apply in order and are idempotent to re-run (already-applied
  ones are skipped) — safe to run on every deploy as a pre-step.
- If a migration fails partway, **do not** edit the migration file to "fix"
  it — see `docs/DATABASE.md`'s migration workflow section. Roll forward
  with a new migration, or restore from backup if the database is in a bad
  state.

## Health checks

- `GET /api/v1/health` — liveness (process up).
- `GET /api/v1/health/ready` — readiness (database + Redis); returns `503`
  if the database is unreachable. Point your load balancer / orchestrator's
  readiness probe here, and the liveness probe at `/health`.
- Each container also has a Docker `HEALTHCHECK` (see the Dockerfiles) for
  `docker compose ps` / orchestrator-level restarts.

## Monitoring (pilot launch)

- **Request logs**: every API request logs one structured line —
  `METHOD path status durationMs rid=<uuid>` — via
  `shared/monitoring/request-logging.middleware.ts`. The response also
  carries an `X-Request-Id` header (or echoes one you send), so a specific
  slow/failed request reported by a pilot customer can be found by grepping
  its `rid` in the logs.
- **Error tracking (optional)**: set `SENTRY_DSN` in `.env.production` to
  have every unhandled exception / 5xx captured by Sentry
  (`shared/monitoring/sentry.ts`). Leave it blank and nothing changes — no
  external calls are made, this is opt-in. Server-side stack traces are
  always logged locally regardless (`AllExceptionsFilter`), so Sentry is a
  convenience for alerting/aggregation, not the only record of an error.
- **Usage signal**: with no separate metrics pipeline yet, the request log
  above doubles as the pilot's usage monitoring — grep/aggregate it for
  request volume, error rate, and slow endpoints during the trial. Revisit
  with real metrics (Prometheus/Grafana or a hosted APM) before scaling
  past a hands-on-monitored pilot.

## CI/CD

`.github/workflows/ci.yml` runs on every push/PR to `main`:
1. `ci` job — installs deps, sets up the test database roles, generates the
   Prisma client, then runs `build`, `lint`, `typecheck`, `test` across the
   whole monorepo (Turborepo).
2. `docker-build` job — builds the API image, the dashboard SPA image, and
   the ordering (Next.js) image as a build-only sanity check (no push). This
   is the first line of defense against a broken production Dockerfile —
   extend it to the other SPA images if you want full coverage.

Neither job pushes images anywhere or deploys — wire a deploy step (push to
a registry, trigger your platform's rollout) once you've picked a target
(a single VM via `docker compose`, or a managed container platform).

## Rollback

- **App code**: redeploy the previous image tag — the containers are
  stateless.
- **Database**: Prisma migrations are forward-only by design (no generated
  "down" migrations). Rolling back a schema change means either writing a
  new forward migration that reverses it, or restoring from a pre-migration
  backup (see `docs/DATABASE.md`'s backup section) — decide which based on
  whether data was written under the new schema since the migration ran.

## Scaling notes (not needed at MVP scale, useful later)

- The API is stateless per request (tenant context lives in
  `AsyncLocalStorage` for the duration of one request only) — safe to run
  multiple replicas behind a load balancer, **provided `REDIS_URL` is set**
  so Socket.io fan-out works across instances (without it, KDS/POS realtime
  updates only reach clients connected to the same replica).
- Rate limiting (`ThrottlerGuard`) currently tracks per-process in-memory
  counters — fine for one replica; for multiple replicas behind a shared
  rate limit, switch to `@nestjs/throttler`'s Redis storage adapter.
- Postgres connection pooling: Prisma opens its own pool per process; if you
  scale API replicas significantly, put PgBouncer (or your managed
  Postgres's built-in pooler) in front rather than letting each replica's
  pool grow unbounded.
