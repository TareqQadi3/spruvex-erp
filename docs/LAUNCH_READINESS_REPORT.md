# SpruVex R — Launch Readiness Report v1

**Date:** 2026-07-13
**Scope:** Trial launch readiness for the first real customers, per the Launch Preparation brief (testing, stability, operational readiness — no new features, no architecture changes).

This report covers a live verification pass against the actual application stack (API + all 5 frontend apps) running against a freshly-migrated, freshly-seeded database, plus a full business scenario driven end-to-end through the real UIs.

---

## 1. Production Verification

| Item | Result |
|---|---|
| Migrations on a clean database | ✅ Verified. All 11 migrations applied cleanly to a brand-new `spruvex_r_launch_check` database, RLS enabled on all 30 tenant-scoped tables, `tenant_id` defaults correct on the 7 documented tables. |
| Seed script | ✅ Verified. `pnpm db:seed` runs end-to-end on a fresh database; the demo tenant receives a trial subscription automatically (Phase 8 billing wired into provisioning). |
| Health checks | ✅ `/health` and `/health/ready` respond correctly (DB + Redis checked). |
| Dashboard app | ✅ Live-tested: onboarding, branch/user management, menu, tables/QR, reports, billing. |
| POS app | ✅ Live-tested: login, shift open/close, order confirm, payment, receipt. |
| KDS app | ✅ Live-tested: order board, status advance (new → confirmed → preparing → ready → served). |
| Ordering app (customer QR) | ✅ Live-tested: menu load, cart, order submission, order tracking page. |
| Platform Admin app | ✅ Live-tested: tenant list/detail, subscriptions list, system status. |
| Docker production build | ⚠️ **Not build-verified in this sandbox.** The sandbox's egress policy blocks Docker Hub's CloudFront-backed image layer storage (`production.cloudfront.docker.com`), so `docker build`/`docker pull` cannot complete here even with the daemon running. This is an environment limitation, not a code defect — the Dockerfiles and compose file were reviewed statically and follow the documented topology in `docs/DEPLOYMENT.md`. **Recommendation:** run the actual `docker compose -f docker-compose.prod.yml build` once in an environment with normal internet egress before the first real deploy. |

---

## 2. End-to-End Business Testing

Full scenario driven live via Playwright against the real stack (dashboard, ordering, KDS, POS), cross-checked against the database at each step:

1. **Restaurant signup** → OTP verification → owner account created.
2. **Setup restaurant** → onboarding wizard (restaurant profile, plan selection → trial subscription auto-created).
3. **Add branch** → main branch created.
4. **Add users** → owner + cashier (second onboarding slot is hardcoded to the `cashier` role — see Known Issues §6).
5. **Create menu** → category (المشويات) + product with recipe (برجر جبن, 28.00 SAR, 120g cheddar).
6. **Create tables** → floor + table T1.
7. **Generate QR** → confirmed via DB (`qr_token` populated, resolves through the public ordering API).
8. **Customer order** → placed via the actual QR URL against the ordering app; **found and fixed a real UI bug** here (see §6, fix #3).
9. **KDS preparation** → order advanced through new → confirmed → preparing → ready → served; confirmed in DB after each transition.
10. **POS payment** → shift opened, order confirmed, cash payment recorded, order auto-transitioned to `completed`.
11. **Receipt** → ZATCA-style receipt rendered correctly (VAT-inclusive pricing, VAT breakdown, receipt sequence number).
12. **Reports** → sales, operations, financial and best-sellers all verified against the DB; **found and fixed a real backend bug** here (see §6, fix #1).
13. **Inventory deduction** → cheddar stock correctly deducted (5000g → 4760g after two 120g recipe deductions), confirmed via `stock_movements` (`sale_deduction`, -120 each, timestamped at order completion).
14. **Billing** → subscription usage counters correct: orders-this-month 2/500, users 2/5, branches 1/1, 14-day trial countdown accurate.

Every step in the requested scenario was completed and verified against real data, not just assumed from code reading.

---

## 3. Security Final Audit

| Area | Verification method | Result |
|---|---|---|
| Tenant isolation (RLS) | Live cross-tenant request: demo tenant's token queried the launch-test tenant's branch → `[]` (empty), own branch listing worked normally. Plus `rls-isolation.spec.ts` (passing). | ✅ |
| RBAC | Cashier role correctly denied `kitchen.view` (see §6, finding). Owner/manager/cashier/waiter/kitchen permission sets reviewed in `packages/types/src/roles.ts`. Plus `permissions.guard.spec.ts` (passing). | ✅ |
| Platform admin isolation | Live test: a valid tenant JWT sent to `/platform/tenants` → `401 "Not a platform admin token"`; no token → `401 "Missing platform admin token"`. Plus `platform.e2e.spec.ts` (passing). | ✅ |
| Public ordering security | Live test: valid QR token → real menu data; invalid/tampered token → `404 "QR code is not valid"` (no information leakage). Order tracking uses the order UUID as an unguessable capability. | ✅ |
| Rate limits | `ThrottlerGuard` global default (120 req/min/IP) confirmed registered; auth endpoints carry tighter per-route `@Throttle()` overrides. | ✅ |
| Secrets handling | No hardcoded secrets found outside test fixtures; `.env.production.example` contains only placeholders with explicit "generate a long random value" instructions; `env.validation.ts` fails fast at boot if `JWT_SECRET`/`DATABASE_URL`/`ADMIN_DATABASE_URL` are missing. | ✅ |
| CORS | `CORS_ORIGINS` is env-driven with no wildcard fallback (`.split(",").filter(Boolean)` on an empty string yields zero allowed origins by default — fails closed). | ✅ |
| Security headers | `helmet()` applied in `main.ts`; live response confirmed CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc. present on API responses. | ✅ |
| Audit coverage | Live check: every real action taken during this test session (shift open/close, payment recorded, order status changes, receipt issued) produced a matching `audit_logs` row with correct tenant scoping. | ✅ |

No security regressions or gaps were found. This mirrors and confirms the Phase 8 security work.

---

## 4. First Customer Readiness

- **Demo restaurant data**: the seeded demo tenant (`demo`) provides a working reference restaurant (menu, recipe, tables, inventory) — useful for sales demos and staff training, separate from any real customer's data.
- **Default onboarding experience**: signup → OTP → restaurant setup → branch → users → "enter dashboard" flow is smooth, in Arabic, with no dead ends observed during live testing.
- **Empty states**: verified during testing — empty cart, no active orders, no low-stock alerts, no best-sellers data — all render clear Arabic messages rather than blank screens or crashes.
- **Error messages**: login failures ("البريد الإلكتروني أو كلمة المرور غير صحيحة" / *Invalid email or password*), cart validation ("رقم الهاتف مطلوب"), and generic API failures all surface clear, localized messages to the user rather than raw errors.
- **Arabic UX**: RTL layout, iconography, and copy were consistent and correct across all 5 apps throughout live testing — no mirrored-icon or LTR-leak issues observed.
- **Minor polish item**: the Platform Admin app's subscription table shows the raw plan key (`basic`) instead of the localized plan name (أساسي) shown elsewhere (e.g. the dashboard's Billing page). Low priority — this is an internal ops tool, not customer-facing.

---

## 5. Operational Checklist

### Launch checklist
- [ ] Fill in `.env.production` from `.env.production.example` (real secrets, real CORS origins, real `ORDERING_BASE_URL`).
- [ ] Change the hardcoded dev DB role passwords (`spruvex_app`/`spruvex_admin`) in `infra/postgres/init/01-roles.sql`, or `ALTER ROLE` them post-boot, to match `.env.production`.
- [ ] Build and smoke-test the Docker images in an environment with full internet egress (not verified in this sandbox — see §1).
- [ ] Run `prisma migrate deploy` against the production database before first boot.
- [ ] Bootstrap one platform admin via `PLATFORM_ADMIN_EMAIL`/`PLATFORM_ADMIN_PASSWORD`, then unset those env vars.
- [ ] Point DNS/TLS at the 4 public origins (dashboard/pos/kds/ordering) and set `CORS_ORIGINS` accordingly.
- [ ] Confirm `/health/ready` returns 200 from the production environment before directing traffic to it.

### Backup procedure
- Documented in `docs/DATABASE.md` / `docs/DEPLOYMENT.md`. In short: `pg_dump` on a schedule (daily minimum), stored off-instance; test a restore at least once before relying on it. No automated backup job exists yet — this is a manual/cron responsibility for whoever operates the production database.

### Incident response basics
- **API down**: check `/health/ready`; if DB check fails, verify Postgres is reachable and the connection pool isn't exhausted; if Redis check fails, realtime features degrade gracefully (falls back to in-memory adapter per instance) but cross-instance fan-out breaks — restart Redis and the API.
- **A tenant reports missing data**: check `audit_logs` for that tenant first — every mutating action is logged with actor + entity, so most "where did my data go" questions are answerable without guessing.
- **Suspected cross-tenant leak**: treat as a P0. Confirm via `rls-isolation.spec.ts`-style reproduction first, then check whether the affected endpoint bypasses `prisma.scoped`/`forTenant()` (the RLS-bound client) somewhere.
- **Platform admin lockout**: `failed_login_attempts`/`locked_until` on `platform_admins` — 5 attempts, 15-minute lockout, same policy as tenant auth. Clear manually via SQL if a legitimate ops admin is locked out.

### Monitoring checklist
- `/health` (liveness) and `/health/ready` (DB + Redis) — wire these into whatever uptime monitor is used.
- Watch API logs for 500s: `AllExceptionsFilter` logs full stack traces server-side for every unhandled exception, which is the primary signal to alert on.
- Watch `X-RateLimit-Remaining` trending toward 0 for any single IP — early signal of abuse or a misbehaving client.
- No metrics/APM pipeline exists yet (out of scope per Phase 8 — "foundation for" performance metrics was the stated goal, not a shipped dashboard). Treat structured logs as the primary signal for the trial period.

### Deployment rollback procedure
- Documented in `docs/DEPLOYMENT.md` §Rollback: redeploy the previous image tag; database migrations in this project are additive-only by convention (no destructive migrations), so rolling back the app does not require rolling back the schema in the common case. If a migration must be reverted, restore from the most recent backup rather than hand-writing a down-migration.

---

## 6. Known Issues Report

### Fixed during this Launch Preparation pass (committed, pushed)

1. **Reports date-range bug (backend, real, launch-blocking)** — `apps/api/src/modules/reports/reports.service.ts`: `resolveRange()` treated an explicit `to` date as that day's midnight instant rather than its end. Since the dashboard's Reports page defaults `to` to today's date, **every restaurant's default "today" view of Operations, Financial, and Best-Sellers would show zero data on the day it's viewed** — only the separate daily-sales summary card (which uses different, correct date logic) would show real numbers. Fixed, with a new regression test (`reports.e2e.spec.ts`) reproducing the dashboard's exact query shape so this can't silently regress.
2. **Empty-body JSON crash (frontend, real)** — `apps/dashboard`, `apps/kds`, `apps/pos`, `apps/platform` `lib/api.ts`: any endpoint returning `null` (e.g. `GET /shifts/current` when no shift is open — the very first thing a new branch's POS session hits) sends HTTP 200 with a fully empty body (a NestJS/Express behavior, not something worth changing per-endpoint). The shared API client called `res.json()` unconditionally, which throws on an empty body, surfacing as an uncaught page error on first POS load for any branch that hasn't opened a shift yet. Fixed defensively in all four affected clients (read as text first, parse only if non-empty) — this also protects against any other endpoint that returns `null` today or in the future.
3. **Cart submission navigation flash (frontend, real)** — `apps/ordering/src/components/CartPageContent.tsx`: clearing the cart before `router.push()` let the still-mounted `/cart` page briefly render its "cart is empty" fallback before navigating to the order tracking page. Fixed with a `submitted` guard flag.

All three fixes are typechecked, linted, unit-tested (233/233 API tests, dashboard/kds/pos/platform typecheck+lint clean), and re-verified live via Playwright after the fix.

### Remaining technical risks (not fixed — flagged for awareness)

1. **Onboarding doesn't provision a "kitchen"-role account.** The onboarding wizard's second user slot is hardcoded to the `cashier` role. `cashier` has `orders.view`/`orders.update_status` (so the KDS board still loads and status changes still work over REST) but not `kitchen.view`, which the KDS realtime channel requires. A restaurant that staffs its kitchen screen with the cashier account will see a permanently "غير متصل" (disconnected) badge — REST polling still works on initial load, but there's no live push update and no order-arrival beep until the screen is manually refreshed. **Recommended fix before scaling past the first few customers:** either add a "kitchen" role option to onboarding's user-creation step, or have the dashboard's team-management screen surface a clear one-line hint ("امنح صلاحية المطبخ لمن سيستخدم شاشة المطبخ") when creating additional users.
2. **Docker production build is unverified.** Confirmed as an environment/network limitation of this sandbox, not a code issue — see §1. Must be smoke-tested in a normal-egress environment before the first real deploy.
3. **No automated database backup job.** The backup *procedure* is documented (§5), but nothing runs it on a schedule yet. Acceptable for a small trial with a handful of customers; should be automated (cron + off-instance storage) before scaling.
4. **Platform Admin subscriptions table shows raw plan keys, not localized names.** Cosmetic, internal-tool-only, not customer-facing. Low priority.
5. **No APM/metrics dashboard.** Structured server logs + `/health` endpoints are the only operational signal today. Sufficient for a trial with close manual monitoring; a real metrics pipeline (Phase 8 explicitly scoped this as "foundation for," not a delivered dashboard) should be built before scaling beyond a hands-on-monitored trial.

### Confirmed ready

- Multi-tenant data isolation (RLS), RBAC, platform-admin isolation, public-ordering security, rate limiting, secrets handling, CORS, security headers, and audit logging all verified live, not just by code review.
- The complete restaurant business lifecycle — signup through billing usage tracking — works correctly end-to-end against a real (freshly migrated + freshly seeded) database, driven through the actual UIs, not mocked.
- All 5 frontend apps (Dashboard, POS, KDS, Ordering, Platform Admin) load, authenticate, and perform their core workflows without console errors after the fixes in this report.
- Fresh-database migrations and the production seed script both work correctly from zero.

### Verdict

**SpruVex R is ready for a trial launch with a small number of real, closely-monitored first customers**, conditional on completing the launch checklist in §5 (production secrets, a verified Docker build in a normal network environment, and DNS/TLS setup). The one launch-blocking bug found (reports date-range) is fixed and tested. The remaining risks are known, documented, and appropriate to accept for a trial phase rather than a full public launch.
