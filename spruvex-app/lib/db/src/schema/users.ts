import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  username: text("username").notNull().unique(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("cashier"),
  permissions: text("permissions"),
  isActive: boolean("is_active").notNull().default(true),
  // Cross-tenant SpruVex staff access (view/manage every company's plan,
  // add-ons, and subscription status). Deliberately NOT modeled as a global
  // role in rolesTable: every global role there is assignable by any tenant
  // admin via the existing role-assignment endpoint (see
  // roleService.assignUserRole -> roleRepo.findAccessibleById, which treats
  // every companyId-null role as fair game for any company to grant its own
  // users) — a "platform_admin" global role would let a tenant self-escalate
  // to cross-tenant access. This flag has no such endpoint; it's settable
  // only via direct DB access / a bootstrap script, never through the API.
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof usersTable.$inferSelect;
export type PublicUser = Omit<User, "passwordHash">;
