import { Router } from "express";
import { db, unitsTable, productUnitsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";

const router = Router();

// Company-wide unit catalog (Piece, Box, Carton, Kg...). Conversion factors
// live on product_units (per product), not here — the same "Box" can mean
// 12 pieces for one product and 6 for another.
router.get("/", async (req: AuthedRequest, res) => {
  const units = await db.select().from(unitsTable)
    .where(eq(unitsTable.companyId, req.user!.companyId))
    .orderBy(unitsTable.nameAr);
  res.json(units);
});

router.post("/", async (req: AuthedRequest, res) => {
  const { nameAr, nameEn, symbol } = req.body;
  if (!nameAr) {
    res.status(400).json({ error: "nameAr is required" });
    return;
  }
  const [unit] = await db.insert(unitsTable)
    .values({ companyId: req.user!.companyId, nameAr, nameEn, symbol }).returning();
  res.status(201).json(unit);
});

export default router;
