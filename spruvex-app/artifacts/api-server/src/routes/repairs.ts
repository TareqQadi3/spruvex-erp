import { Router } from "express";
import { db, repairsTable, customersTable, repairStatusHistoryTable, REPAIR_STATUSES } from "@workspace/db";
import { eq, and, ilike, or, desc } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";
import { ValidationError, parseOptionalNumber } from "../lib/validation";

const router = Router();

const REPAIR_SELECT = {
  id: repairsTable.id,
  ticketNumber: repairsTable.ticketNumber,
  customerId: repairsTable.customerId,
  customerName: customersTable.name,
  customerPhone: customersTable.phone,
  deviceType: repairsTable.deviceType,
  deviceBrand: repairsTable.deviceBrand,
  deviceModel: repairsTable.deviceModel,
  imei: repairsTable.imei,
  problemDescription: repairsTable.problemDescription,
  technicianNotes: repairsTable.technicianNotes,
  status: repairsTable.status,
  repairCost: repairsTable.repairCost,
  estimatedCost: repairsTable.estimatedCost,
  isPaid: repairsTable.isPaid,
  warrantyExpiresAt: repairsTable.warrantyExpiresAt,
  createdAt: repairsTable.createdAt,
  updatedAt: repairsTable.updatedAt,
};

function generateTicketNumber(): string {
  const date = new Date();
  const prefix = `REP-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  return `${prefix}-${suffix}`;
}

function assertValidStatus(status: string) {
  if (!REPAIR_STATUSES.includes(status as typeof REPAIR_STATUSES[number])) {
    throw new ValidationError(`status must be one of: ${REPAIR_STATUSES.join(", ")}`);
  }
}

router.get("/", async (req: AuthedRequest, res) => {
  const { status, search, customerId } = req.query;
  const conditions = [eq(repairsTable.companyId, req.user!.companyId)];
  if (status) conditions.push(eq(repairsTable.status, status as string));
  if (customerId) conditions.push(eq(repairsTable.customerId, customerId as string));

  const base = db
    .select(REPAIR_SELECT)
    .from(repairsTable)
    .leftJoin(customersTable, eq(repairsTable.customerId, customersTable.id));

  if (search) {
    conditions.push(or(
      ilike(repairsTable.ticketNumber, `%${search}%`),
      ilike(repairsTable.deviceBrand, `%${search}%`),
      ilike(repairsTable.deviceModel, `%${search}%`),
      ilike(repairsTable.imei, `%${search}%`),
      ilike(customersTable.name, `%${search}%`),
    )!);
  }

  const rows = await base.where(and(...conditions)).orderBy(repairsTable.createdAt);
  res.json(rows);
});

// Past repairs for the same physical device, matched by IMEI or serial — surfaced so
// a returning device's history (issues, parts, technician, warranty) shows up without
// the front desk having to search for it manually.
router.get("/device-history", async (req: AuthedRequest, res) => {
  const { imei } = req.query;
  if (!imei) {
    res.status(400).json({ error: "imei is required" });
    return;
  }
  const rows = await db
    .select(REPAIR_SELECT)
    .from(repairsTable)
    .leftJoin(customersTable, eq(repairsTable.customerId, customersTable.id))
    .where(and(eq(repairsTable.companyId, req.user!.companyId), eq(repairsTable.imei, imei as string)))
    .orderBy(desc(repairsTable.createdAt));
  res.json(rows);
});

router.post("/", async (req: AuthedRequest, res) => {
  const orgId = req.user!.companyId;
  const { customerId, deviceType, deviceBrand, deviceModel, imei, problemDescription, estimatedCost, technicianNotes } = req.body;
  if (!deviceType || !problemDescription) {
    res.status(400).json({ error: "deviceType and problemDescription are required" });
    return;
  }
  try {
    const repair = await db.transaction(async (tx) => {
      const [row] = await tx.insert(repairsTable).values({
        companyId: orgId,
        ticketNumber: generateTicketNumber(),
        customerId,
        deviceType,
        deviceBrand,
        deviceModel,
        imei,
        problemDescription,
        estimatedCost: parseOptionalNumber(estimatedCost, "estimatedCost")?.toString(),
        technicianNotes,
        status: "received",
      }).returning();
      await tx.insert(repairStatusHistoryTable).values({
        companyId: orgId,
        repairId: row.id,
        status: "received",
        changedBy: req.user!.id,
      });
      return row;
    });
    res.status(201).json(repair);
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const [repair] = await db
    .select(REPAIR_SELECT)
    .from(repairsTable)
    .leftJoin(customersTable, eq(repairsTable.customerId, customersTable.id))
    .where(and(eq(repairsTable.id, id), eq(repairsTable.companyId, req.user!.companyId)));
  if (!repair) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(repair);
});

router.get("/:id/history", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const rows = await db.select().from(repairStatusHistoryTable)
    .where(and(eq(repairStatusHistoryTable.repairId, id), eq(repairStatusHistoryTable.companyId, req.user!.companyId)))
    .orderBy(repairStatusHistoryTable.changedAt);
  res.json(rows);
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const orgId = req.user!.companyId;
  const { deviceType, deviceBrand, deviceModel, imei, problemDescription, technicianNotes, repairCost, estimatedCost, isPaid, status, customerId, warrantyExpiresAt } = req.body;
  try {
    if (status !== undefined) assertValidStatus(status);
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(repairsTable).set({
        ...(deviceType !== undefined ? { deviceType } : {}),
        ...(deviceBrand !== undefined ? { deviceBrand } : {}),
        ...(deviceModel !== undefined ? { deviceModel } : {}),
        ...(imei !== undefined ? { imei } : {}),
        ...(problemDescription !== undefined ? { problemDescription } : {}),
        ...(technicianNotes !== undefined ? { technicianNotes } : {}),
        ...(repairCost !== undefined ? { repairCost: parseOptionalNumber(repairCost, "repairCost")?.toString() } : {}),
        ...(estimatedCost !== undefined ? { estimatedCost: parseOptionalNumber(estimatedCost, "estimatedCost")?.toString() } : {}),
        ...(isPaid !== undefined ? { isPaid } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(customerId !== undefined ? { customerId } : {}),
        ...(warrantyExpiresAt !== undefined ? { warrantyExpiresAt } : {}),
        updatedAt: new Date(),
      }).where(and(eq(repairsTable.id, id), eq(repairsTable.companyId, orgId))).returning();
      if (row && status !== undefined) {
        await tx.insert(repairStatusHistoryTable).values({
          companyId: orgId, repairId: row.id, status, notes: technicianNotes, changedBy: req.user!.id,
        });
      }
      return row;
    });
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

router.patch("/:id/status", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const orgId = req.user!.companyId;
  const { status, technicianNotes } = req.body;
  if (!status) {
    res.status(400).json({ error: "status is required" });
    return;
  }
  try {
    assertValidStatus(status);
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(repairsTable).set({
        status,
        ...(technicianNotes !== undefined ? { technicianNotes } : {}),
        updatedAt: new Date(),
      }).where(and(eq(repairsTable.id, id), eq(repairsTable.companyId, orgId))).returning();
      if (row) {
        await tx.insert(repairStatusHistoryTable).values({
          companyId: orgId, repairId: row.id, status, notes: technicianNotes, changedBy: req.user!.id,
        });
      }
      return row;
    });
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

export default router;
