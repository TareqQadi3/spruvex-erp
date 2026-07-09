import { pgTable, uuid, text, integer, timestamp, numeric, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// dine_in orders link to a restaurant_tables row via tableId; takeaway/delivery
// orders leave tableId null. Kept as one orders table (not split per type) to
// mirror how salesTable.ts models a single POS transaction table regardless
// of payment/fulfillment variant.
export const RESTAURANT_ORDER_TYPES = ["dine_in", "takeaway", "delivery"] as const;
export type RestaurantOrderType = typeof RESTAURANT_ORDER_TYPES[number];

// Order-level workflow status, from opening a ticket through completion.
export const RESTAURANT_ORDER_STATUSES = [
  "open",
  "sent_to_kitchen",
  "preparing",
  "ready",
  "served",
  "completed",
  "cancelled",
] as const;
export type RestaurantOrderStatus = typeof RESTAURANT_ORDER_STATUSES[number];

export const restaurantOrdersTable = pgTable("restaurant_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  branchId: uuid("branch_id"),
  orderNumber: text("order_number").notNull(),
  tableId: uuid("table_id"), // null for takeaway/delivery
  customerId: uuid("customer_id"),
  orderType: text("order_type").$type<RestaurantOrderType>().notNull().default("dine_in"),
  status: text("status").$type<RestaurantOrderStatus>().notNull().default("open"),
  // Optional link to the POS transaction once the order is rung up/paid —
  // restaurant_orders tracks the table/kitchen workflow, sales.ts tracks the
  // financial transaction; kept separate the same way repairs.ts is separate
  // from sales.ts even though a repair may eventually be paid via a sale.
  saleId: uuid("sale_id"),
  cashSessionId: uuid("cash_session_id"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull().default("0"),
  guestCount: integer("guest_count"),
  notes: text("notes"),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("restaurant_orders_company_number_idx").on(table.companyId, table.orderNumber),
]);

export const insertRestaurantOrderSchema = createInsertSchema(restaurantOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRestaurantOrder = z.infer<typeof insertRestaurantOrderSchema>;
export type RestaurantOrder = typeof restaurantOrdersTable.$inferSelect;

// Item-level KDS tracking status — independent of the parent order's status
// since different items on the same order can be at different prep stages
// (e.g. drinks ready while the grill item is still preparing).
export const RESTAURANT_ORDER_ITEM_STATUSES = [
  "pending",
  "preparing",
  "ready",
  "served",
  "cancelled",
] as const;
export type RestaurantOrderItemStatus = typeof RESTAURANT_ORDER_ITEM_STATUSES[number];

// companyId is denormalized alongside orderId on purpose, same rationale as
// saleItemsTable in sales.ts: direct tenant-scoped queries (KDS screens
// filtering "all pending items for this company/station") shouldn't require
// a join through restaurant_orders first.
export const restaurantOrderItemsTable = pgTable("restaurant_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  orderId: uuid("order_id").notNull(),
  menuItemId: uuid("menu_item_id").notNull(),
  itemName: text("item_name").notNull(), // snapshot at order time, mirrors saleItemsTable.productName
  station: text("station"), // snapshot of menuItemsTable.station for KDS routing at order time
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  modifiersTotal: numeric("modifiers_total", { precision: 10, scale: 2 }).notNull().default("0"),
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  status: text("status").$type<RestaurantOrderItemStatus>().notNull().default("pending"),
  specialInstructions: text("special_instructions"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRestaurantOrderItemSchema = createInsertSchema(restaurantOrderItemsTable).omit({ id: true, createdAt: true });
export type InsertRestaurantOrderItem = z.infer<typeof insertRestaurantOrderItemSchema>;
export type RestaurantOrderItem = typeof restaurantOrderItemsTable.$inferSelect;

// Selected modifier options for a given order item (e.g. the order item
// "Cheeseburger" carries rows for "Extra cheese" and "No onions"). Price
// snapshot at order time, same denormalization rationale as above.
export const restaurantOrderItemModifiersTable = pgTable("restaurant_order_item_modifiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  orderItemId: uuid("order_item_id").notNull(),
  modifierOptionId: uuid("modifier_option_id").notNull(),
  optionName: text("option_name").notNull(), // snapshot at order time
  priceDelta: numeric("price_delta", { precision: 10, scale: 2 }).notNull().default("0"),
});

export const insertRestaurantOrderItemModifierSchema = createInsertSchema(restaurantOrderItemModifiersTable).omit({ id: true });
export type InsertRestaurantOrderItemModifier = z.infer<typeof insertRestaurantOrderItemModifierSchema>;
export type RestaurantOrderItemModifier = typeof restaurantOrderItemModifiersTable.$inferSelect;
