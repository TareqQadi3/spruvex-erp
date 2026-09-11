CREATE TABLE "affiliates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"referral_code" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"commission_rate_percent" numeric(5, 2) DEFAULT '10' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_conversions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"affiliate_id" uuid NOT NULL,
	"product" text NOT NULL,
	"external_company_id" text NOT NULL,
	"company_name" text NOT NULL,
	"plan_code" text NOT NULL,
	"subscription_value_sar" numeric(10, 2) NOT NULL,
	"commission_rate_percent" numeric(5, 2) NOT NULL,
	"commission_amount_sar" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reported_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"paid_at" timestamp,
	"notes" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "affiliates_email_idx" ON "affiliates" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "affiliates_referral_code_idx" ON "affiliates" USING btree ("referral_code");--> statement-breakpoint
CREATE INDEX "referral_conversions_affiliate_idx" ON "referral_conversions" USING btree ("affiliate_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_conversions_product_company_idx" ON "referral_conversions" USING btree ("product","external_company_id");