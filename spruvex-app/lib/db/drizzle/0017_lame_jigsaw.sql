CREATE TABLE "product_related_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"related_product_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"batch_number" text NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"expiry_date" timestamp,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"name_en" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "display_mode" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "has_related_products" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "expiry_date" timestamp;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "selected_addons" jsonb;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "item_notes" text;--> statement-breakpoint
ALTER TABLE "sale_items" ADD COLUMN "serial_number" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "order_type" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "table_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "product_related_pair_idx" ON "product_related_products" USING btree ("product_id","related_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "order_types_company_key_idx" ON "order_types" USING btree ("company_id","key");