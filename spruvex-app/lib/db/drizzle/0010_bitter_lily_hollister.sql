CREATE TABLE "ecommerce_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"external_order_id" text NOT NULL,
	"external_order_number" text,
	"customer_name" text,
	"customer_phone" text,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"payload" jsonb,
	"error_message" text,
	"sale_id" uuid,
	"imported_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_gateway_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"credentials" jsonb,
	"mode" text DEFAULT 'test' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"source" text NOT NULL,
	"source_id" uuid NOT NULL,
	"sale_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"external_id" text,
	"checkout_url" text,
	"idempotency_key" text,
	"error_message" text,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ecommerce_orders_connection_external_idx" ON "ecommerce_orders" USING btree ("connection_id","external_order_id");--> statement-breakpoint
CREATE INDEX "ecommerce_orders_company_created_idx" ON "ecommerce_orders" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_gateway_settings_company_provider_idx" ON "payment_gateway_settings" USING btree ("company_id","provider");--> statement-breakpoint
CREATE INDEX "payment_transactions_company_created_idx" ON "payment_transactions" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_provider_external_idx" ON "payment_transactions" USING btree ("provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_transactions_company_idempotency_idx" ON "payment_transactions" USING btree ("company_id","idempotency_key");