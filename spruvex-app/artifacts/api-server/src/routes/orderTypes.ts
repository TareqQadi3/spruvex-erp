import { Router } from "express";
import { db, orderTypesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";

const router = Router();

const DEFAULT_ORDER_TYPES = [
  { key: "dine_in", name: "صالة", nameEn: "Dine In" },
  { key: "takeaway", name: "سفري", nameEn: "Take Away" },
  { key: "delivery", name: "توصيل", nameEn: "Delivery" },
  { key: "pickup", name: "استلام", nameEn: "Pickup" },
];

async function getOrSeedOrderTypes(companyId: string) {
  const existing = await db.select().from(orderTypesTable)
    .where(and(eq(orderTypesTable.companyId, companyId), eq(orderTypesTable.isActive, true)))
    .orderBy(orderTypesTable.sortOrder);
  if (existing.length > 0) return existing;

  return db.insert(orderTypesTable).values(
    DEFAULT_ORDER_TYPES.map((t, i) => ({ companyId, ...t, isSystem: true, sortOrder: i })),
  ).returning();
}

router.get("/", async (req: AuthedRequest, res) => {
  const types = await getOrSeedOrderTypes(req.user!.companyId);
  res.json(types);
});

// Merchants can add their own (e.g. "Catering") beyond the seeded defaults —
// order_types is a plain company-scoped list, no code change needed to
// support a new one.
router.post("/", async (req: AuthedRequest, res) => {
  const { key, name, nameEn } = req.body;
  if (!key || !name) {
    res.status(400).json({ error: "key and name are required" });
    return;
  }
  const [type] = await db.insert(orderTypesTable).values({
    companyId: req.user!.companyId, key, name, nameEn, isSystem: false,
  }).returning();
  res.status(201).json(type);
});

export default router;
