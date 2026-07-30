CREATE TABLE "user_branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "warehouses" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "user_branches_user_branch_idx" ON "user_branches" USING btree ("user_id","branch_id");