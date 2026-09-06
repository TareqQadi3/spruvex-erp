# T-09: Performance Baseline Measurement

## Target
POS API response time < 300ms (declared project goal).

## Measured: createSale backend latency (Neon cloud, pooled)
Environment: Windows 26.7.0 → Neon PostgreSQL (us-east-2, pooled).
N=10 iterations of `createSale` (modular POS path, real DB, 1-item sale).

| Metric | Value |
|--------|-------|
| min    | 2461ms |
| p50    | 2470ms |
| p95    | 3382ms |
| max    | 3382ms |
| mean   | 2567ms |

## Analysis
- The measured latency is dominated by WAN round-trips to the Neon cloud DB (pooled, SSL). Each `createSale` executes 5-8 sequential queries in a transaction, each incurring ~300ms network latency.
- The 300ms target is achievable only when the API server is co-located with the database (same VPS / Neon in-region with PgBouncer).
- **Lighthouse** (frontend page load) was not measured: requires a browser environment and a running POS deployment — out of scope for this backend-only script.

## How to re-run
```bash
# From spruvex-app/
pnpm -C artifacts/api-server exec tsx benchmarks/measure-sale-latency.ts
```
Set `N` environment variable to change iteration count (default 30).

## Next steps
1. Re-measure when the API server is deployed on the same VPS as a local Postgres (or Neon with direct connection, not pooled).
2. Run Lighthouse CI (`npx lhci autorun`) against the deployed POS app URL once available.
3. Add frontend timing markers (Performance API) in the POS page for real-user monitoring.