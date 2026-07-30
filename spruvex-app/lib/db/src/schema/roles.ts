import { pgTable, uuid, text, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// companyId NULL = global system template shared by every tenant (seeded once,
// read-only via the API); non-null = a tenant's own custom role. A plain
// UNIQUE(company_id, name) doesn't stop two global rows sharing a name (SQL
// treats NULL <> NULL), hence the two partial indexes below instead.
export const rolesTable = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id"),
  name: text("name").notNull(),
  displayName: text("display_name").notNull(),
  // Legacy inline JSON snapshot, superseded by the role_permissions table —
  // kept only so any not-yet-migrated code still reading it doesn't break.
  permissions: text("permissions").notNull().default("[]"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("roles_global_name_idx").on(table.name).where(sql`${table.companyId} is null`),
  uniqueIndex("roles_company_name_idx").on(table.companyId, table.name).where(sql`${table.companyId} is not null`),
]);

export type Role = typeof rolesTable.$inferSelect;

export const PERMISSIONS = {
  ADD_PRODUCT: "add_product",
  EDIT_PRODUCT_PRICE: "edit_product_price",
  OVERRIDE_DISCOUNT: "override_discount",
  VIEW_REPORTS: "view_reports",
  MANAGE_INVENTORY: "manage_inventory",
  MANAGE_CUSTOMERS: "manage_customers",
  MANAGE_REPAIRS: "manage_repairs",
  MANAGE_ACCOUNTING: "manage_accounting",
  MANAGE_SETTINGS: "manage_settings",
  // Phase 6 — granular, dot-namespaced catalog. Coexists with the flat
  // codes above (still used by earlier modules); new route gating and the
  // Roles/Permissions admin UI target these instead of adding more flat
  // codes to that first batch.
  PRODUCTS_VIEW: "products.view",
  PRODUCTS_CREATE: "products.create",
  PRODUCTS_UPDATE: "products.update",
  PRODUCTS_DELETE: "products.delete",
  SALES_CREATE: "sales.create",
  SALES_CANCEL: "sales.cancel",
  SALES_DISCOUNT: "sales.discount",
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_ADJUST: "inventory.adjust",
  REPORTS_VIEW: "reports.view",
  USERS_MANAGE: "users.manage",
  AUDIT_VIEW: "audit.view",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const DEFAULT_ROLES: Array<{ name: string; displayName: string; permissions: Permission[] }> = [
  {
    name: "admin",
    displayName: "Administrator",
    permissions: Object.values(PERMISSIONS) as Permission[],
  },
  {
    name: "cashier",
    displayName: "Cashier",
    permissions: [
      PERMISSIONS.MANAGE_CUSTOMERS, PERMISSIONS.MANAGE_REPAIRS,
      PERMISSIONS.SALES_CREATE, PERMISSIONS.SALES_DISCOUNT, PERMISSIONS.PRODUCTS_VIEW, PERMISSIONS.INVENTORY_VIEW,
    ],
  },
  {
    name: "store_manager",
    displayName: "Store Manager",
    permissions: Object.values(PERMISSIONS) as Permission[],
  },
  {
    name: "warehouse_staff",
    displayName: "Warehouse Staff",
    permissions: [PERMISSIONS.ADD_PRODUCT, PERMISSIONS.MANAGE_INVENTORY],
  },
  {
    name: "accountant",
    displayName: "Accountant",
    permissions: [PERMISSIONS.VIEW_REPORTS, PERMISSIONS.MANAGE_ACCOUNTING, PERMISSIONS.REPORTS_VIEW],
  },
  // Phase 6's explicitly-requested role set — distinct rows from the legacy
  // five above (never renamed/removed, to avoid breaking existing
  // users.role/user_roles assignments); usersRoleSyncService maps
  // users.role strings onto these by name.
  {
    name: "owner",
    displayName: "Owner",
    // Every code, old flat set included — routes still gated by the earlier
    // flat catalog (e.g. modules/inventory's MANAGE_INVENTORY) must also
    // work for Owner, not just the new dot-namespaced codes.
    permissions: Object.values(PERMISSIONS) as Permission[],
  },
  {
    name: "manager",
    displayName: "Manager",
    permissions: (Object.values(PERMISSIONS) as Permission[]).filter(p => p !== PERMISSIONS.USERS_MANAGE),
  },
  {
    name: "inventory_staff",
    displayName: "Inventory Staff",
    permissions: [
      PERMISSIONS.PRODUCTS_VIEW, PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_ADJUST,
      PERMISSIONS.ADD_PRODUCT, PERMISSIONS.MANAGE_INVENTORY,
    ],
  },
];

// users.role (flat legacy string) -> DEFAULT_ROLES name, used to lazily
// backfill a user_roles row the first time a legacy-pipeline route needs a
// granular-permission check. "cashier"/"accountant" map onto themselves
// since those names already match a DEFAULT_ROLES entry.
export const LEGACY_ROLE_TO_DEFAULT_ROLE: Record<string, string> = {
  admin: "owner",
  store_manager: "manager",
  cashier: "cashier",
  warehouse_staff: "inventory_staff",
  accountant: "accountant",
};
