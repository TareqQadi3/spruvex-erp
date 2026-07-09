-- =============================================================================
-- SpruVex ERP — Enterprise Multi-Tenant SaaS Database Schema
-- Dialect: PostgreSQL 14+
--
-- Sections:
--   1. Multi-tenant core        (companies, users)
--   2. Branch system            (branches)
--   3. RBAC + branch-level perms(permissions, roles, role_permissions, user_roles)
--   4. Inventory                (categories, brands, warehouses, products, stock, stock_movements)
--   5. POS                      (payment_methods, payment_method_fee_layers, sales, sale_items, payments)
--   6. Offline sync             (offline_queue, sync_logs)
--   7. Repair                   (repair_orders, repair_parts)
--   8. ZATCA compliance         (invoices, invoice_xml, qr_codes, signatures, zatca_logs)
--
-- Conventions:
--   - All primary keys are UUID (gen_random_uuid()).
--   - Every tenant-owned table carries company_id, indexed and FK'd to companies(id).
--   - Timestamps are TIMESTAMPTZ; created_at/updated_at auto-maintained via trigger.
--   - Enum-like fields use CHECK constraints (not native ENUM) so values can be
--     extended with a plain migration instead of an ALTER TYPE.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Generic updated_at maintainer, attached per-table below.
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- 1. MULTI-TENANT CORE
-- =============================================================================

CREATE TABLE companies (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  legal_name           TEXT,
  tax_number           TEXT,
  -- Product SKU purchased, not a feature tier: pricing is packaged as three
  -- fixed products plus a quote-based enterprise plan, not basic/pro tiers.
  plan                 TEXT NOT NULL DEFAULT 'business_erp'
                         CHECK (plan IN ('business_erp', 'restaurant', 'sales_repair', 'enterprise')),
  status               TEXT NOT NULL DEFAULT 'trial'
                         CHECK (status IN ('trial', 'active', 'suspended', 'cancelled')),
  enabled_modules      JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_users            INTEGER NOT NULL DEFAULT 3,
  max_branches         INTEGER NOT NULL DEFAULT 1,
  max_warehouses       INTEGER NOT NULL DEFAULT 1,
  trial_ends_at        TIMESTAMPTZ,
  subscription_ends_at TIMESTAMPTZ,
  currency             TEXT NOT NULL DEFAULT 'SAR',
  timezone             TEXT NOT NULL DEFAULT 'Asia/Riyadh',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Branches are declared after companies but users reference branches, so the
-- users table is created further below (see section 2 for branches, then users
-- is completed with its branch_id FK via ALTER at the end of section 2).

-- =============================================================================
-- 2. BRANCH SYSTEM
-- =============================================================================

-- Branches are optional: a single-location tenant simply has zero rows here
-- and every branch_id elsewhere stays NULL, meaning "applies company-wide."
CREATE TABLE branches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  code         TEXT,
  address      TEXT,
  city         TEXT,
  phone        TEXT,
  is_default   BOOLEAN NOT NULL DEFAULT false,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE INDEX idx_branches_company_id ON branches(company_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  -- Home branch only; actual access grants (which branches a user may act in)
  -- live in user_roles, not here.
  branch_id      UUID REFERENCES branches(id) ON DELETE SET NULL,
  username       TEXT NOT NULL UNIQUE,
  email          TEXT,
  password_hash  TEXT NOT NULL,
  full_name      TEXT NOT NULL,
  phone          TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, email)
);

CREATE INDEX idx_users_company_id ON users(company_id);
CREATE INDEX idx_users_branch_id ON users(branch_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

ALTER TABLE branches
  ADD COLUMN manager_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- =============================================================================
-- 3. ROLE-BASED ACCESS CONTROL (with branch-level permissions)
-- =============================================================================

-- Global permission catalog: shared across all tenants, never tenant-owned.
CREATE TABLE permissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT NOT NULL UNIQUE,
  module       TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_permissions_module ON permissions(module);

-- Roles are tenant-scoped custom bundles of permissions. company_id NULL marks
-- a system default role template (e.g. "Cashier") available to every tenant.
CREATE TABLE roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID REFERENCES companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  is_system     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE INDEX idx_roles_company_id ON roles(company_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE role_permissions (
  role_id        UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id  UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Assigns a role to a user. branch_id = NULL means the role applies company-wide;
-- a non-null branch_id scopes that grant to only that branch (e.g. a user can be
-- "Store Manager" at Branch A and just "Cashier" at Branch B via two rows here).
CREATE TABLE user_roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id      UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  branch_id    UUID REFERENCES branches(id) ON DELETE CASCADE,
  granted_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id, branch_id)
);

CREATE INDEX idx_user_roles_company_id ON user_roles(company_id);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_branch_id ON user_roles(branch_id);

-- =============================================================================
-- 4. INVENTORY SYSTEM
-- =============================================================================

CREATE TABLE categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  parent_id    UUID REFERENCES categories(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_company_id ON categories(company_id);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE brands (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE INDEX idx_brands_company_id ON brands(company_id);

CREATE TABLE warehouses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id    UUID REFERENCES branches(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  address      TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_warehouses_company_id ON warehouses(company_id);
CREATE INDEX idx_warehouses_branch_id ON warehouses(branch_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON warehouses
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE products (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id          UUID REFERENCES categories(id) ON DELETE SET NULL,
  brand_id             UUID REFERENCES brands(id) ON DELETE SET NULL,
  sku                  TEXT NOT NULL,
  barcode              TEXT,
  name                 TEXT NOT NULL,
  description          TEXT,
  cost_price           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  selling_price        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_rate             NUMERIC(5, 2) NOT NULL DEFAULT 15.00,
  includes_tax         BOOLEAN NOT NULL DEFAULT false,
  low_stock_threshold  INTEGER NOT NULL DEFAULT 5,
  image_url            TEXT,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, sku)
);

CREATE INDEX idx_products_company_id ON products(company_id);
CREATE INDEX idx_products_barcode ON products(company_id, barcode);
CREATE INDEX idx_products_category_id ON products(category_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Current on-hand quantity per product per warehouse. stock_movements below is
-- the append-only ledger; this table is the derived, queryable snapshot kept in
-- sync with it (via application logic or a trigger on stock_movements).
CREATE TABLE stock (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id         UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id       UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  quantity           INTEGER NOT NULL DEFAULT 0,
  reserved_quantity  INTEGER NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, warehouse_id)
);

CREATE INDEX idx_stock_company_id ON stock(company_id);
CREATE INDEX idx_stock_warehouse_id ON stock(warehouse_id);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON stock
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Append-only audit trail of every stock change. reference_type/reference_id
-- point at whatever caused the movement (a sale, a purchase, a manual
-- adjustment) without needing a separate FK per possible source table.
CREATE TABLE stock_movements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  product_id         UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id       UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  movement_type      TEXT NOT NULL
                       CHECK (movement_type IN (
                         'purchase', 'sale', 'sale_return', 'purchase_return',
                         'transfer_in', 'transfer_out', 'adjustment_in', 'adjustment_out'
                       )),
  quantity           INTEGER NOT NULL,
  reference_type     TEXT,
  reference_id       UUID,
  notes              TEXT,
  created_by         UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_company_id ON stock_movements(company_id);
CREATE INDEX idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- =============================================================================
-- 5. POS SYSTEM
-- =============================================================================

CREATE TABLE payment_methods (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name                  TEXT NOT NULL,
  type                  TEXT NOT NULL DEFAULT 'custom'
                          CHECK (type IN ('cash', 'mada', 'card', 'tabby', 'tamara', 'custom')),
  show_fee_to_customer  BOOLEAN NOT NULL DEFAULT true,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, name)
);

CREATE INDEX idx_payment_methods_company_id ON payment_methods(company_id);

-- Up to 3 stacked fee layers per method (e.g. a fixed gateway fee + a percentage
-- processor fee + a percentage tax-on-fee), applied in layer_order.
CREATE TABLE payment_method_fee_layers (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method_id  UUID NOT NULL REFERENCES payment_methods(id) ON DELETE CASCADE,
  layer_order        SMALLINT NOT NULL CHECK (layer_order BETWEEN 1 AND 3),
  fee_type           TEXT NOT NULL CHECK (fee_type IN ('percent', 'fixed')),
  value              NUMERIC(10, 4) NOT NULL DEFAULT 0,
  UNIQUE (payment_method_id, layer_order)
);

CREATE TABLE sales (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES branches(id) ON DELETE SET NULL,
  warehouse_id     UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  cashier_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  sale_number      TEXT NOT NULL,
  customer_name    TEXT,
  customer_phone   TEXT,
  subtotal         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount_amount  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_amount       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'completed'
                     CHECK (status IN ('completed', 'held', 'void', 'refunded')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, sale_number)
);

CREATE INDEX idx_sales_company_id ON sales(company_id);
CREATE INDEX idx_sales_branch_id ON sales(branch_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);

CREATE TABLE sale_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sale_id       UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity      INTEGER NOT NULL,
  unit_price    NUMERIC(12, 2) NOT NULL,
  discount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total         NUMERIC(12, 2) NOT NULL
);

CREATE INDEX idx_sale_items_company_id ON sale_items(company_id);
CREATE INDEX idx_sale_items_sale_id ON sale_items(sale_id);

-- Fees only apply to the amount routed through that specific method, per split-
-- payment rules; fee_amount is captured at time of sale to preserve history
-- even if the payment method's fee configuration changes later.
CREATE TABLE payments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sale_id            UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  payment_method_id  UUID NOT NULL REFERENCES payment_methods(id) ON DELETE RESTRICT,
  amount             NUMERIC(12, 2) NOT NULL,
  fee_amount         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  reference_number   TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_company_id ON payments(company_id);
CREATE INDEX idx_payments_sale_id ON payments(sale_id);

-- =============================================================================
-- 6. OFFLINE SYNC SYSTEM
-- =============================================================================

-- One row per client-side mutation made while offline. client_generated_id is
-- produced on the device so retried syncs are idempotent (unique per company).
CREATE TABLE offline_queue (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id            UUID REFERENCES branches(id) ON DELETE SET NULL,
  user_id              UUID REFERENCES users(id) ON DELETE SET NULL,
  device_id            TEXT NOT NULL,
  client_generated_id  UUID NOT NULL,
  entity_type          TEXT NOT NULL,
  operation            TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  payload              JSONB NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'synced', 'failed', 'conflict')),
  error_message        TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at            TIMESTAMPTZ,
  UNIQUE (company_id, client_generated_id)
);

CREATE INDEX idx_offline_queue_company_id ON offline_queue(company_id);
CREATE INDEX idx_offline_queue_status ON offline_queue(status);
CREATE INDEX idx_offline_queue_device_id ON offline_queue(device_id);

-- One row per sync batch attempt from a device, independent of individual
-- offline_queue rows, so sync health can be monitored per device over time.
CREATE TABLE sync_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id         UUID REFERENCES branches(id) ON DELETE SET NULL,
  device_id         TEXT NOT NULL,
  status            TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  records_synced    INTEGER NOT NULL DEFAULT 0,
  records_failed    INTEGER NOT NULL DEFAULT 0,
  details           JSONB,
  started_at        TIMESTAMPTZ NOT NULL,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_logs_company_id ON sync_logs(company_id);
CREATE INDEX idx_sync_logs_device_id ON sync_logs(device_id);

-- =============================================================================
-- 7. REPAIR SYSTEM
-- =============================================================================

CREATE TABLE repair_orders (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id           UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  branch_id            UUID REFERENCES branches(id) ON DELETE SET NULL,
  technician_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  ticket_number        TEXT NOT NULL,
  customer_name        TEXT NOT NULL,
  customer_phone       TEXT,
  device_type          TEXT NOT NULL,
  brand                TEXT,
  model                TEXT,
  serial_number        TEXT,
  issue_description    TEXT NOT NULL,
  technician_notes     TEXT,
  status               TEXT NOT NULL DEFAULT 'received'
                         CHECK (status IN (
                           'received', 'diagnosed', 'waiting_approval',
                           'repairing', 'completed', 'delivered', 'cancelled'
                         )),
  labor_cost           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  parts_cost           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_cost           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  received_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at         TIMESTAMPTZ,
  delivered_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, ticket_number)
);

CREATE INDEX idx_repair_orders_company_id ON repair_orders(company_id);
CREATE INDEX idx_repair_orders_branch_id ON repair_orders(branch_id);
CREATE INDEX idx_repair_orders_status ON repair_orders(status);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON repair_orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE repair_parts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  repair_order_id   UUID NOT NULL REFERENCES repair_orders(id) ON DELETE CASCADE,
  product_id        UUID REFERENCES products(id) ON DELETE SET NULL,
  part_name         TEXT NOT NULL,
  quantity          INTEGER NOT NULL DEFAULT 1,
  unit_cost         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_cost        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_repair_parts_company_id ON repair_parts(company_id);
CREATE INDEX idx_repair_parts_repair_order_id ON repair_parts(repair_order_id);

-- =============================================================================
-- 8. ZATCA COMPLIANCE SYSTEM
-- =============================================================================

CREATE TABLE invoices (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id       UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sale_id          UUID REFERENCES sales(id) ON DELETE SET NULL,
  invoice_number   TEXT NOT NULL,
  invoice_type     TEXT NOT NULL DEFAULT 'simplified'
                     CHECK (invoice_type IN ('standard', 'simplified')),
  zatca_uuid       UUID NOT NULL DEFAULT gen_random_uuid(),
  issue_date       TIMESTAMPTZ NOT NULL DEFAULT now(),
  supply_date      DATE,
  currency         TEXT NOT NULL DEFAULT 'SAR',
  total_amount     NUMERIC(12, 2) NOT NULL DEFAULT 0,
  vat_amount       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'issued', 'cleared', 'reported', 'cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, invoice_number)
);

CREATE INDEX idx_invoices_company_id ON invoices(company_id);
CREATE INDEX idx_invoices_sale_id ON invoices(sale_id);
CREATE INDEX idx_invoices_status ON invoices(status);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Generated UBL 2.1 XML per invoice, kept 1:1 so it can be re-submitted or
-- re-downloaded without regenerating (regeneration would change the hash).
CREATE TABLE invoice_xml (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id    UUID NOT NULL UNIQUE REFERENCES invoices(id) ON DELETE CASCADE,
  ubl_version   TEXT NOT NULL DEFAULT '2.1',
  xml_content   TEXT NOT NULL,
  xml_hash      TEXT NOT NULL,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoice_xml_company_id ON invoice_xml(company_id);

CREATE TABLE qr_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id    UUID NOT NULL UNIQUE REFERENCES invoices(id) ON DELETE CASCADE,
  qr_content    TEXT NOT NULL, -- base64-encoded TLV per ZATCA QR spec
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_qr_codes_company_id ON qr_codes(company_id);

-- Cryptographic stamp chain: previous_invoice_hash links each invoice to the
-- prior one (the PIH chain ZATCA Phase 2 requires), so tampering with any past
-- invoice breaks the hash chain for every invoice after it.
CREATE TABLE signatures (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id            UUID NOT NULL UNIQUE REFERENCES invoices(id) ON DELETE CASCADE,
  previous_invoice_hash TEXT,
  invoice_hash          TEXT NOT NULL,
  signature_value       TEXT NOT NULL,
  signing_certificate   TEXT,
  algorithm             TEXT NOT NULL DEFAULT 'ECDSA-SHA256',
  signed_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_signatures_company_id ON signatures(company_id);

-- One row per ZATCA API call (compliance check / clearance / reporting) so a
-- rejected or retried submission never overwrites the previous attempt's record.
CREATE TABLE zatca_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invoice_id        UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  request_type      TEXT NOT NULL CHECK (request_type IN ('compliance_check', 'clearance', 'reporting')),
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  http_status_code  INTEGER,
  request_payload   JSONB,
  response_payload  JSONB,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at      TIMESTAMPTZ
);

CREATE INDEX idx_zatca_logs_company_id ON zatca_logs(company_id);
CREATE INDEX idx_zatca_logs_invoice_id ON zatca_logs(invoice_id);
