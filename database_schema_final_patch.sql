-- =============================================================================
-- FINAL production patch: composite (company_id, id) FK as the SOLE tenant-
-- isolation mechanism. Supersedes database_schema_rls_composite_fk_patch.sql —
-- the RLS layer added there is explicitly reverted in step 0 below.
-- Idempotent: safe to run directly on database_schema.sql or on top of the
-- prior RLS patch.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Revert the RLS layer — this patch standardizes on ONE isolation mechanism
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'companies', 'branches', 'users', 'roles', 'user_roles', 'categories', 'brands',
    'warehouses', 'products', 'stock', 'stock_movements', 'payment_methods',
    'payment_method_fee_layers', 'sales', 'sale_items', 'payments', 'offline_queue',
    'sync_logs', 'repair_orders', 'repair_parts', 'invoices', 'invoice_xml',
    'qr_codes', 'signatures', 'zatca_logs'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS current_company_id();

-- -----------------------------------------------------------------------------
-- 1. Add missing company_id columns
-- -----------------------------------------------------------------------------

-- payment_method_fee_layers
ALTER TABLE payment_method_fee_layers ADD COLUMN IF NOT EXISTS company_id UUID;
UPDATE payment_method_fee_layers pmfl
SET company_id = pm.company_id
FROM payment_methods pm
WHERE pm.id = pmfl.payment_method_id AND pmfl.company_id IS NULL;
ALTER TABLE payment_method_fee_layers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE payment_method_fee_layers DROP CONSTRAINT IF EXISTS payment_method_fee_layers_company_id_fkey;
ALTER TABLE payment_method_fee_layers ADD CONSTRAINT payment_method_fee_layers_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_payment_method_fee_layers_company_id ON payment_method_fee_layers(company_id);

-- permissions (nullable: NULL = global system permission, shared by all tenants)
ALTER TABLE permissions ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_company_id_fkey;
ALTER TABLE permissions ADD CONSTRAINT permissions_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_permissions_company_id ON permissions(company_id);
-- replace the old global-only UNIQUE(code) with tenant-aware uniqueness
ALTER TABLE permissions DROP CONSTRAINT IF EXISTS permissions_code_key;
DROP INDEX IF EXISTS permissions_global_code_key;
DROP INDEX IF EXISTS permissions_company_code_key;
CREATE UNIQUE INDEX permissions_global_code_key ON permissions(code) WHERE company_id IS NULL;
CREATE UNIQUE INDEX permissions_company_code_key ON permissions(company_id, code) WHERE company_id IS NOT NULL;

-- role_permissions (nullable: mirrors the tenant scope of the role/permission it links)
ALTER TABLE role_permissions ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_company_id_fkey;
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_role_permissions_company_id ON role_permissions(company_id);

-- -----------------------------------------------------------------------------
-- 2. Composite FK anchors: UNIQUE (company_id, id) on every referenced parent
-- -----------------------------------------------------------------------------

ALTER TABLE users           DROP CONSTRAINT IF EXISTS users_company_id_id_key;
ALTER TABLE users           ADD CONSTRAINT users_company_id_id_key           UNIQUE (company_id, id);
ALTER TABLE branches        DROP CONSTRAINT IF EXISTS branches_company_id_id_key;
ALTER TABLE branches        ADD CONSTRAINT branches_company_id_id_key        UNIQUE (company_id, id);
ALTER TABLE categories      DROP CONSTRAINT IF EXISTS categories_company_id_id_key;
ALTER TABLE categories      ADD CONSTRAINT categories_company_id_id_key      UNIQUE (company_id, id);
ALTER TABLE brands          DROP CONSTRAINT IF EXISTS brands_company_id_id_key;
ALTER TABLE brands          ADD CONSTRAINT brands_company_id_id_key          UNIQUE (company_id, id);
ALTER TABLE warehouses      DROP CONSTRAINT IF EXISTS warehouses_company_id_id_key;
ALTER TABLE warehouses      ADD CONSTRAINT warehouses_company_id_id_key      UNIQUE (company_id, id);
ALTER TABLE products        DROP CONSTRAINT IF EXISTS products_company_id_id_key;
ALTER TABLE products        ADD CONSTRAINT products_company_id_id_key        UNIQUE (company_id, id);
ALTER TABLE payment_methods DROP CONSTRAINT IF EXISTS payment_methods_company_id_id_key;
ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_company_id_id_key UNIQUE (company_id, id);
ALTER TABLE sales           DROP CONSTRAINT IF EXISTS sales_company_id_id_key;
ALTER TABLE sales           ADD CONSTRAINT sales_company_id_id_key           UNIQUE (company_id, id);
ALTER TABLE repair_orders   DROP CONSTRAINT IF EXISTS repair_orders_company_id_id_key;
ALTER TABLE repair_orders   ADD CONSTRAINT repair_orders_company_id_id_key   UNIQUE (company_id, id);
ALTER TABLE invoices        DROP CONSTRAINT IF EXISTS invoices_company_id_id_key;
ALTER TABLE invoices        ADD CONSTRAINT invoices_company_id_id_key        UNIQUE (company_id, id);

-- roles and permissions are NOT anchored here: company_id is nullable on both
-- (global system templates/permissions), so children referencing them use a
-- trigger-based tenant check instead of a declarative composite FK (see below).

-- -----------------------------------------------------------------------------
-- 3. Composite FKs — every cross-entity reference now carries (company_id, x_id)
--    DELETE rule legend: config/master-data keeps its original rule;
--    financial/audit tables (sales, sale_items, payments, stock_movements,
--    repair_orders, repair_parts, invoices, invoice_xml, qr_codes, signatures,
--    zatca_logs) use RESTRICT everywhere — no CASCADE, no silent SET NULL.
-- -----------------------------------------------------------------------------

-- users.branch_id -> branches (config)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_branch_id_fkey;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_branch_id_company_fkey;
ALTER TABLE users ADD CONSTRAINT users_branch_id_company_fkey
  FOREIGN KEY (company_id, branch_id) REFERENCES branches (company_id, id) ON DELETE SET NULL;

-- branches.manager_id -> users (config)
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_manager_id_fkey;
ALTER TABLE branches DROP CONSTRAINT IF EXISTS branches_manager_id_company_fkey;
ALTER TABLE branches ADD CONSTRAINT branches_manager_id_company_fkey
  FOREIGN KEY (company_id, manager_id) REFERENCES users (company_id, id) ON DELETE SET NULL;

-- user_roles.user_id / branch_id / granted_by (config, RBAC)
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_company_fkey;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_company_fkey
  FOREIGN KEY (company_id, user_id) REFERENCES users (company_id, id) ON DELETE CASCADE;

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_branch_id_fkey;
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_branch_id_company_fkey;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_branch_id_company_fkey
  FOREIGN KEY (company_id, branch_id) REFERENCES branches (company_id, id) ON DELETE CASCADE;

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_granted_by_fkey;
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_granted_by_company_fkey;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_granted_by_company_fkey
  FOREIGN KEY (company_id, granted_by) REFERENCES users (company_id, id) ON DELETE SET NULL;

-- user_roles.role_id -> roles: roles.company_id is nullable (global templates) —
-- a plain composite FK can't express "same tenant OR global", so it's trigger-enforced.
CREATE OR REPLACE FUNCTION check_tenant_scoped_role(p_role_id UUID, p_company_id UUID)
RETURNS VOID AS $$
DECLARE
  role_company UUID;
BEGIN
  SELECT company_id INTO role_company FROM roles WHERE id = p_role_id;
  IF role_company IS NOT NULL AND (p_company_id IS NULL OR p_company_id <> role_company) THEN
    RAISE EXCEPTION 'role % does not belong to company %', p_role_id, p_company_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trg_check_user_roles_role_tenant()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM check_tenant_scoped_role(NEW.role_id, NEW.company_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_roles_role_tenant ON user_roles;
CREATE TRIGGER trg_user_roles_role_tenant
  BEFORE INSERT OR UPDATE OF role_id, company_id ON user_roles
  FOR EACH ROW EXECUTE FUNCTION trg_check_user_roles_role_tenant();

-- role_permissions.role_id / permission_id: both parents allow NULL company_id
-- (global templates/permissions) — same trigger-based approach, checking both sides.
CREATE OR REPLACE FUNCTION trg_check_role_permissions_tenant()
RETURNS TRIGGER AS $$
DECLARE
  permission_company UUID;
BEGIN
  PERFORM check_tenant_scoped_role(NEW.role_id, NEW.company_id);
  SELECT company_id INTO permission_company FROM permissions WHERE id = NEW.permission_id;
  IF permission_company IS NOT NULL AND (NEW.company_id IS NULL OR NEW.company_id <> permission_company) THEN
    RAISE EXCEPTION 'permission % does not belong to company %', NEW.permission_id, NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_role_permissions_tenant ON role_permissions;
CREATE TRIGGER trg_role_permissions_tenant
  BEFORE INSERT OR UPDATE OF role_id, permission_id, company_id ON role_permissions
  FOR EACH ROW EXECUTE FUNCTION trg_check_role_permissions_tenant();

-- categories.parent_id -> categories (config)
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_parent_id_fkey;
ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_parent_id_company_fkey;
ALTER TABLE categories ADD CONSTRAINT categories_parent_id_company_fkey
  FOREIGN KEY (company_id, parent_id) REFERENCES categories (company_id, id) ON DELETE SET NULL;

-- warehouses.branch_id -> branches (config)
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_branch_id_fkey;
ALTER TABLE warehouses DROP CONSTRAINT IF EXISTS warehouses_branch_id_company_fkey;
ALTER TABLE warehouses ADD CONSTRAINT warehouses_branch_id_company_fkey
  FOREIGN KEY (company_id, branch_id) REFERENCES branches (company_id, id) ON DELETE SET NULL;

-- products.category_id / brand_id (config)
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_category_id_company_fkey;
ALTER TABLE products ADD CONSTRAINT products_category_id_company_fkey
  FOREIGN KEY (company_id, category_id) REFERENCES categories (company_id, id) ON DELETE SET NULL;

ALTER TABLE products DROP CONSTRAINT IF EXISTS products_brand_id_fkey;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_brand_id_company_fkey;
ALTER TABLE products ADD CONSTRAINT products_brand_id_company_fkey
  FOREIGN KEY (company_id, brand_id) REFERENCES brands (company_id, id) ON DELETE SET NULL;

-- stock -> warehouses, products: live on-hand snapshot, not a ledger; CASCADE is safe
ALTER TABLE stock DROP CONSTRAINT IF EXISTS stock_product_id_fkey;
ALTER TABLE stock DROP CONSTRAINT IF EXISTS stock_product_id_company_fkey;
ALTER TABLE stock ADD CONSTRAINT stock_product_id_company_fkey
  FOREIGN KEY (company_id, product_id) REFERENCES products (company_id, id) ON DELETE CASCADE;

ALTER TABLE stock DROP CONSTRAINT IF EXISTS stock_warehouse_id_fkey;
ALTER TABLE stock DROP CONSTRAINT IF EXISTS stock_warehouse_id_company_fkey;
ALTER TABLE stock ADD CONSTRAINT stock_warehouse_id_company_fkey
  FOREIGN KEY (company_id, warehouse_id) REFERENCES warehouses (company_id, id) ON DELETE CASCADE;

-- stock_movements: AUDIT LEDGER — RESTRICT, never cascade/silently null
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_company_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_product_id_fkey;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_product_id_company_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_product_id_company_fkey
  FOREIGN KEY (company_id, product_id) REFERENCES products (company_id, id) ON DELETE RESTRICT;

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_warehouse_id_fkey;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_warehouse_id_company_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_warehouse_id_company_fkey
  FOREIGN KEY (company_id, warehouse_id) REFERENCES warehouses (company_id, id) ON DELETE RESTRICT;

ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_created_by_fkey;
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_created_by_company_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_created_by_company_fkey
  FOREIGN KEY (company_id, created_by) REFERENCES users (company_id, id) ON DELETE RESTRICT;

-- payment_method_fee_layers.payment_method_id (config)
ALTER TABLE payment_method_fee_layers DROP CONSTRAINT IF EXISTS payment_method_fee_layers_payment_method_id_fkey;
ALTER TABLE payment_method_fee_layers DROP CONSTRAINT IF EXISTS payment_method_fee_layers_payment_method_id_company_fkey;
ALTER TABLE payment_method_fee_layers ADD CONSTRAINT payment_method_fee_layers_payment_method_id_company_fkey
  FOREIGN KEY (company_id, payment_method_id) REFERENCES payment_methods (company_id, id) ON DELETE CASCADE;

-- sales: FINANCIAL — RESTRICT everywhere (required FKs: users, branches)
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_company_id_fkey;
ALTER TABLE sales ADD CONSTRAINT sales_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_branch_id_fkey;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_branch_id_company_fkey;
ALTER TABLE sales ADD CONSTRAINT sales_branch_id_company_fkey
  FOREIGN KEY (company_id, branch_id) REFERENCES branches (company_id, id) ON DELETE RESTRICT;

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_warehouse_id_fkey;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_warehouse_id_company_fkey;
ALTER TABLE sales ADD CONSTRAINT sales_warehouse_id_company_fkey
  FOREIGN KEY (company_id, warehouse_id) REFERENCES warehouses (company_id, id) ON DELETE RESTRICT;

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_cashier_id_fkey;
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_cashier_id_company_fkey;
ALTER TABLE sales ADD CONSTRAINT sales_cashier_id_company_fkey
  FOREIGN KEY (company_id, cashier_id) REFERENCES users (company_id, id) ON DELETE RESTRICT;

-- sale_items: FINANCIAL — RESTRICT everywhere (required FK: products)
ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_company_id_fkey;
ALTER TABLE sale_items ADD CONSTRAINT sale_items_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_sale_id_fkey;
ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_sale_id_company_fkey;
ALTER TABLE sale_items ADD CONSTRAINT sale_items_sale_id_company_fkey
  FOREIGN KEY (company_id, sale_id) REFERENCES sales (company_id, id) ON DELETE RESTRICT;

ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey;
ALTER TABLE sale_items DROP CONSTRAINT IF EXISTS sale_items_product_id_company_fkey;
ALTER TABLE sale_items ADD CONSTRAINT sale_items_product_id_company_fkey
  FOREIGN KEY (company_id, product_id) REFERENCES products (company_id, id) ON DELETE RESTRICT;

-- payments: FINANCIAL — RESTRICT everywhere
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_company_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_sale_id_fkey;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_sale_id_company_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_sale_id_company_fkey
  FOREIGN KEY (company_id, sale_id) REFERENCES sales (company_id, id) ON DELETE RESTRICT;

ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_id_fkey;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_id_company_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_id_company_fkey
  FOREIGN KEY (company_id, payment_method_id) REFERENCES payment_methods (company_id, id) ON DELETE RESTRICT;

-- offline_queue / sync_logs: operational, not financial/audit — unchanged rules
ALTER TABLE offline_queue DROP CONSTRAINT IF EXISTS offline_queue_branch_id_fkey;
ALTER TABLE offline_queue DROP CONSTRAINT IF EXISTS offline_queue_branch_id_company_fkey;
ALTER TABLE offline_queue ADD CONSTRAINT offline_queue_branch_id_company_fkey
  FOREIGN KEY (company_id, branch_id) REFERENCES branches (company_id, id) ON DELETE SET NULL;

ALTER TABLE offline_queue DROP CONSTRAINT IF EXISTS offline_queue_user_id_fkey;
ALTER TABLE offline_queue DROP CONSTRAINT IF EXISTS offline_queue_user_id_company_fkey;
ALTER TABLE offline_queue ADD CONSTRAINT offline_queue_user_id_company_fkey
  FOREIGN KEY (company_id, user_id) REFERENCES users (company_id, id) ON DELETE SET NULL;

ALTER TABLE sync_logs DROP CONSTRAINT IF EXISTS sync_logs_branch_id_fkey;
ALTER TABLE sync_logs DROP CONSTRAINT IF EXISTS sync_logs_branch_id_company_fkey;
ALTER TABLE sync_logs ADD CONSTRAINT sync_logs_branch_id_company_fkey
  FOREIGN KEY (company_id, branch_id) REFERENCES branches (company_id, id) ON DELETE SET NULL;

-- repair_orders: FINANCIAL/audit (service history + cost/payment fields) — RESTRICT
ALTER TABLE repair_orders DROP CONSTRAINT IF EXISTS repair_orders_company_id_fkey;
ALTER TABLE repair_orders ADD CONSTRAINT repair_orders_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE repair_orders DROP CONSTRAINT IF EXISTS repair_orders_branch_id_fkey;
ALTER TABLE repair_orders DROP CONSTRAINT IF EXISTS repair_orders_branch_id_company_fkey;
ALTER TABLE repair_orders ADD CONSTRAINT repair_orders_branch_id_company_fkey
  FOREIGN KEY (company_id, branch_id) REFERENCES branches (company_id, id) ON DELETE RESTRICT;

ALTER TABLE repair_orders DROP CONSTRAINT IF EXISTS repair_orders_technician_id_fkey;
ALTER TABLE repair_orders DROP CONSTRAINT IF EXISTS repair_orders_technician_id_company_fkey;
ALTER TABLE repair_orders ADD CONSTRAINT repair_orders_technician_id_company_fkey
  FOREIGN KEY (company_id, technician_id) REFERENCES users (company_id, id) ON DELETE RESTRICT;

-- repair_parts: FINANCIAL — RESTRICT everywhere (required FK: products)
ALTER TABLE repair_parts DROP CONSTRAINT IF EXISTS repair_parts_company_id_fkey;
ALTER TABLE repair_parts ADD CONSTRAINT repair_parts_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE repair_parts DROP CONSTRAINT IF EXISTS repair_parts_repair_order_id_fkey;
ALTER TABLE repair_parts DROP CONSTRAINT IF EXISTS repair_parts_repair_order_id_company_fkey;
ALTER TABLE repair_parts ADD CONSTRAINT repair_parts_repair_order_id_company_fkey
  FOREIGN KEY (company_id, repair_order_id) REFERENCES repair_orders (company_id, id) ON DELETE RESTRICT;

ALTER TABLE repair_parts DROP CONSTRAINT IF EXISTS repair_parts_product_id_fkey;
ALTER TABLE repair_parts DROP CONSTRAINT IF EXISTS repair_parts_product_id_company_fkey;
ALTER TABLE repair_parts ADD CONSTRAINT repair_parts_product_id_company_fkey
  FOREIGN KEY (company_id, product_id) REFERENCES products (company_id, id) ON DELETE RESTRICT;

-- invoices: ZATCA/FINANCIAL, legally retained — RESTRICT everywhere
-- NOTE: invoices -> customers is not applicable yet: no `customers` table exists
-- in database_schema.sql (sales/repairs still use inline customer fields). Add
-- that FK once a customers table is introduced; skipped here per "ALTER only".
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_company_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_sale_id_fkey;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_sale_id_company_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_sale_id_company_fkey
  FOREIGN KEY (company_id, sale_id) REFERENCES sales (company_id, id) ON DELETE RESTRICT;

-- invoice_xml / qr_codes / signatures / zatca_logs: ZATCA — RESTRICT everywhere
ALTER TABLE invoice_xml DROP CONSTRAINT IF EXISTS invoice_xml_company_id_fkey;
ALTER TABLE invoice_xml ADD CONSTRAINT invoice_xml_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;
ALTER TABLE invoice_xml DROP CONSTRAINT IF EXISTS invoice_xml_invoice_id_fkey;
ALTER TABLE invoice_xml DROP CONSTRAINT IF EXISTS invoice_xml_invoice_id_company_fkey;
ALTER TABLE invoice_xml ADD CONSTRAINT invoice_xml_invoice_id_company_fkey
  FOREIGN KEY (company_id, invoice_id) REFERENCES invoices (company_id, id) ON DELETE RESTRICT;

ALTER TABLE qr_codes DROP CONSTRAINT IF EXISTS qr_codes_company_id_fkey;
ALTER TABLE qr_codes ADD CONSTRAINT qr_codes_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;
ALTER TABLE qr_codes DROP CONSTRAINT IF EXISTS qr_codes_invoice_id_fkey;
ALTER TABLE qr_codes DROP CONSTRAINT IF EXISTS qr_codes_invoice_id_company_fkey;
ALTER TABLE qr_codes ADD CONSTRAINT qr_codes_invoice_id_company_fkey
  FOREIGN KEY (company_id, invoice_id) REFERENCES invoices (company_id, id) ON DELETE RESTRICT;

ALTER TABLE signatures DROP CONSTRAINT IF EXISTS signatures_company_id_fkey;
ALTER TABLE signatures ADD CONSTRAINT signatures_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;
ALTER TABLE signatures DROP CONSTRAINT IF EXISTS signatures_invoice_id_fkey;
ALTER TABLE signatures DROP CONSTRAINT IF EXISTS signatures_invoice_id_company_fkey;
ALTER TABLE signatures ADD CONSTRAINT signatures_invoice_id_company_fkey
  FOREIGN KEY (company_id, invoice_id) REFERENCES invoices (company_id, id) ON DELETE RESTRICT;

ALTER TABLE zatca_logs DROP CONSTRAINT IF EXISTS zatca_logs_company_id_fkey;
ALTER TABLE zatca_logs ADD CONSTRAINT zatca_logs_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;
ALTER TABLE zatca_logs DROP CONSTRAINT IF EXISTS zatca_logs_invoice_id_fkey;
ALTER TABLE zatca_logs DROP CONSTRAINT IF EXISTS zatca_logs_invoice_id_company_fkey;
ALTER TABLE zatca_logs ADD CONSTRAINT zatca_logs_invoice_id_company_fkey
  FOREIGN KEY (company_id, invoice_id) REFERENCES invoices (company_id, id) ON DELETE RESTRICT;

COMMIT;
