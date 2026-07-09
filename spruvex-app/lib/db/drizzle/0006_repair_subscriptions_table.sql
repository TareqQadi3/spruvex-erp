-- Repair migration: the "subscriptions" table was defined in schema/subscriptions.ts
-- and recorded as created by migration 0000 (see drizzle.__drizzle_migrations), but
-- is physically absent from this environment's database (out-of-band drift). This
-- migration recreates it to match the schema definition exactly — no schema.ts
-- change accompanies this file, so no new snapshot is generated.
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"plan" text DEFAULT 'trial' NOT NULL,
	"status" text DEFAULT 'trialing' NOT NULL,
	"billing_cycle" text DEFAULT 'monthly' NOT NULL,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"payment_gateway_customer_id" text,
	"payment_gateway_subscription_id" text,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"trial_ends_at" timestamp,
	"canceled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
