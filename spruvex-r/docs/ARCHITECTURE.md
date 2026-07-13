# SpruVex R — Architecture Overview (as built)

This is a technical reference for the **current implementation** — what
modules exist and how they fit together. For product vision, market
positioning and the full roadmap, see
`docs/SpruVex_R_Product_Architecture_Plan.md`.

## 1. System shape

Modular monolith (NestJS) — one deployable API, one PostgreSQL database,
domain modules kept internally decoupled via domain events rather than
split into microservices. Five frontends consume the same API:

```
apps/
  api/         NestJS modular monolith (all domains, single deploy unit)
  dashboard/   Owner/manager console (menu, tables, staff, reports, billing)
  pos/         Cashier POS (touch-first)
  kds/         Kitchen display (realtime)
  ordering/    Customer QR / pickup ordering (Next.js SSR, public)
  platform/    SpruVex ops console (cross-tenant, separate auth plane)
```

## 2. Backend module map (`apps/api/src/`)

```
modules/
  identity/     registration, OTP, login/refresh/logout, account lockout
  tenancy/      tenant provisioning, onboarding wizard, branch/team settings
  catalog/      categories, products, modifiers, branch availability
  tables/       floors, tables, QR generation, table sessions
  ordering/     order state machine, guest (QR/pickup) ordering, checkout
  shifts/       cashier shifts, cash movements, reconciliation
  payments/     payments (split/partial), receipts, ZATCA QR (TLV)
  inventory/    ingredients, stock locations/levels/movements, recipes, food cost
  reports/      sales, operations, financial, dashboard summary
  billing/      plan catalog, subscription view/change (no payment gateway yet)
  platform/     cross-tenant ops console: tenants, subscriptions, system status

shared/
  tenancy/      TenantContextService (AsyncLocalStorage), RLS-aware Prisma client
  rbac/         @RequirePermission()/@Public()/@RequireAuthenticated(), PermissionsGuard
  billing/      TenantAccessGuard (account-standing gate), LimitsService (plan limits)
  security/     global rate limiting (ThrottlerGuard)
  audit/        append-only audit log service
  events/       NestJS EventEmitter2 wiring; DOMAIN_EVENTS catalog in @spruvex-r/types
  realtime/     Socket.io gateway + Redis adapter (KDS/POS live updates)
  errors/       global exception filter (safe error responses + server-side logging)
  common/       money (halalas/cost-units, never float), pagination, misc utils
  prisma/       PrismaService (tenant-scoped), PlatformPrismaService (BYPASSRLS)
```

**Rules enforced throughout:**
- Every endpoint declares `@RequirePermission(...)` or `@Public()` or
  `@RequireAuthenticated()` explicitly — `PermissionsGuard` denies anything
  undeclared. No implicit trust.
- Every tenant-owned table has `tenant_id`; every write goes through
  `PrismaService.scoped` / `scopedTransaction`, never a raw/base client.
- Money is integer halalas (2-decimal SAR) or, for ingredient/recipe costing,
  integer "cost units" (4-decimal SAR) — never a float.
- Idempotency-Key is required on order and payment creation.
- Cross-module reactions go through domain events (`@nestjs/event-emitter`),
  not direct service-to-service calls — e.g. Inventory's automatic stock
  deduction reacts to `order.status_changed`, it doesn't import Ordering.
  (Plan-limit enforcement is the deliberate exception: it's a synchronous
  precondition check, not a reaction, so `LimitsService` is injected directly
  into Ordering/Tenancy — see §5.)

## 3. Multi-tenant isolation (three layers)

1. **JWT-derived tenant_id.** `tenant_id`/`permissions` come from the signed
   access token only, set by `AuthContextMiddleware` into an
   `AsyncLocalStorage`-backed `TenantContextService`. Client-supplied
   tenant/branch ids are never trusted.
2. **Prisma tenant-scoped client.** `PrismaService.scoped` wraps every query
   in a transaction that first runs
   `SET_CONFIG('app.current_tenant_id', <tenantId>, true)`; `scopedTransaction`
   does the same for multi-statement writes.
3. **PostgreSQL Row-Level Security** — the last line of defense. The API
   connects as `spruvex_app` (`NOBYPASSRLS`); every tenant table has
   `ENABLE/FORCE ROW LEVEL SECURITY` plus a `tenant_isolation` policy
   comparing `tenant_id` to the session's `app.current_tenant_id`. A query
   that forgets tenant scoping returns *nothing*, not someone else's data.
   Migrations/seeds run as `spruvex_admin` (`BYPASSRLS`).

`PlatformPrismaService` is a **separate, intentional** BYPASSRLS connection
used only by: identity bootstrap (pre-tenant), tenant provisioning, and the
platform admin module — anywhere cross-tenant access is the actual job, not
a bug. Business modules must never inject it.

## 4. Two separate auth planes

| | Tenant users (owner/manager/cashier/waiter/kitchen) | Platform admins |
|---|---|---|
| Login | `POST /auth/login` | `POST /platform/auth/login` |
| Token claim | `type: "access"`, carries `tenant_id` + `permissions[]` | `type: "platform_admin"`, no tenant claim |
| Session | Access token (15 min) + rotating refresh token (reuse-detection) | Single access token (8h), re-login after |
| Authorization | `@RequirePermission()` + `PermissionsGuard` (RBAC) | `PlatformAdminGuard` only — completely separate from tenant RBAC |
| Storage | `users` / `role_permissions` (tenant-scoped) | `platform_admins` (global, no self-registration) |

**Why a tenant token can never reach `/platform/*` and vice versa:**
`AuthContextMiddleware` only populates the tenant `AsyncLocalStorage` context
for `type: "access"` tokens — a platform token leaves it empty, so
`PermissionsGuard`'s `contextOrThrow` rejects it (401) before any tenant
endpoint runs. `PlatformAdminGuard` independently requires `type:
"platform_admin"` and re-checks the admin is still active on every request.
Platform controllers are `@Public()` (so the tenant RBAC guard doesn't reject
them for lacking a permission) and rely solely on `PlatformAdminGuard`.

## 5. SaaS billing & the account-standing gate

- `plans` (global catalog: Basic/Pro/Growth — branches/users/orders-per-month
  limits, monthly price) and `subscriptions` (one per tenant: status,
  trial end date, current period) — see `docs/DATABASE.md`.
- Every new tenant gets a 14-day trial of the default plan at provisioning
  time (`tenant-provisioning.ts`, same transaction as the tenant/roles/branch).
- `LimitsService` (`shared/billing/limits.service.ts`) checks branch/user/
  monthly-order counts against the plan before Tenancy/Ordering create them.
  Deliberately a direct call, not an event — a limit check has to block the
  action, not react after it happened.
- `TenantAccessGuard` (`shared/billing/tenant-access.guard.ts`), a global
  guard, blocks **write** requests (GETs stay open) when a tenant is
  suspended, or its subscription is `suspended`/`cancelled`, or its trial has
  expired — returns `402 Payment Required`. The Billing controller itself is
  `@BillingExempt()` so a blocked tenant can always see why and change plan.
- No payment gateway is wired yet — activation is manual (bank transfer),
  matching the product plan's MVP decision. `Subscription.externalCustomerId`
  / `externalSubscriptionId` and `SubscriptionInvoice` exist so a gateway
  (Stripe/Moyasar/Tap) can be added later without a schema migration.

## 6. Realtime

Socket.io gateway with a Redis pub/sub adapter (falls back to in-memory if
`REDIS_URL` is unset/unreachable — fine for one instance and for tests).
Rooms are per-branch; KDS and POS subscribe to `order.created` /
`order.status_changed` events pushed from the Ordering module.

## 7. Background jobs

There is **no queue worker running today** — `BullMQ` is an approved part of
the stack (see the product plan) but nothing has needed it yet; all
processing (discount math, stock deduction, receipt generation) is
synchronous within the request or the in-process `EventEmitter2`. If a
genuinely slow job appears (bulk exports, scheduled subscription transitions,
outbound webhooks), introduce a BullMQ queue in `shared/queue/` at that
point rather than pre-building an empty abstraction.

## 8. Monitoring foundation

- `GET /health` — liveness (process up, no dependency checks).
- `GET /health/ready` — readiness: pings the database (fatal — flips overall
  status to `degraded`) and Redis (best-effort, reported but non-fatal).
- `shared/errors/all-exceptions.filter.ts` — global exception filter. Known
  `HttpException`s pass through unchanged; anything else is logged in full
  server-side (message + stack) but the client only ever sees a generic 500.
- Rate limiting (`shared/security/security.module.ts`): a global per-IP
  limit (120 req/min) plus tighter overrides on auth endpoints
  (login/register/OTP: 10–30/min) and platform login (20/min).

## 9. Known trade-offs / things to revisit before scaling far past MVP

- Rate limiting and the account-standing check both add one DB round trip
  per gated request; fine at current scale, worth caching if request volume
  grows a lot.
- Platform admin sessions have no refresh-token rotation (single 8h token) —
  acceptable for a small internal ops team, revisit if that team grows or if
  compliance requires shorter-lived + rotated sessions.
- The `tenant_id` column-level `DEFAULT` (a convenience on top of RLS) only
  exists on tables added from Phase 7 onward; earlier tables rely on RLS's
  `WITH CHECK` alone (still a real enforcement boundary, just without the
  auto-fill convenience). Every Prisma migration that touches an RLS table
  re-diffs and drops that DEFAULT (Prisma can't see raw-SQL defaults
  declaratively) — the fix is always a new migration restoring it, never an
  edit to an already-applied one (see `prisma/migrations/*/migration.sql`
  history for the pattern).
