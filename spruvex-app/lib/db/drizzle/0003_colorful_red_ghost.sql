CREATE TABLE "restaurant_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"table_number" text NOT NULL,
	"name" text,
	"section" text,
	"seating_capacity" integer DEFAULT 2 NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"parent_id" uuid,
	"sort_order" numeric(10, 2) DEFAULT '0' NOT NULL,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"category_id" uuid,
	"product_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"price" numeric(10, 2) DEFAULT '0' NOT NULL,
	"station" text,
	"image_url" text,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_modifier_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"name" text NOT NULL,
	"selection_type" text DEFAULT 'single' NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"sort_order" numeric(10, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "menu_modifier_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"modifier_group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price_delta" numeric(10, 2) DEFAULT '0' NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"sort_order" numeric(10, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_order_item_modifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"modifier_option_id" uuid NOT NULL,
	"option_name" text NOT NULL,
	"price_delta" numeric(10, 2) DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"menu_item_id" uuid NOT NULL,
	"item_name" text NOT NULL,
	"station" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"modifiers_total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"special_instructions" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"order_number" text NOT NULL,
	"table_id" uuid,
	"customer_id" uuid,
	"order_type" text DEFAULT 'dine_in' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"sale_id" uuid,
	"cash_session_id" uuid,
	"subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"guest_count" integer,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restaurant_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid,
	"user_id" uuid NOT NULL,
	"cash_session_id" uuid,
	"role" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"status" text DEFAULT 'open' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_tables_company_number_idx" ON "restaurant_tables" USING btree ("company_id","table_number");--> statement-breakpoint
CREATE UNIQUE INDEX "menu_modifier_options_group_name_idx" ON "menu_modifier_options" USING btree ("modifier_group_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_orders_company_number_idx" ON "restaurant_orders" USING btree ("company_id","order_number");