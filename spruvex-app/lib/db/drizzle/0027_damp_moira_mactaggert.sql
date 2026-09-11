CREATE TABLE "attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"clock_in" timestamp NOT NULL,
	"clock_out" timestamp,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"manager_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"national_id" text,
	"department_id" uuid,
	"position" text,
	"hire_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"branch_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "attendance_company_employee_idx" ON "attendance" USING btree ("company_id","employee_id");--> statement-breakpoint
CREATE INDEX "departments_company_idx" ON "departments" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "employees_company_idx" ON "employees" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "employees_company_department_idx" ON "employees" USING btree ("company_id","department_id");