# SpruVex R — Pilot Launch Report v1

**Date:** 2026-07-13
**Scope:** Running SpruVex R with a small number of real restaurants and collecting feedback, ahead of commercial launch. Builds directly on `docs/LAUNCH_READINESS_REPORT.md` (Launch Preparation phase) — this report covers what changed since, and what's still needed before charging real customers money.

---

## 1. Demo / Trial Environment

| Item | Status |
|---|---|
| Full demo restaurant | ✅ `pnpm db:seed` provisions "مطعم التجربة" (Demo Restaurant) with a completed onboarding, one branch, and a trial subscription. |
| Menu data | ✅ 2 categories, 3 products (one with a recipe + a required size modifier group). |
| Tables | ✅ 1 floor, 4 tables, each with a real QR token. |
| Users & permissions | ✅ **Fixed this phase**: the seed previously only created `owner` + `cashier` accounts. Added a dedicated `kitchen`-role account (`kitchen@demo.spruvex.local`) — without it, the KDS screen silently degrades (no realtime push, "غير متصل" badge) when staffed with the cashier account, per the known issue flagged in the last report. Verified live: the new account's realtime subscribe now returns `{ok:true}` against the kitchen channel, where it previously returned `{ok:false, error:"forbidden"}` for the cashier account. |
| QR ready | ✅ QR tokens generated automatically per table; resolve correctly through the public ordering API (verified live, not just in the DB). |

Demo credentials (development/pilot only — rotate before any public exposure):
```
owner:   owner@demo.spruvex.local   / SpruVex-Demo1
cashier: cashier@demo.spruvex.local / SpruVex-Demo1  (POS PIN 1234)
kitchen: kitchen@demo.spruvex.local / SpruVex-Demo1
```

---

## 2. Production Deployment Verification

| Item | Result |
|---|---|
| Docker build (real environment) | ⚠️ **Still not build-verified in this sandbox.** Re-attempted with the Docker daemon actually running this time (`dockerd` started manually, both plain `docker build` and `--network host` per the sandbox's own troubleshooting guidance) — both fail identically at the base-image pull step: Docker Hub's CloudFront-backed blob storage returns `403 Forbidden` through this environment's egress proxy. This is a confirmed, reproducible **sandbox network policy limitation**, not a code defect — the correct action per the proxy's own guidance is to report it, not route around it. **This must be run for real in CI or on a real machine before the pilot's containers are ever built.** |
| **Platform Admin service missing from `docker-compose.prod.yml`** | 🔴 **Found and fixed.** The `platform` app (added in Phase 8) had no compose service at all — it could not have been deployed to production as the compose file stood. Added it, mirroring the dashboard/pos/kds pattern (port 8084), and documented that its domain should be network-restricted (VPN/IP-allowlist), not public marketing DNS, since it's SpruVex's internal ops console. |
| **CI docker-build job incomplete** | 🔴 **Found and fixed.** The CI job meant to catch a broken image before deploy only built api/dashboard/ordering — pos, kds, and platform were never build-verified by CI at all. Added the three missing build steps. |
| Production database | ✅ Migrations + seed re-verified end-to-end on a fresh database this phase (same method as the Launch Readiness Report: create a genuinely new DB, `migrate deploy` from zero, `db:seed`). Also caught and fixed a real permission gap of my own test setup (see note below) — not a product issue, but worth recording since it's exactly the kind of thing a real first deploy could trip on. |
| SSL/TLS | ✅ Already documented in `docs/DEPLOYMENT.md`: the shipped containers serve plain HTTP; a TLS-terminating reverse proxy/LB in front is required and explicitly called out as not included (platform-specific choice). No gap found. |
| Domains | ✅ Documented per-app domain list, now including the platform admin domain and its network-restriction requirement. |
| Environment variables | ✅ `.env.production.example` reviewed; added the new `SENTRY_DSN` (optional) entry. `env.validation.ts` still fails the app at boot if `JWT_SECRET`/`DATABASE_URL`/`ADMIN_DATABASE_URL` are missing — no gap. |
| Backups | 🔴 **Found and fixed.** The previous report's backup "procedure" was prose-only — no runnable script existed. Added `infra/scripts/backup-db.sh` (pg_dump wrapper, retention pruning, fails loudly on an empty dump) and **verified the full dump → restore round-trip directly** (restored into a scratch database, table count matched, zero errors). Still needs to actually run on a cron in the real production host — this repo can script it but can't schedule it for you. |

*Note on the permission gap found during my own verification*: when I manually created an ad-hoc test database this session (outside the documented `docker-compose.prod.yml`/init-script flow), I initially forgot the `GRANT`/`ALTER DEFAULT PRIVILEGES` step that `infra/postgres/init/02-databases.sh` performs automatically for the real `spruvex_r`/`spruvex_r_test` databases. This produced a real-looking "permission denied for table branches" error that briefly looked like a product bug. It was a gap in my manual test setup, not the actual deployment path — `02-databases.sh` already handles this correctly for real deployments. Flagging it here anyway because it's the exact kind of mistake someone deploying by hand (instead of through the documented init scripts) could make.

---

## 3. Pilot Monitoring

| Item | What was added |
|---|---|
| Error tracking | Optional Sentry integration (`shared/monitoring/sentry.ts`), wired into the existing `AllExceptionsFilter`. Fully inert unless `SENTRY_DSN` is set — zero behavior change, zero external calls by default. Confirmed the full API test suite (233 tests) still passes unchanged with this in place (Sentry never initializes in the test environment). |
| Basic usage monitoring | A structured one-line log per request — method, path, status, duration, request id — via `shared/monitoring/request-logging.middleware.ts`. Verified live: hitting `/health/ready` produced `GET /api/v1/health/ready 200 42.0ms rid=<uuid>` in the log. |
| Important logs | The request-id is also returned as an `X-Request-Id` response header, so a pilot customer's specific complaint ("my order didn't save at 2:15pm") can be traced to an exact log line, not just approximated by timestamp. 5xx responses log at `error` level regardless of whether they came from an unhandled exception or a handler that set the status directly. |

This is intentionally lightweight — no new metrics pipeline, no mandatory external dependency. It's enough to run a small, closely-watched pilot; a real APM/metrics stack is still a pre-commercial-scale recommendation (see §5).

---

## 4. Customer Trial Checklist

Delivered as `docs/PILOT_TRIAL_CHECKLIST.md` — Arabic, written for the pilot restaurant's own staff (not internal engineering), covering exactly the requested flow: account creation → branches → menu → QR printing → POS → KDS → a full customer-order test. It explicitly calls out the two operational gotchas found through live testing this project: **opening a shift before POS will record payments**, and **using a dedicated kitchen-role account on the KDS screen** (not the cashier account) for realtime updates to work.

---

## 5. Final Report

### جاهزية النظام (System readiness)

- The full business lifecycle (signup → menu → tables/QR → customer order → KDS → POS payment → receipt → reports → inventory deduction → billing usage) was already verified live end-to-end in the Launch Preparation phase and is unaffected by this phase's changes (233/233 API tests still pass).
- The demo/trial environment is now genuinely complete for a pilot: correct roles for every app (dashboard, POS, KDS), real QR codes, a working menu with inventory-linked recipes.
- Deployment artifacts (compose file, CI) had two real gaps — a missing production service and incomplete CI build coverage — both found and fixed this phase. Without this fix, the Platform Admin app specifically could not have been deployed at all.
- Backups went from "documented idea" to "runnable, tested script." Monitoring went from "structured error logs only" to "structured error logs + optional error tracking + basic per-request usage logging with correlation IDs."
- **The system is operationally ready to run a pilot with a small number of closely-watched restaurants**, provided the one remaining hard blocker below is cleared first.

### المشاكل المتبقية (Remaining issues)

1. 🔴 **Docker build is still unverified in any real environment.** This is the single hard blocker before the pilot's actual containers can be built and deployed — it must be run (and fixed if anything surfaces) in CI or on a real machine, not assumed from static review. Everything else in this report assumes that build succeeds; if it doesn't, nothing else here can be deployed as-is.
2. 🟡 **The onboarding wizard still doesn't offer a "kitchen" role.** Worked around for the demo tenant via the seed script, but every *real* pilot restaurant signing up through the actual onboarding flow will hit this exact gap themselves — they'll need to be told manually (via the trial checklist) to add a kitchen-role user from Team Management. Low effort, real product gap, not fixed this phase since it touches the onboarding UI (out of this phase's "no new features" scope) — flagged clearly for the next feature-permitted phase.
3. 🟡 **No automated backup schedule yet, only a tested script.** Someone has to actually put `infra/scripts/backup-db.sh` on a cron on the real production host before the pilot goes live with real customer data — the repo can't schedule this for you.
4. 🟡 **No metrics/APM dashboard.** Structured logs are sufficient for a small, hands-on-monitored pilot but won't scale to "watch a dashboard instead of grepping logs" — acceptable for now, a real gap before scaling past a handful of restaurants.
5. ⚪ Platform Admin subscriptions table still shows raw plan keys instead of localized names (cosmetic, internal-tool-only, carried over from the last report, still not fixed — genuinely low priority).

### توصيات قبل البيع التجاري (Recommendations before commercial launch)

1. **Run the real Docker build in CI or on a real machine immediately** — this is the one item in this entire pilot-readiness effort that could not be verified end-to-end here, and it gates everything else.
2. **Put the backup script on a cron and let it run for at least one full week before the first pilot restaurant's data matters** — a backup strategy is only real once it's been observed running unattended, not just tested once by hand.
3. **Add a "kitchen" role step to onboarding** before commercial launch (not required for a small, hand-held pilot where the trial checklist covers it manually, but not something to ship silently at commercial scale).
4. **Decide on and configure Sentry (or leave it off deliberately) before the pilot starts** — it's ready to flip on with one env var; don't let "we'll set it up later" become "we found out about a production bug from a customer complaint instead of a dashboard."
5. **Treat the pilot phase itself as the test of the backup/monitoring/rollback procedures**, not just the product features — the whole point of a pilot with a *few* real restaurants is to find operational gaps like the two found in this phase (missing platform service, missing CI coverage) while the blast radius of a mistake is still small.

No new product features were added in this phase, per the brief — every change here is deployment/operational infrastructure (a seed-data fix, two deployment-config gaps, monitoring hooks, and a backup script), consistent with "focus on real operation."
