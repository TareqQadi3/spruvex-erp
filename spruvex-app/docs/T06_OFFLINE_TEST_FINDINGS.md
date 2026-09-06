# T-06 — Offline Mode Field Test: Findings

Date: 2026-09-03
Branch: `fix/T-06-offline-test`
Test file: `artifacts/api-server/src/modules/sync/services/offlineSync.integration.test.ts`
Type: integration (real Neon DATABASE_URL from `spruvex-app/.env`)

## What was tested

Four service-layer scenarios, each run against a throwaway company (own
company + subscription + default warehouse + user + product + payment method,
fully cleaned up afterward — the same conventions as
`saleService.integration.test.ts`):

1. **Offline sale is not lost.** A `create_sale` operation is enqueued into
   `offline_queue` as `pending` (the durable record of a sale made while
   offline), then the same sale is pushed via `pushOperations()`. The pushed
   operation is accepted with no rejection, a real `sales` row exists, and the
   pushed queue entry transitions `pending -> synced`.
2. **Reconnect does not duplicate.** The same `clientGeneratedId` + payload is
   pushed a second time (simulating a client retry after a timeout where the
   first push actually landed). The second push returns
   `accepted[0].result.alreadyProcessed === true` and the company still has
   exactly **one** sale row. Only one `offline_queue` entry exists for that id.
3. **A bad row does not fail the batch.** A single push contains a valid
   `create_sale` plus an unsupported `create_payment`. The sale is accepted
   (sales row exists), and the `create_payment` is rejected with a clear
   reason ("create_payment is not supported as a standalone offline
   operation"). The failed queue entry is marked `failed` with an
   `errorMessage`; the good one is `synced`. One bad operation does not abort
   the batch.
4. **Stock is deducted exactly once across a reconnect.** The same
   `create_sale` is pushed twice with the same `clientGeneratedId`; the second
   push is deduped (`alreadyProcessed`), so product stock is decremented by
   exactly the sold quantity (10 -> 8 for qty 2), not twice.

Result: **4/4 tests pass**, typecheck passes.

## What works (verified end-to-end against the real DB)

- **Queue persistence** — `offline_queue` rows are written durably and their
  status transitions correctly: `pending -> synced` on success, `pending ->
  failed` (with `error_message`) on rejection. Payloads round-trip through the
  `jsonb` column intact.
- **Idempotent dedupe** — the `UNIQUE(company_id, client_generated_id)`
  index + `idempotencyService.reserve` correctly detect a replayed
  `clientGeneratedId` whose first attempt already succeeded and short-circuit
  it (`alreadyProcessed`) without re-running the sale or re-deducting stock.
- **Per-operation failure isolation** — `pushOperations()` iterates the batch
  and rejects only the failing operation; a rejected row never rolls back or
  aborts the other operations in the same push.
- **Sale routing through the POS engine** — a `create_sale` offline operation
  is dispatched to `saleService.createSale()` (the real engine: product/payment
  validation, integer-cent totals, `stock_movements` + `stock` deduction
  through the inventory engine, `products.stock` mirror sync). An offline
  create-sale behaves identically to a live one.

## What does NOT work / is NOT tested

Honest list — no claims beyond what the above runs actually prove.

- **No real network-loss transport test.** There is no offline client in this
  repo and no socket/transport layer that can be cut. "Network loss" is
  simulated at the service layer by inserting a `pending` row and/or calling
  `pushOperations()` directly. No test proves what a real disconnected POS
  terminal does before/during/after a drop, because that surface does not
  exist yet.
- **No pull-based client reconciliation test.** `pullChanges()` builds a
  change feed, but nothing here exercises a client consuming it, merging it,
  or resolving differences against its local store. Pull semantics are
  reviewed in code only, not proven by a test.
- **No conflict-resolution UI.** `conflictResolver` logic exists for customer
  updates but there is no user-facing conflict screen, and no test exercises a
  genuine edit-edit conflict between two devices.
- **Standalone `create_payment` is unsupported.** This is verified behavior,
  not a gap: `offlineQueueProcessor.processOperation` rejects
  `create_payment` with a clear reason, because payments are only recorded as
  part of `create_sale`. A device that needs to add a payment to an existing
  offline sale cannot do it today.
- **Only `create_sale`, `adjust_stock`, and customer CRUD have real handlers.**
  Other entity/operation types (e.g. offline `update`/`delete` on products,
  purchases, expenses) are rejected as unsupported by the processor. Only the
  sale path was tested here; `adjust_stock` and customer generic CRUD are
  wired but not covered by this test file.
- **Atomicity caveat (by design, not tested).** The offline-queue status
  update happens after the domain operation's own transaction commits (no
  outbox/saga). A process crash between "sale committed" and "queue row marked
  synced" leaves the row stuck `pending`; the client retry path for a
  `pending` row is treated as in-progress rather than resumed. Not exercised
  here because it needs fault injection the current code cannot do cleanly.

## How to re-run

From `spruvex-app`:

```powershell
$env:PORT="5000"
$env:JWT_SECRET="test-secret-key-long-enough-12345678"
pnpm.cmd -C artifacts/api-server exec vitest run --project integration src/modules/sync/services/offlineSync.integration.test.ts --reporter=verbose
```
