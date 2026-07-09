import { Router } from "express";
import { db, repairPartsTable, productsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";
import { ValidationError, parseRequiredNumber, parseOptionalNumber } from "../lib/validation";

const router = Router();

router.get("/", async (req: AuthedRequest, res) => {
  const { repairId } = req.query;
  if (!repairId) {
    res.status(400).json({ error: "repairId is required" });
    return;
  }
  const parts = await db.select().from(repairPartsTable)
    .where(and(
      eq(repairPartsTable.companyId, req.user!.companyId),
      eq(repairPartsTable.repairId, repairId as string),
    ))
    .orderBy(repairPartsTable.id);
  res.json(parts);
});

// Adding a part that's linked to a real inventory product consumes stock from that
// product — the same `productsTable.stock` column sales/purchases use. A part that's
// purely descriptive (no productId) doesn't touch inventory at all.
router.post("/", async (req: AuthedRequest, res) => {
  const orgId = req.user!.companyId;
  const { repairId, productId, partName, quantity, partCost, laborFee } = req.body;
  if (!repairId || !partName) {
    res.status(400).json({ error: "repairId and partName are required" });
    return;
  }

  try {
    const qty = parseOptionalNumber(quantity, "quantity") ?? 1;
    const cost = parseOptionalNumber(partCost, "partCost") ?? 0;
    const fee = parseOptionalNumber(laborFee, "laborFee") ?? 0;

    const part = await db.transaction(async (tx) => {
      if (productId) {
        const [product] = await tx.select().from(productsTable)
          .where(and(eq(productsTable.id, productId), eq(productsTable.companyId, orgId)));
        if (!product) throw new ValidationError("Product not found");
        if (product.stock < qty) throw new ValidationError(`Insufficient stock for ${product.name}`);
        await tx.update(productsTable).set({ stock: sql`${productsTable.stock} - ${qty}` })
          .where(eq(productsTable.id, productId));
      }
      const [row] = await tx.insert(repairPartsTable).values({
        companyId: orgId,
        repairId,
        productId: productId ?? null,
        partName,
        quantity: qty,
        partCost: cost.toString(),
        laborFee: fee.toString(),
      }).returning();
      return row;
    });
    res.status(201).json(part);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const { partName, quantity, partCost, laborFee, productId } = req.body;
  try {
    const [updated] = await db.update(repairPartsTable).set({
      ...(partName !== undefined ? { partName } : {}),
      ...(quantity !== undefined ? { quantity: parseRequiredNumber(quantity, "quantity") } : {}),
      ...(partCost !== undefined ? { partCost: parseRequiredNumber(partCost, "partCost").toString() } : {}),
      ...(laborFee !== undefined ? { laborFee: parseRequiredNumber(laborFee, "laborFee").toString() } : {}),
      ...(productId !== undefined ? { productId } : {}),
    }).where(and(eq(repairPartsTable.id, id), eq(repairPartsTable.companyId, req.user!.companyId))).returning();
    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  await db.delete(repairPartsTable)
    .where(and(eq(repairPartsTable.id, id), eq(repairPartsTable.companyId, req.user!.companyId)));
  res.status(204).send();
});

export default router;
