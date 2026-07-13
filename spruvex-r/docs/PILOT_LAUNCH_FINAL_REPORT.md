# SpruVex R — Pilot Launch Final Report

**Date:** 2026-07-13
**Scope:** Closing out every remaining item blocking a real pilot launch, per the final Pilot Launch request — production blockers, Docker deployment on a real environment (if available), CI/CD, backups, secrets/domains/TLS, and smoke-test fixes. No new modules or features added; every change in this closing pass is deployment/operational correctness.

---

## حالة النظام (System status)

The product itself (business logic, security model, all 5 apps) has now been verified live across three separate testing passes (Launch Preparation → Pilot Launch → this closing pass) and remains fully green: **233/233 API tests, full monorepo build/lint/typecheck clean, zero console errors across a fresh live smoke test of all 5 apps** (dashboard, POS, KDS, ordering, platform) run against a genuinely new database in this closing session.

What changed in *this* pass is entirely deployment/operational: two more real, previously-undetected production blockers were found and fixed (one of which would have broken the customer-facing ordering app in production), plus a real secrets-handling gap in version control. Docker was re-attempted on this session's real Docker daemon and confirmed, a second time, to be blocked purely by this sandbox's network policy — not a code issue.

---

## ما تم إنجازه (What was accomplished)

### 1. Production blockers closed

| # | Blocker | Found | Fixed |
|---|---|---|---|
| 1 | 🔴 **Ordering app's API origin never wired in production.** `docker-compose.prod.yml` set `NEXT_PUBLIC_API_BASE_URL`, a variable nothing in the app reads. The two variables it actually needs (`API_ORIGIN` for server-side SSR calls, `NEXT_PUBLIC_API_ORIGIN` for the client-side realtime order-tracking socket) were both missing — every SSR menu/order call and the entire "live" order-tracking feature would have silently failed in production. | This session | Added `API_ORIGIN=http://api:3000` (internal) to the `ordering` service's runtime environment, and wired `NEXT_PUBLIC_API_ORIGIN` as a proper Docker **build arg** (`apps/ordering/Dockerfile`) sourced from a new `PUBLIC_API_ORIGIN` production variable — Next.js inlines `NEXT_PUBLIC_*` vars at build time, so a runtime-only fix would not have worked. |
| 2 | 🔴 **`.env.production` was not actually gitignored.** `.gitignore` only excluded `.env`, `.env.local`, `.env.*.local` — none match `.env.production`, the exact filename the deployment docs instruct you to create and fill with real secrets. Verified with `git check-ignore` (returned nothing before the fix). Checked full git history — no real secrets file was ever actually committed, but the gap was live and would bite the first real deploy. | This session | Broadened the pattern to `.env` + `.env.*` with explicit `.env.example`/`.env.*.example` exceptions, verified in both directions with `git check-ignore`. |
| 3 | 🟡 `.dockerignore`'s example-file exception (`!*.env.example`) never actually matched `.env.production.example`. No Dockerfile copies any `.env*` file, so this had no real runtime effect — fixed anyway for correctness/consistency with the `.gitignore` fix. | This session | Fixed to mirror `.gitignore`. |
| 4 | 🔴 Platform Admin app missing from `docker-compose.prod.yml` entirely. | Previous phase | Fixed previously; re-confirmed still correct this session. |
| 5 | 🔴 CI's `docker-build` job only built api/dashboard/ordering — pos/kds/platform were never build-verified. | Previous phase | Fixed previously; re-confirmed all 6 image build steps present and the workflow YAML is syntactically valid this session. |

Items 1 and 2 are new findings from this closing pass, found by cross-checking every `${VAR}` in `docker-compose.prod.yml` against `.env.production.example` and re-reading each app's actual runtime code for what it reads vs. what's documented — not by running a build (the build itself can't run here; see below).

### 2. Docker deployment on a real environment

Re-attempted with a real Docker daemon running in this session (`dockerd` started, `docker build`/`docker pull node:22-slim` tried both plainly and with `--network host` per this sandbox's own troubleshooting guidance). Result is identical to the last two attempts: Docker Hub's CloudFront-backed blob storage returns `403 Forbidden` through this sandbox's egress proxy — confirmed now across **two independent sessions**, ruling out a transient network blip. This is a sandbox environment policy, not a code defect, and per that policy's own guidance the correct action is to report it, not keep retrying or route around it.

**No environment available to this session has unrestricted Docker Hub egress.** The actual `docker compose -f docker-compose.prod.yml build` must be run once, for real, in CI or on the target deployment host, before the pilot's containers are ever started. This is the one item in this entire effort that cannot be verified by static review alone — and this session's two real fixes (ordering's API origin, the `.gitignore` gap) were both found by *manual* code/config review specifically because an actual build couldn't be run to catch them mechanically. That is worth taking seriously: a real build may still surface something a static review missed.

### 3. CI/CD confirmed

Ran the exact commands CI runs, locally, end to end:
- `pnpm build` — all 9 workspace packages (api + 5 apps + 3 shared packages) build cleanly.
- `pnpm lint` — clean across all 6 lintable packages.
- `pnpm typecheck` — clean across all 6 typechecked packages.
- `pnpm test` — **233/233 API tests**, plus dashboard (4) and ordering (8) unit tests, all passing.
- `.github/workflows/ci.yml` YAML syntax validated; the `docker-build` job now has build steps for all 6 production images (api, dashboard, pos, kds, platform, ordering) — the two missing steps from the previous phase's fix re-confirmed present.

This is the full CI pipeline running clean; only the containerized build step itself remains unverified for the reason above.

### 4. Backups confirmed

Re-confirmed `infra/scripts/backup-db.sh` (added last phase) is present, executable, and correct. Not re-run this session since the dump/restore round-trip was already directly verified previously (restore into a scratch DB, table count matched, zero errors) — nothing about the script changed. **Still needs to actually be placed on a cron on the real production host** — that step cannot be done from a sandbox.

### 5. Secrets / Domains / TLS confirmed

- Cross-checked every environment variable referenced in `docker-compose.prod.yml` against `.env.production.example` — now an **exact match**, including the newly-added `PUBLIC_API_ORIGIN`.
- Fixed the real `.gitignore` secrets-leak gap (item 2 above) — the single most important finding in this category.
- SSL/TLS and per-app domains were already correctly documented (`docs/DEPLOYMENT.md`) — reviewed again, no further gaps found; the platform admin domain's network-restriction requirement (VPN/IP-allowlist, not public DNS) is documented.
- `env.validation.ts` still fails the API at boot if `JWT_SECRET`/`DATABASE_URL`/`ADMIN_DATABASE_URL` are missing — confirmed unchanged and correct.

### 6. Smoke test — errors found and fixed

Ran a full live smoke test against a **genuinely fresh database** (migrate deploy from zero, then seed): API health check, then all 5 frontend apps driven live with Playwright —
- Dashboard: login, Billing page, Reports page — clean.
- POS: login, branch selection — clean.
- **KDS: login with the seeded `kitchen@demo.spruvex.local` account — confirmed "متصل" (connected, green) via the real UI**, closing the loop on the kitchen-role fix from the previous phase (previously only verified via a raw socket script, now confirmed through the actual product).
- Ordering: QR-code menu load for a real demo table — clean.
- Platform Admin: login, tenant list showing the demo tenant — clean.

**Zero console/page errors across all five apps.** The two real bugs found and fixed in this closing pass (ordering API origin, `.gitignore`) were **not** caught by this smoke test — they are production-deployment-configuration issues that only manifest in an actual container build/run, which this sandbox cannot execute. The dev-mode smoke test uses `.env.example`'s correct localhost defaults, which is exactly why the compose-file-specific bug was invisible to it. This gap between "smoke test passes" and "actual deploy works" is itself the reason the real Docker build in §2 remains a hard requirement, not a formality.

---

## أي مخاطر متبقية (Remaining risks)

1. 🔴 **The actual Docker build has still never run to completion anywhere.** Everything else in this report and the two prior reports assumes it succeeds. It must be run for real (CI or the target host) before the pilot's containers are built — treat this as the literal first step of deployment, not an afterthought.
2. 🟡 The onboarding wizard still doesn't offer a "kitchen" role — worked around in the demo seed and documented in the trial checklist, but every real pilot restaurant will need to be told manually. Unchanged from the last report; out of scope for a no-new-features closing pass.
3. 🟡 The backup script exists and is tested but isn't on a cron anywhere yet — someone must schedule it on the real production host.
4. ⚪ No metrics/APM dashboard — acceptable for a small, hands-on-monitored pilot (structured logs + optional Sentry cover it), a gap before scaling further.
5. ⚪ Platform Admin subscriptions table shows raw plan keys instead of localized names — cosmetic, internal-tool-only, unchanged from the last report.

No new risks beyond what's listed here were found; the two real blockers discovered this session (ordering API origin, `.gitignore`) are both closed, not merely flagged.

---

## هل النظام جاهز لأول عميل أم لا (Ready for the first customer?)

**نعم، بشرط تنفيذ خطوة واحدة إلزامية أولاً: تشغيل `docker compose build` فعليًا على بيئة حقيقية (CI أو الخادم المستهدف) قبل أي نشر.**

Everything within this sandbox's reach has been verified, fixed, and re-verified: the full product (three testing passes deep), the full CI-equivalent pipeline, a tested backup/restore cycle, a secrets-leak gap closed, and — critically — a real production-breaking bug in the customer-facing ordering app's deployment wiring found and fixed before it ever reached a real customer. That last point is the strongest evidence this closing pass was worth doing: it is exactly the kind of bug that "looks fine" until the first real container build, at which point it would have meant the pilot restaurant's actual paying customers scanning a QR code got a broken ordering experience on day one.

The one thing that cannot be said with certainty from inside this sandbox is that the containers build and run cleanly end-to-end — that specific fact requires an environment with normal Docker Hub access, which none available to this session has. Once that one build is run successfully (and any further issues it surfaces are fixed), **SpruVex R is ready to run its pilot with a small number of real, closely-monitored restaurants.**
