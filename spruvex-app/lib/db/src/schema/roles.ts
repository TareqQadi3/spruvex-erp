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
    permissions: [PERMISSIONS.MANAGE_CUSTOMERS, PERMISSIONS.MANAGE_REPAIRS],
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
    permissions: [PERMISSIONS.VIEW_REPORTS, PERMISSIONS.MANAGE_ACCOUNTING],
  },
];
