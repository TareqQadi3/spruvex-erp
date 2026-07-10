CREATE TABLE "purchase_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"document_number" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"supplier_name" text NOT NULL,
	"issue_date" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"document_kind" text NOT NULL,
	"print_type" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "sale_return_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_invoices_source_idx" ON "purchase_invoices" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_templates_company_name_idx" ON "invoice_templates" USING btree ("company_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_sale_return_idx" ON "invoices" USING btree ("sale_return_id");