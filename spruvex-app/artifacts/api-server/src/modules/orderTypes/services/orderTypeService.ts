import type { OrderType } from "@workspace/db";
import { orderTypeRepository } from "../repositories/orderTypeRepository";
import type { DbClient } from "../../accounting/types";

const DEFAULT_ORDER_TYPES = [
  { key: "dine_in", name: "صالة", nameEn: "Dine In" },
  { key: "takeaway", name: "سفري", nameEn: "Take Away" },
  { key: "delivery", name: "توصيل", nameEn: "Delivery" },
  { key: "pickup", name: "استلام", nameEn: "Pickup" },
];

export interface CreateOrderTypeInput {
  key: string;
  name: string;
  nameEn?: string;
}

export async function getOrSeedOrderTypes(db: DbClient, companyId: string): Promise<OrderType[]> {
  const existing = await orderTypeRepository.listActive(db, companyId);
  if (existing.length > 0) return existing;

  return orderTypeRepository.insertMany(
    db,
    DEFAULT_ORDER_TYPES.map((t, i) => ({ companyId, ...t, isSystem: true, sortOrder: i })),
  );
}

// Merchants can add their own (e.g. "Catering") beyond the seeded defaults —
// order_types is a plain company-scoped list, no code change needed to
// support a new one.
export async function createOrderType(db: DbClient, companyId: string, input: CreateOrderTypeInput): Promise<OrderType> {
  if (!input.key || !input.name) throw new Error("key and name are required");
  return orderTypeRepository.insert(db, {
    companyId, key: input.key, name: input.name, nameEn: input.nameEn, isSystem: false,
  });
}
