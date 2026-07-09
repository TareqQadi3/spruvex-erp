-- =============================================================================
-- Final alignment patch — closes every remaining conflict identified across
-- PROJECT_VISION.md / database_schema.sql / the real spruvex-app codebase.
-- Apply after: database_schema.sql, then database_schema_final_patch.sql.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- A. Foundation bug fixes (flagged during validation, not yet applied)
-- -----------------------------------------------------------------------------

-- roles: plain UNIQUE(company_id, name) doesn't stop duplicate system-role
-- names, since NULL <> NULL for company_id on global templates.
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_company_id_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS roles_company_name_key ON roles(company_id, name) WHERE company_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS roles_global_name_key ON roles(name) WHERE company_id IS NULL;

-- branches: nothing stopped two branches in the same company both being default.
CREATE UNIQUE INDEX IF NOT EXISTS branches_one_default_per_company ON branches(company_id) WHERE is_default;

-- -----------------------------------------------------------------------------
-- B. New master-data tables required by decisions already made (customers,
--    suppliers) — real code already depends on both via FK.
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS customers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  vat_number   TEXT, -- required for ZATCA 'standard' (B2B) invoices
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_company_id_fkey;
ALTER TABLE customers ADD CONSTRAINT customers_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_company_id_id_key;
ALTER TABLE customers ADD CONSTRAINT customers_company_id_id_key UNIQUE (company_id, id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON customers(company_id);
DROP TRIGGER IF EXISTS set_updated_at ON customers;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE IF NOT EXISTS suppliers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_company_id_fkey;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE suppliers DROP CONSTRAINT IF EXISTS suppliers_company_id_id_key;
ALTER TABLE suppliers ADD CONSTRAINT suppliers_company_id_id_key UNIQUE (company_id, id);
CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON suppliers(company_id);

-- -----------------------------------------------------------------------------
-- C. Inventory gaps: products.supplier_id, warehouse_sections, stock.section_id
-- -----------------------------------------------------------------------------

ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier_id UUID;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_supplier_id_company_fkey;
ALTER TABLE products ADD CONSTRAINT products_supplier_id_company_fkey
  FOREIGN KEY (company_id, supplier_id) REFERENCES suppliers (company_id, id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS warehouse_sections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL,
  warehouse_id  UUID NOT NULL,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE warehouse_sections DROP CONSTRAINT IF EXISTS warehouse_sections_company_id_fkey;
ALTER TABLE warehouse_sections ADD CONSTRAINT warehouse_sections_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE warehouse_sections DROP CONSTRAINT IF EXISTS warehouse_sections_company_id_id_key;
ALTER TABLE warehouse_sections ADD CONSTRAINT warehouse_sections_company_id_id_key UNIQUE (company_id, id);
ALTER TABLE warehouse_sections DROP CONSTRAINT IF EXISTS warehouse_sections_warehouse_id_company_fkey;
ALTER TABLE warehouse_sections ADD CONSTRAINT warehouse_sections_warehouse_id_company_fkey
  FOREIGN KEY (company_id, warehouse_id) REFERENCES warehouses (company_id, id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_warehouse_sections_company_id ON warehouse_sections(company_id);

ALTER TABLE stock ADD COLUMN IF NOT EXISTS section_id UUID;
ALTER TABLE stock DROP CONSTRAINT IF EXISTS stock_section_id_company_fkey;
ALTER TABLE stock ADD CONSTRAINT stock_section_id_company_fkey
  FOREIGN KEY (company_id, section_id) REFERENCES warehouse_sections (company_id, id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- D. POS: normalize sales.customer_name/phone -> customer_id, add currency
-- -----------------------------------------------------------------------------

ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_id UUID;

INSERT INTO customers (company_id, name, phone)
SELECT DISTINCT s.company_id, s.customer_name, s.customer_phone
FROM sales s
WHERE s.customer_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM customers c
    WHERE c.company_id = s.company_id AND c.name = s.customer_name
      AND c.phone IS NOT DISTINCT FROM s.customer_phone
  );

UPDATE sales s
SET customer_id = c.id
FROM customers c
WHERE c.company_id = s.company_id
  AND c.name = s.customer_name
  AND c.phone IS NOT DISTINCT FROM s.customer_phone
  AND s.customer_id IS NULL;

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_customer_id_company_fkey;
ALTER TABLE sales ADD CONSTRAINT sales_customer_id_company_fkey
  FOREIGN KEY (company_id, customer_id) REFERENCES customers (company_id, id) ON DELETE RESTRICT;

ALTER TABLE sales DROP COLUMN IF EXISTS customer_name;
ALTER TABLE sales DROP COLUMN IF EXISTS customer_phone;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'SAR';

-- -----------------------------------------------------------------------------
-- E. POS returns: port sale_returns / sale_return_items from real code
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS sale_returns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL,
  sale_id       UUID NOT NULL,
  reason        TEXT,
  total_amount  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE sale_returns DROP CONSTRAINT IF EXISTS sale_returns_company_id_fkey;
ALTER TABLE sale_returns ADD CONSTRAINT sale_returns_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;
ALTER TABLE sale_returns DROP CONSTRAINT IF EXISTS sale_returns_company_id_id_key;
ALTER TABLE sale_returns ADD CONSTRAINT sale_returns_company_id_id_key UNIQUE (company_id, id);
ALTER TABLE sale_returns DROP CONSTRAINT IF EXISTS sale_returns_sale_id_company_fkey;
ALTER TABLE sale_returns ADD CONSTRAINT sale_returns_sale_id_company_fkey
  FOREIGN KEY (company_id, sale_id) REFERENCES sales (company_id, id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_sale_returns_company_id ON sale_returns(company_id);

CREATE TABLE IF NOT EXISTS sale_return_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL,
  sale_return_id   UUID NOT NULL,
  product_id       UUID NOT NULL,
  quantity         INTEGER NOT NULL,
  unit_price       NUMERIC(12, 2) NOT NULL,
  total            NUMERIC(12, 2) NOT NULL
);
ALTER TABLE sale_return_items DROP CONSTRAINT IF EXISTS sale_return_items_company_id_fkey;
ALTER TABLE sale_return_items ADD CONSTRAINT sale_return_items_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;
ALTER TABLE sale_return_items DROP CONSTRAINT IF EXISTS sale_return_items_sale_return_id_company_fkey;
ALTER TABLE sale_return_items ADD CONSTRAINT sale_return_items_sale_return_id_company_fkey
  FOREIGN KEY (company_id, sale_return_id) REFERENCES sale_returns (company_id, id) ON DELETE RESTRICT;
ALTER TABLE sale_return_items DROP CONSTRAINT IF EXISTS sale_return_items_product_id_company_fkey;
ALTER TABLE sale_return_items ADD CONSTRAINT sale_return_items_product_id_company_fkey
  FOREIGN KEY (company_id, product_id) REFERENCES products (company_id, id) ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS idx_sale_return_items_company_id ON sale_return_items(company_id);

-- -----------------------------------------------------------------------------
-- F. Repair domain: adopt real code as canonical (rename table + fields,
--    resolve the 3-way status conflict in code's favor, add customer_id)
-- -----------------------------------------------------------------------------

ALTER TABLE repair_orders RENAME TO repairs;
ALTER INDEX IF EXISTS idx_repair_orders_company_id RENAME TO idx_repairs_company_id;
ALTER INDEX IF EXISTS idx_repair_orders_branch_id RENAME TO idx_repairs_branch_id;
ALTER INDEX IF EXISTS idx_repair_orders_status RENAME TO idx_repairs_status;
ALTER TABLE repairs RENAME CONSTRAINT repair_orders_company_id_id_key TO repairs_company_id_id_key;
ALTER TABLE repairs RENAME CONSTRAINT repair_orders_company_id_fkey TO repairs_company_id_fkey;
ALTER TABLE repairs RENAME CONSTRAINT repair_orders_branch_id_company_fkey TO repairs_branch_id_company_fkey;
ALTER TABLE repairs RENAME CONSTRAINT repair_orders_technician_id_company_fkey TO repairs_technician_id_company_fkey;

ALTER TABLE repairs RENAME COLUMN serial_number TO imei;
ALTER TABLE repairs RENAME COLUMN brand TO device_brand;
ALTER TABLE repairs RENAME COLUMN model TO device_model;
ALTER TABLE repairs RENAME COLUMN issue_description TO problem_description;
ALTER TABLE repairs RENAME COLUMN labor_cost TO repair_cost;

ALTER TABLE repairs ADD COLUMN IF NOT EXISTS customer_id UUID;

INSERT INTO customers (company_id, name, phone)
SELECT DISTINCT r.company_id, r.customer_name, r.customer_phone
FROM repairs r
WHERE NOT EXISTS (
  SELECT 1 FROM customers c
  WHERE c.company_id = r.company_id AND c.name = r.customer_name
    AND c.phone IS NOT DISTINCT FROM r.customer_phone
);

UPDATE repairs r
SET customer_id = c.id
FROM customers c
WHERE c.company_id = r.company_id
  AND c.name = r.customer_name
  AND c.phone IS NOT DISTINCT FROM r.customer_phone
  AND r.customer_id IS NULL;

ALTER TABLE repairs DROP CONSTRAINT IF EXISTS repairs_customer_id_company_fkey;
ALTER TABLE repairs ADD CONSTRAINT repairs_customer_id_company_fkey
  FOREIGN KEY (company_id, customer_id) REFERENCES customers (company_id, id) ON DELETE RESTRICT;

ALTER TABLE repairs DROP COLUMN IF EXISTS customer_name;
ALTER TABLE repairs DROP COLUMN IF EXISTS customer_phone;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS is_paid BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE repairs ADD COLUMN IF NOT EXISTS warranty_expires_at TIMESTAMPTZ;
ALTER TABLE repairs DROP COLUMN IF EXISTS parts_cost;
ALTER TABLE repairs DROP COLUMN IF EXISTS total_cost;
ALTER TABLE repairs DROP COLUMN IF EXISTS received_at;
ALTER TABLE repairs DROP COLUMN IF EXISTS completed_at;
ALTER TABLE repairs DROP COLUMN IF EXISTS delivered_at;

-- Resolve the 3-way status conflict (vision doc vs this schema vs real code):
-- real code's enum wins, since it's implemented and UI-wired.
ALTER TABLE repairs DROP CONSTRAINT IF EXISTS repair_orders_status_check;
UPDATE repairs SET status = CASE status
  WHEN 'diagnosed'         THEN 'diagnosing'
  WHEN 'waiting_approval'  THEN 'waiting_for_parts'
  WHEN 'repairing'         THEN 'in_repair'
  WHEN 'completed'         THEN 'ready_for_pickup'
  ELSE status
END;
ALTER TABLE repairs ADD CONSTRAINT repairs_status_check CHECK (status IN (
  'received', 'diagnosing', 'waiting_for_parts', 'in_repair', 'ready_for_pickup', 'delivered', 'cancelled'
));

-- repair_parts: adopt code's part_cost/labor_fee split; rename FK column to match
ALTER TABLE repair_parts RENAME COLUMN repair_order_id TO repair_id;
ALTER TABLE repair_parts RENAME CONSTRAINT repair_parts_repair_order_id_company_fkey TO repair_parts_repair_id_company_fkey;
ALTER TABLE repair_parts RENAME COLUMN unit_cost TO part_cost;
ALTER TABLE repair_parts ADD COLUMN IF NOT EXISTS labor_fee NUMERIC(10, 2) NOT NULL DEFAULT 0;
ALTER TABLE repair_parts DROP COLUMN IF EXISTS total_cost;

-- repair_status_history: ported from real code, absent from this schema until now
CREATE TABLE IF NOT EXISTS repair_status_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL,
  repair_id    UUID NOT NULL,
  status       TEXT NOT NULL,
  notes        TEXT,
  changed_by   UUID,
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE repair_status_history DROP CONSTRAINT IF EXISTS repair_status_history_company_id_fkey;
ALTER TABLE repair_status_history ADD CONSTRAINT repair_status_history_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE RESTRICT;
ALTER TABLE repair_status_history DROP CONSTRAINT IF EXISTS repair_status_history_repair_id_company_fkey;
ALTER TABLE repair_status_history ADD CONSTRAINT repair_status_history_repair_id_company_fkey
  FOREIGN KEY (company_id, repair_id) REFERENCES repairs (company_id, id) ON DELETE RESTRICT;
ALTER TABLE repair_status_history DROP CONSTRAINT IF EXISTS repair_status_history_changed_by_company_fkey;
ALTER TABLE repair_status_history ADD CONSTRAINT repair_status_history_changed_by_company_fkey
  FOREIGN KEY (company_id, changed_by) REFERENCES users (company_id, id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_repair_status_history_company_id ON repair_status_history(company_id);
CREATE INDEX IF NOT EXISTS idx_repair_status_history_repair_id ON repair_status_history(repair_id);

-- -----------------------------------------------------------------------------
-- G. ZATCA: uniqueness fix, buyer identification, credit/debit note linkage
-- -----------------------------------------------------------------------------

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_zatca_uuid_key;
ALTER TABLE invoices ADD CONSTRAINT invoices_zatca_uuid_key UNIQUE (zatca_uuid);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_id UUID;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_customer_id_company_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_customer_id_company_fkey
  FOREIGN KEY (company_id, customer_id) REFERENCES customers (company_id, id) ON DELETE RESTRICT;

ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_invoice_type_check;
ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_type_check
  CHECK (invoice_type IN ('standard', 'simplified', 'credit_note', 'debit_note'));

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS related_invoice_id UUID;
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_related_invoice_id_company_fkey;
ALTER TABLE invoices ADD CONSTRAINT invoices_related_invoice_id_company_fkey
  FOREIGN KEY (company_id, related_invoice_id) REFERENCES invoices (company_id, id) ON DELETE RESTRICT;

COMMIT;
