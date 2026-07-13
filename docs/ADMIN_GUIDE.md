# SpruVex R — Platform Admin Guide

For the SpruVex operations team — managing tenants, subscriptions and
system health across every restaurant on the platform. This is a completely
separate login from every tenant's dashboard (see
`docs/ARCHITECTURE.md` §4 for why).

## Getting access

There is **no self-registration** for platform admins — an account must be
created directly:

- **First account**: set `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD`
  in the API's environment and run `pnpm db:seed` (or the equivalent one-off
  command in production — see `docs/DEPLOYMENT.md`). This creates the
  account if none exists yet with that email; unset the password env var
  afterward.
- **Additional accounts**: create a row directly in `platform_admins`
  (`email`, `name`, `password_hash` — use the same bcrypt helper as
  `apps/api/src/modules/identity/password.ts`'s `hashPassword`) via a
  one-off script or `psql` against the admin connection. There is no UI for
  this yet — a self-service "invite another admin" flow is a reasonable
  future addition if the ops team grows.

## Signing in

Open the platform console (`apps/platform`, port 5177 in dev) and sign in
with your email/password. Sessions last 8 hours with no refresh — you'll be
asked to sign in again after that, or immediately if your account is
deactivated mid-session.

**Account lockout**: 5 failed password attempts locks the account for 15
minutes — same policy as tenant logins. If you're locked out, wait or have
another platform admin (or direct DB access) clear `locked_until` on your
`platform_admins` row.

## Restaurants (tenants)

The **Restaurants** tab lists every tenant with its status (active/suspended),
branch count, and current plan/trial status. Search by name/slug or filter
by status.

Click a restaurant to see its detail: user count, branch list, and
subscription. From here you can:

- **Suspend**: blocks that tenant's staff from any write action (creating
  orders, branches, staff, changing settings, etc.) immediately — reads
  still work, and the tenant can still see its own billing status. Use this
  for policy violations, non-payment escalation, or at a customer's request.
  The action is recorded in that tenant's own audit log
  (`tenant.suspended_by_platform`, with your email in the entry's metadata).
- **Reactivate**: restores full access immediately.

Suspending a tenant is **not** the same as a subscription being
`cancelled`/`past_due` — a tenant can be `active` with a `cancelled`
subscription (blocked for billing reasons) or `suspended` while its
subscription is otherwise fine (blocked for a non-billing reason, e.g. abuse).
Both independently trigger the same write-blocking behavior for that tenant.

## Subscriptions

The **Subscriptions** tab lists every tenant's subscription with inline
controls to change its plan or status.

- **Change plan**: moves the tenant to a different plan's limits
  immediately (no proration, no payment collected — there is no payment
  gateway integrated yet, see below). Use this after confirming payment
  through your own manual process (bank transfer, invoice).
- **Change status**:
  - `trialing` → the default state for a new tenant; blocked automatically
    once `trial_ends_at` passes, without needing a status change.
  - `active` → full access; also sets a 30-day `current_period_end` from
    the moment you set it.
  - `past_due` → informational only today (not currently blocking) — use it
    to flag a tenant whose payment is late while you follow up.
  - `suspended` / `cancelled` → blocks that tenant's writes (same effect as
    suspending the tenant directly, but scoped to billing).

**There is no payment gateway wired up.** Payment is handled manually
outside the system (bank transfer / invoice, per the product plan's MVP
decision) — you mark a subscription `active` yourself once you've confirmed
payment. `SubscriptionInvoice` rows exist in the schema for record-keeping
but nothing in the UI creates them yet; that's a natural next step when a
gateway (Stripe/Moyasar/Tap) gets integrated (see
`docs/ARCHITECTURE.md` §5 for the integration points already in place).

## System status

The **System status** tab shows database connectivity, total/active/suspended
tenant counts, and subscription counts by status — a quick at-a-glance
health check. It polls every 30 seconds. For deeper health/monitoring, see
the API's `/health` and `/health/ready` endpoints (`docs/ARCHITECTURE.md` §8).

## What this console does *not* do (yet)

- View/impersonate a tenant's dashboard directly (you can see counts and
  status, not their menu/orders/reports).
- Manage individual users within a tenant (only the tenant's own owner/
  manager can do that today).
- Send notifications/emails to tenants about status changes — communicate
  out of band for now.
- Export data or run cross-tenant reports.

These are reasonable candidates for a later phase if the ops team needs
them — this phase intentionally kept the console to oversight + billing
actions per the "no new features beyond what's specified" constraint.
