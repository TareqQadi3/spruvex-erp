-- =============================================================================
-- Patch: RLS + composite (company_id, id) foreign key strategy
-- Applies on top of database_schema.sql. Run as a single transaction.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Tenant context helper (app must run: SET LOCAL app.current_company_id = '<uuid>')
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION current_company_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.current_company_id', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- -----------------------------------------------------------------------------
-- 1. Fix payment_method_fee_layers: missing company_id
-- -----------------------------------------------------------------------------

ALTER TABLE payment_method_fee_layers ADD COLUMN company_id UUID;

UPDATE payment_method_fee_layers pmfl
SET company_id = pm.company_id
FROM payment_methods pm
WHERE pm.id = pmfl.payment_method_id;

ALTER TABLE payment_method_fee_layers ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE payment_method_fee_layers
  ADD CONSTRAINT payment_method_fee_layers_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
CREATE INDEX idx_payment_method_fee_layers_company_id ON payment_method_fee_layers(company_id);

-- -----------------------------------------------------------------------------
-- 2. Composite FK anchors: UNIQUE (company_id, id) on every referenced parent
-- -----------------------------------------------------------------------------

ALTER TABLE users           ADD CONSTRAINT users_company_id_id_key           UNIQUE (company_id, id);
ALTER TABLE branches        ADD CONSTRAINT branches_company_id_id_key        UNIQUE (company_id, id);
ALTER TABLE categories      ADD CONSTRAINT categories_company_id_id_key      UNIQUE (company_id, id);
ALTER TABLE brands          ADD CONSTRAINT brands_company_id_id_key          UNIQUE (company_id, id);
ALTER TABLE warehouses      ADD CONSTRAINT warehouses_company_id_id_key      UNIQUE (company_id, id);
ALTER TABLE products        ADD CONSTRAINT products_company_id_id_key        UNIQUE (company_id, id);
ALTER TABLE payment_methods ADD CONSTRAINT payment_methods_company_id_id_key UNIQUE (company_id, id);
ALTER TABLE sales           ADD CONSTRAINT sales_company_id_id_key           UNIQUE (company_id, id);
ALTER TABLE repair_orders   ADD CONSTRAINT repair_orders_company_id_id_key   UNIQUE (company_id, id);
ALTER TABLE invoices        ADD CONSTRAINT invoices_company_id_id_key        UNIQUE (company_id, id);

-- -----------------------------------------------------------------------------
-- 3. Replace single-column FKs with composite (company_id, x_id) FKs
--    (ON DELETE behavior preserved from the original single-column FK)
-- -----------------------------------------------------------------------------

-- users.branch_id -> branches
ALTER TABLE users DROP CONSTRAINT users_branch_id_fkey;
ALTER TABLE users ADD CONSTRAINT users_branch_id_company_fkey
  FOREIGN KEY (company_id, branch_id) REFERENCES branches (company_id, id) ON DELETE SET NULL;

-- branches.manager_id -> users
ALTER TABLE branches DROP CONSTRAINT branches_manager_id_fkey;
ALTER TABLE branches ADD CONSTRAINT branches_manager_id_company_fkey
  FOREIGN KEY (company_id, manager_id) REFERENCES users (company_id, id) ON DELETE SET NULL;

-- user_roles.user_id -> users
ALTER TABLE user_roles DROP CONSTRAINT user_roles_user_id_fkey;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_company_fkey
  FOREIGN KEY (company_id, user_id) REFERENCES users (company_id, id) ON DELETE CASCADE;

-- user_roles.branch_id -> branches
ALTER TABLE user_roles DROP CONSTRAINT user_roles_branch_id_fkey;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_branch_id_company_fkey
  FOREIGN KEY (company_id, branch_id) REFERENCES branches (company_id, id) ON DELETE CASCADE;

-- user_roles.granted_by -> users
ALTER TABLE user_roles DROP CONSTRAINT user_roles_granted_by_fkey;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_granted_by_company_fkey
  FOREIGN KEY (company_id, granted_by) REFERENCES users (company_id, id) ON DELETE SET NULL;

-- user_roles.role_id -> roles: roles.company_id is nullable (global system templates),
-- so a declarative composite FK can't express "same tenant OR global" — enforced via trigger instead.
CREATE OR REPLACE FUNCTION check_user_roles_role_tenant()
RETURNS TRIGGER AS $$
DECLARE
  role_company UUID;
BEGIN
  SELECT company_id INTO role_company FROM roles WHERE id = NEW.role_id;
  IF role_company IS NOT NULL AND role_company <> NEW.company_id THEN
    RAISE EXCEPTION 'role % does not belong to company %', NEW.role_id, NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_roles_role_tenant
  BEFORE INSERT OR UPDATE OF role_id, company_id ON user_roles
  FOR EACH ROW EXECUTE FUNCTION check_user_roles_role_tenant();

-- categories.parent_id -> categories
ALTER TABLE categories DROP CONSTRAINT categories_parent_id_fkey;
ALTER TABLE categories ADD CONSTRAINT categories_parent_id_company_fkey
  FOREIGN KEY (company_id, parent_id) REFERENCES categories (company_id, id) ON DELETE SET NULL;

-- warehouses.branch_id -> branches
ALTER TABLE warehouses DROP CONSTRAINT warehouses_branch_id_fkey;
ALTER TABLE warehouses ADD CONSTRAINT warehouses_branch_id_company_fkey
  FOREIGN KEY (company_id, branch_id) REFERENCES branches (company_id, id) ON DELETE SET NULL;

-- products.category_id -> categories
ALTER TABLE products DROP CONSTRAINT products_category_id_fkey;
ALTER TABLE products ADD CONSTRAINT products_category_id_company_fkey
  FOREIGN KEY (company_id, category_id) REFERENCES categories (company_id, id) ON DELETE SET NULL;

-- products.brand_id -> brands
ALTER TABLE products DROP CONSTRAINT products_brand_id_fkey;
ALTER TABLE products ADD CONSTRAINT products_brand_id_company_fkey
  FOREIGN KEY (company_id, brand_id) REFERENCES brands (company_id, id) ON DELETE SET NULL;

-- stock.product_id -> products
ALTER TABLE stock DROP CONSTRAINT stock_product_id_fkey;
ALTER TABLE stock ADD CONSTRAINT stock_product_id_company_fkey
  FOREIGN KEY (company_id, product_id) REFERENCES products (company_id, id) ON DELETE CASCADE;

-- stock.warehouse_id -> warehouses
ALTER TABLE stock DROP CONSTRAINT stock_warehouse_id_fkey;
ALTER TABLE stock ADD CONSTRAINT stock_warehouse_id_company_fkey
  FOREIGN KEY (company_id, warehouse_id) REFERENCES warehouses (company_id, id) ON DELETE CASCADE;

-- stock_movements.product_id -> products
ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_product_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_product_id_company_fkey
  FOREIGN KEY (company_id, product_id) REFERENCES products (company_id, id) ON DELETE CASCADE;

-- stock_movements.warehouse_id -> warehouses
ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_warehouse_id_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_warehouse_id_company_fkey
  FOREIGN KEY (company_id, warehouse_id) REFERENCES warehouses (company_id, id) ON DELETE CASCADE;

-- stock_movements.created_by -> users
ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_created_by_fkey;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_created_by_company_fkey
  FOREIGN KEY (company_id, created_by) REFERENCES users (company_id, id) ON DELETE SET NULL;

-- payment_method_fee_layers.payment_method_id -> payment_methods
ALTER TABLE payment_method_fee_layers DROP CONSTRAINT payment_method_fee_layers_payment_method_id_fkey;
ALTER TABLE payment_method_fee_layers ADD CONSTRAINT payment_method_fee_layers_payment_method_id_company_fkey
  FOREIGN KEY (company_id, payment_method_id) REFERENCES payment_methods (company_id, id) ON DELETE CASCADE;

-- sales.branch_id -> branches
ALTER TABLE sales DROP CONSTRAINT sales_branch_id_fkey;
ALTER TABLE sales ADD CONSTRAINT sales_branch_id_company_fkey
  FOREIGN KEY (company_id, branch_id) REFERENCES branches (company_id, id) ON DELETE SET NULL;

-- sales.warehouse_id -> warehouses
ALTER TABLE sales DROP CONSTRAINT sales_warehouse_id_fkey;
ALTER TABLE sales ADD CONSTRAINT sales_warehouse_id_company_fkey
  FOREIGN KEY (company_id, warehouse_id) REFERENCES warehouses (company_id, id) ON DELETE SET NULL;

-- sales.cashier_id -> users
ALTER TABLE sales DROP CONSTRAINT sales_cashier_id_fkey;
ALTER TABLE sales ADD CONSTRAINT sales_cashier_id_company_fkey
  FOREIGN KEY (company_id, cashier_id) REFERENCES users (company_id, id) ON DELETE SET NULL;

-- sale_items.sale_id -> sales
ALTER TABLE sale_items DROP CONSTRAINT sale_items_sale_id_fkey;
ALTER TABLE sale_items ADD CONSTRAINT sale_items_sale_id_company_fkey
  FOREIGN KEY (company_id, sale_id) REFERENCES sales (company_id, id) ON DELETE CASCADE;

-- sale_items.product_id -> products
ALTER TABLE sale_items DROP CONSTRAINT sale_items_product_id_fkey;
ALTER TABLE sale_items ADD CONSTRAINT sale_items_product_id_company_fkey
  FOREIGN KEY (company_id, product_id) REFERENCES products (company_id, id) ON DELETE RESTRICT;

-- payments.sale_id -> sales
ALTER TABLE payments DROP CONSTRAINT payments_sale_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_sale_id_company_fkey
  FOREIGN KEY (company_id, sale_id) REFERENCES sales (company_id, id) ON DELETE CASCADE;

-- payments.payment_method_id -> payment_methods
ALTER TABLE payments DROP CONSTRAINT payments_payment_method_id_fkey;
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_id_company_fkey
  FOREIGN KEY (company_id, payment_method_id) REFERENCES payment_methods (company_id, id) ON DELETE RESTRICT;

-- offline_queue.branch_id -> branches
ALTER TABLE offline_queue DROP CONSTRAINT offline_queue_branch_id_fkey;
ALTER TABLE offline_queue ADD CONSTRAINT offline_queue_branch_id_company_fkey
  FOREIGN KEY (company_id, branch_id) REFERENCES branches (company_id, id) ON DELETE SET NULL;

-- offline_queue.user_id -> users
ALTER TABLE offline_queue DROP CONSTRAINT offline_queue_user_id_fkey;
ALTER TABLE offline_queue ADD CONSTRAINT offline_queue_user_id_company_fkey
  FOREIGN KEY (company_id, user_id) REFERENCES users (company_id, id) ON DELETE SET NULL;

-- sync_logs.branch_id -> branches
ALTER TABLE sync_logs DROP CONSTRAINT sync_logs_branch_id_fkey;
ALTER TABLE sync_logs ADD CONSTRAINT sync_logs_branch_id_company_fkey
  FOREIGN KEY (company_id, branch_id) REFERENCES branches (company_id, id) ON DELETE SET NULL;

-- repair_orders.branch_id -> branches
ALTER TABLE repair_orders DROP CONSTRAINT repair_orders_branch_id_fkey;
ALTER TABLE repair_orders ADD CONSTRAINT repair_orders_branch_id_company_fkey
  FOREIGN KEY (company_id, branch_id) REFERENCES branches (company_id, id) ON DELETE SET NULL;

-- repair_orders.technician_id -> users
ALTER TABLE repair_orders DROP CONSTRAINT repair_orders_technician_id_fkey;
ALTER TABLE repair_orders ADD CONSTRAINT repair_orders_technician_id_company_fkey
  FOREIGN KEY (company_id, technician_id) REFERENCES users (company_id, id) ON DELETE SET NULL;

-- repair_parts.repair_order_id -> repair_orders
ALTER TABLE repair_parts DROP CONSTRAINT repair_parts_repair_order_id_fkey;
ALTER TABLE repair_parts ADD CONSTRAINT repair_parts_repair_order_id_company_fkey
  FOREIGN KEY (company_id, repair_order_id) REFERENCES repair_orders (company_id, id) ON DELETE CASCADE;

-- repair_parts.product_id -> products
ALTER TABLE repair_parts DROP CONSTRAINT repair_parts_product_id_fkey;
ALTER TABLE repair_parts ADD CONSTRAINT repair_parts_product_id_company_fkey
  FOREIGN KEY (company_id, product_id) REFERENCES products (company_id, id) ON DELETE SET NULL;

-- invoices.sale_id -> sales
ALTER TABLE invoices DROP CONSTRAINT invoices_sale_id_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_sale_id_company_fkey
  FOREIGN KEY (company_id, sale_id) REFERENCES sales (company_id, id) ON DELETE SET NULL;

-- invoice_xml.invoice_id -> invoices
ALTER TABLE invoice_xml DROP CONSTRAINT invoice_xml_invoice_id_fkey;
ALTER TABLE invoice_xml ADD CONSTRAINT invoice_xml_invoice_id_company_fkey
  FOREIGN KEY (company_id, invoice_id) REFERENCES invoices (company_id, id) ON DELETE CASCADE;

-- qr_codes.invoice_id -> invoices
ALTER TABLE qr_codes DROP CONSTRAINT qr_codes_invoice_id_fkey;
ALTER TABLE qr_codes ADD CONSTRAINT qr_codes_invoice_id_company_fkey
  FOREIGN KEY (company_id, invoice_id) REFERENCES invoices (company_id, id) ON DELETE CASCADE;

-- signatures.invoice_id -> invoices
ALTER TABLE signatures DROP CONSTRAINT signatures_invoice_id_fkey;
ALTER TABLE signatures ADD CONSTRAINT signatures_invoice_id_company_fkey
  FOREIGN KEY (company_id, invoice_id) REFERENCES invoices (company_id, id) ON DELETE CASCADE;

-- zatca_logs.invoice_id -> invoices
ALTER TABLE zatca_logs DROP CONSTRAINT zatca_logs_invoice_id_fkey;
ALTER TABLE zatca_logs ADD CONSTRAINT zatca_logs_invoice_id_company_fkey
  FOREIGN KEY (company_id, invoice_id) REFERENCES invoices (company_id, id) ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- 4. Row Level Security — standard tenant policy (company_id = current_company_id())
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'branches', 'users', 'user_roles', 'categories', 'brands', 'warehouses',
    'products', 'stock', 'stock_movements', 'payment_methods', 'payment_method_fee_layers',
    'sales', 'sale_items', 'payments', 'offline_queue', 'sync_logs',
    'repair_orders', 'repair_parts', 'invoices', 'invoice_xml', 'qr_codes',
    'signatures', 'zatca_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (company_id = current_company_id()) WITH CHECK (company_id = current_company_id())',
      t
    );
  END LOOP;
END $$;

-- companies: tenant sees only its own row (matched by id, not company_id)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON companies
  USING (id = current_company_id())
  WITH CHECK (id = current_company_id());

-- roles: company_id nullable (global system templates) — visible to all tenants,
-- but a tenant connection may only write rows scoped to its own company.
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON roles
  USING (company_id IS NULL OR company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

COMMIT;
