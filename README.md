# SpruVex R — Restaurant Operating System

SaaS Restaurant OS for Saudi Arabia & GCC: POS, digital menu, QR table ordering,
kitchen display, shifts & cash, reports — Arabic-first (RTL) and ZATCA-ready.

> Independent product: separate database, backend, dashboards and green brand
> identity (see `brand/`). Full plan: `docs/SpruVex_R_Product_Architecture_Plan.md`.

## Stack

NestJS (modular monolith) · Prisma · PostgreSQL 16 (Row-Level Security) ·
Redis + BullMQ · Socket.io · React + Tailwind + shadcn/ui · Next.js (customer
ordering) · Turborepo + pnpm.

## Repository layout

```
apps/
  api/          NestJS API (modular monolith)
  dashboard/    Restaurant dashboard — React SPA (green theme, ar/en RTL-first)
  pos/          Cashier POS — React SPA (touch-first)
  kds/          Kitchen display — React SPA (realtime via Socket.io)
  ordering/     Customer QR/pickup ordering — Next.js SSR
  platform/     SpruVex ops console (cross-tenant) — React SPA, separate auth plane
packages/
  types/        Shared domain types, permission catalog, role defaults, plan catalog
  ui/           Design-system components (shadcn-style, SpruVex R green theme)
  config/       Shared tsconfig / eslint / tailwind preset
infra/
  postgres/     Database role bootstrap (RLS roles)
  docker/       Production Dockerfiles/nginx config for the frontend SPAs
brand/          Logo assets and palette
docs/           Architecture, database, deployment, environment and admin docs
```

See `docs/ARCHITECTURE.md` for the current module map, `docs/DEPLOYMENT.md`
for production setup, and `docs/ADMIN_GUIDE.md` for the platform console.

## Getting started

Prerequisites: Node ≥ 20, pnpm 10, Docker (or a local PostgreSQL 16).

```bash
pnpm install
docker compose up -d          # Postgres 16 + Redis; creates roles & databases
cp .env.example .env
pnpm --filter @spruvex-r/api prisma:generate
pnpm db:migrate:deploy        # apply migrations (runs as spruvex_admin)
pnpm db:seed                  # permission catalog + demo restaurant
pnpm --filter @spruvex-r/api dev
# GET http://localhost:3000/api/v1/health

pnpm --filter @spruvex-r/dashboard dev
# http://localhost:5173 — proxies /api to the API
```

Run everything (build, lint, typecheck, tests):

```bash
pnpm build && pnpm lint && pnpm typecheck && pnpm test
```

Tests use the dedicated `spruvex_r_test` database (created by the compose init
scripts) and include the multi-tenant isolation suite that proves cross-tenant
reads/writes are blocked by RLS.

## Multi-tenancy model (enforced in three layers)

1. `tenant_id` comes from the JWT only — never from client parameters.
2. Every query goes through the tenant-scoped Prisma client, which sets
   `app.current_tenant_id` (transaction-local) on each operation.
3. PostgreSQL Row-Level Security is the last line of defense. The API connects
   as `spruvex_app` (NOBYPASSRLS): a query that forgets tenant scoping returns
   nothing instead of leaking data. Migrations/seeds run as `spruvex_admin`.

Other non-negotiable rules (see plan §14): explicit `@RequirePermission()` on
every endpoint (deny by default), append-only invoices & audit log, money as
NUMERIC/halalas (never float), Idempotency-Key on order/payment creation,
domain events between modules, i18n (ar/en) with RTL default.

## Demo credentials (development seed)

| Role    | Email                       | Password      | POS PIN |
|---------|-----------------------------|---------------|---------|
| Owner   | owner@demo.spruvex.local    | SpruVex-Demo1 | —       |
| Cashier | cashier@demo.spruvex.local  | SpruVex-Demo1 | 1234    |

Set `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD` before running
`pnpm db:seed` to also bootstrap a platform admin account (`apps/platform`,
port 5177 in dev) — there is no self-registration for that role.

## Production deployment

See `docs/DEPLOYMENT.md` for the full runbook (Docker Compose setup,
environment variables, migration workflow, backup strategy) and
`docs/ARCHITECTURE.md` / `docs/DATABASE.md` for the system design.
