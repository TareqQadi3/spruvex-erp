CREATE TABLE "vat_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"total_sales_ex_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_output_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_purchases_ex_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_input_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_vat_due" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"finalized_at" timestamp,
	"finalized_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "vat_returns_company_period_idx" ON "vat_returns" USING btree ("company_id","period_start","period_end");