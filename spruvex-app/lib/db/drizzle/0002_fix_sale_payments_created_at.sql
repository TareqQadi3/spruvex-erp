-- Schema drift fix: sale_payments.created_at is declared in schema.ts
-- (lib/db/src/schema/sales.ts) but was missing from the live dev DB,
-- breaking any query that selects it (e.g. GET /api/sales/:id).
ALTER TABLE "sale_payments" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
