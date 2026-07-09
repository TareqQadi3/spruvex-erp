CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"plan" text DEFAULT 'trial' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"trial_ends_at" timestamp,
	"subscription_ends_at" timestamp,
	"max_users" integer DEFAULT 3 NOT NULL,
	"max_branches" integer DEFAULT 1 NOT NULL,
	"enabled_modules" text DEFAULT '["pos","inventory","customers","repairs"]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "payment_methods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"percent_fee" numeric(5, 2) DEFAULT '0' NOT NULL,
	"fixed_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"show_fee_to_customer" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"notes" text,
	"outstanding_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"voucher_number" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"party" text,
	"party_type" text DEFAULT 'other' NOT NULL,
	"customer_id" uuid,
	"supplier_id" uuid,
	"employee_id" uuid,
	"description" text,
	"payment_method" text DEFAULT 'cash' NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouse_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_repair_stock" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"repair_id" uuid NOT NULL,
	"product_id" uuid,
	"part_name" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"part_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"labor_fee" numeric(10, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installment_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"installment_sale_id" uuid NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"due_date" date NOT NULL,
	"paid_date" date,
	"is_paid" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installment_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"months" integer NOT NULL,
	"interest_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installment_sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid,
	"sale_id" uuid,
	"principal" numeric(10, 2) NOT NULL,
	"interest_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"months" integer NOT NULL,
	"monthly_amount" numeric(10, 2) NOT NULL,
	"down_payment" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"start_date" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" uuid,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"barcode" text,
	"description" text,
	"cost_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"selling_price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"category_id" uuid,
	"warehouse_id" uuid,
	"section_id" uuid,
	"supplier_id" uuid,
	"brand" text,
	"image_url" text,
	"includes_tax" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"outstanding_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_purchases" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"opening_balance" numeric(10, 2) DEFAULT '0' NOT NULL,
	"closing_balance" numeric(10, 2),
	"expected_balance" numeric(10, 2),
	"total_sales" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"returned_quantity" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"payment_method_id" uuid,
	"method_name" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sale_return_id" uuid NOT NULL,
	"sale_item_id" uuid,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"is_exchange" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sale_id" uuid NOT NULL,
	"return_number" text NOT NULL,
	"reason" text,
	"refund_method" text DEFAULT 'cash' NOT NULL,
	"refund_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"exchange_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"net_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"customer_id" uuid,
	"cash_session_id" uuid,
	"subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(10, 2) DEFAULT '0' NOT NULL,
	"change" numeric(10, 2) DEFAULT '0' NOT NULL,
	"payment_method" text DEFAULT 'cash' NOT NULL,
	"payment_method_id" uuid,
	"payment_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repair_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"repair_id" uuid NOT NULL,
	"status" text NOT NULL,
	"notes" text,
	"changed_by" uuid,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repairs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"ticket_number" text NOT NULL,
	"customer_id" uuid,
	"device_type" text NOT NULL,
	"device_brand" text,
	"device_model" text,
	"imei" text,
	"problem_description" text NOT NULL,
	"technician_notes" text,
	"status" text DEFAULT 'received' NOT NULL,
	"repair_cost" numeric(10, 2),
	"estimated_cost" numeric(10, 2),
	"is_paid" boolean DEFAULT false NOT NULL,
	"warranty_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"date" date NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"shop_name" text DEFAULT 'My Shop' NOT NULL,
	"shop_address" text,
	"shop_phone" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"receipt_footer" text,
	"language" text DEFAULT 'en' NOT NULL,
	"logo_url" text,
	"invoice_header_text" text,
	"invoice_footer_text" text,
	"show_barcode" boolean DEFAULT false NOT NULL,
	"invoice_type" text DEFAULT 'a4' NOT NULL,
	"repairs_module_enabled" boolean DEFAULT true NOT NULL,
	"opening_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"fiscal_year_start" text,
	"fiscal_year_end" text,
	"setup_completed" boolean DEFAULT false NOT NULL,
	"vat_number" text,
	"theme_color" text DEFAULT 'blue' NOT NULL,
	"repair_invoice_type" text DEFAULT 'a4' NOT NULL,
	"repair_invoice_same_as_sales" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"name" text NOT NULL,
	"display_name" text NOT NULL,
	"permissions" text DEFAULT '[]' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"username" text NOT NULL,
	"email" text,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'cashier' NOT NULL,
	"permissions" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"type" text NOT NULL,
	"subtype" text,
	"parent_id" uuid,
	"normal_balance" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"entry_number" text NOT NULL,
	"date" text NOT NULL,
	"memo" text,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"is_manual" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"debit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"memo" text
);
--> statement-breakpoint
CREATE TABLE "purchase_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"purchase_id" uuid NOT NULL,
	"return_number" text NOT NULL,
	"reason" text,
	"quantity" integer NOT NULL,
	"unit_cost" numeric(10, 2) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"returned_quantity" integer DEFAULT 0 NOT NULL,
	"total_cost" numeric(10, 2) NOT NULL,
	"amount_paid" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid,
	"code" text NOT NULL,
	"module" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	"company_id" uuid,
	CONSTRAINT "role_permissions_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"branch_id" uuid,
	"granted_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"reserved_quantity" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"movement_type" text NOT NULL,
	"quantity" integer NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"sale_id" uuid,
	"related_invoice_id" uuid,
	"invoice_number" text NOT NULL,
	"invoice_type" text DEFAULT 'simplified' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"zatca_uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
	"issue_date" timestamp DEFAULT now() NOT NULL,
	"currency" text DEFAULT 'SAR' NOT NULL,
	"subtotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(12, 2) DEFAULT '0' NOT NULL,
	"seller_name" text NOT NULL,
	"seller_vat_number" text,
	"buyer_name" text,
	"buyer_vat_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_xml" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"ubl_version" text DEFAULT '2.1' NOT NULL,
	"xml_content" text NOT NULL,
	"xml_hash" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_xml_invoice_id_unique" UNIQUE("invoice_id")
);
--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"qr_content" text NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "qr_codes_invoice_id_unique" UNIQUE("invoice_id")
);
--> statement-breakpoint
CREATE TABLE "signatures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"previous_invoice_hash" text,
	"invoice_hash" text NOT NULL,
	"signature_value" text NOT NULL,
	"signing_certificate" text,
	"algorithm" text DEFAULT 'HMAC-SHA256-STUB' NOT NULL,
	"signed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "signatures_invoice_id_unique" UNIQUE("invoice_id")
);
--> statement-breakpoint
CREATE TABLE "zatca_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"request_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"http_status_code" integer,
	"request_payload" jsonb,
	"response_payload" jsonb,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"responded_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "offline_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"device_id" text NOT NULL,
	"user_id" uuid,
	"client_generated_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"operation_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"sync_status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"synced_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"device_id" text NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer,
	"synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "products_company_sku_idx" ON "products" USING btree ("company_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "repairs_company_ticket_idx" ON "repairs" USING btree ("company_id","ticket_number");--> statement-breakpoint
CREATE UNIQUE INDEX "settings_company_idx" ON "settings" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_global_name_idx" ON "roles" USING btree ("name") WHERE "roles"."company_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "roles_company_name_idx" ON "roles" USING btree ("company_id","name") WHERE "roles"."company_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_company_code_idx" ON "accounts" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_global_code_idx" ON "permissions" USING btree ("code") WHERE "permissions"."company_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "permissions_company_code_idx" ON "permissions" USING btree ("company_id","code") WHERE "permissions"."company_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_branch_scoped_idx" ON "user_roles" USING btree ("user_id","role_id","branch_id") WHERE "user_roles"."branch_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "user_roles_company_wide_idx" ON "user_roles" USING btree ("user_id","role_id") WHERE "user_roles"."branch_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "stock_product_warehouse_idx" ON "stock" USING btree ("product_id","warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "offline_queue_company_client_id_idx" ON "offline_queue" USING btree ("company_id","client_generated_id");