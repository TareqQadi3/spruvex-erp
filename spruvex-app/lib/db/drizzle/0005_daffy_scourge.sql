CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"address" text,
	"phone" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "plan" SET DEFAULT 'erp_business';--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "business_type" text;