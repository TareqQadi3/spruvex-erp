import { Router } from "express";
import { db, repairsTable, customersTable, repairStatusHistoryTable, repairPartsTable, usersTable, REPAIR_STATUSES } from "@workspace/db";
import { eq, and, ilike, or, desc, sql } from "drizzle-orm";
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
  technicianId: repairsTable.technicianId,
  approvedAt: repairsTable.approvedAt,
  createdAt: repairsTable.createdAt,
  updatedAt: repairsTable.updatedAt,
};

// Customer approval (repairsTable.approvedAt) must be recorded before a repair can enter
// "in_repair", no matter which status it's moving from — front desk can jump straight from
// "received" to "in_repair" for a walk-in fix, and that path must be gated too, not just the
// waiting_for_parts -> in_repair path.
const STATUS_REQUIRING_APPROVAL = "in_repair" as const;

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
  // Server-computed total: sum of each part's (unit cost * quantity) plus its labor fee.
  // Replaces any client-side cost math — this is the one source of truth for repair cost.
  const [{ total }] = await db
    .select({ total: sql<string>`coalesce(sum(${repairPartsTable.partCost} * ${repairPartsTable.quantity} + ${repairPartsTable.laborFee}), 0)` })
    .from(repairPartsTable)
    .where(and(eq(repairPartsTable.repairId, id), eq(repairPartsTable.companyId, req.user!.companyId)));
  res.json({ ...repair, totalCost: Number(total) });
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
      if (status === STATUS_REQUIRING_APPROVAL) {
        const [existing] = await tx.select({ status: repairsTable.status, approvedAt: repairsTable.approvedAt })
          .from(repairsTable)
          .where(and(eq(repairsTable.id, id), eq(repairsTable.companyId, orgId)));
        if (existing && existing.status !== STATUS_REQUIRING_APPROVAL && !existing.approvedAt) {
          throw new ValidationError("Repair must be customer-approved before moving to in_repair");
        }
      }
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
      const [existing] = await tx.select({ status: repairsTable.status, approvedAt: repairsTable.approvedAt })
        .from(repairsTable)
        .where(and(eq(repairsTable.id, id), eq(repairsTable.companyId, orgId)));
      if (
        existing
        && status === STATUS_REQUIRING_APPROVAL
        && existing.status !== STATUS_REQUIRING_APPROVAL
        && !existing.approvedAt
      ) {
        throw new ValidationError("Repair must be customer-approved before moving to in_repair");
      }
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

// Assign or reassign the technician working a repair ticket. technicianId may be null
// to unassign. Validated against this company's own users so one tenant can't assign
// another tenant's user id onto their repair.
router.patch("/:id/technician", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const orgId = req.user!.companyId;
  const { technicianId } = req.body;
  if (technicianId !== null && technicianId !== undefined) {
    const [technician] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.id, technicianId), eq(usersTable.companyId, orgId)));
    if (!technician) {
      res.status(400).json({ error: "technicianId must reference a user in this company" });
      return;
    }
  }
  const [updated] = await db.update(repairsTable).set({
    technicianId: technicianId ?? null,
    updatedAt: new Date(),
  }).where(and(eq(repairsTable.id, id), eq(repairsTable.companyId, orgId))).returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

// Marks the repair as customer-approved (sets approvedAt). This is the single flag the
// waiting_for_parts -> in_repair status transition checks for; no broader approval
// workflow beyond this timestamp.
router.patch("/:id/approve", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const orgId = req.user!.companyId;
  const [updated] = await db.update(repairsTable).set({
    approvedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(eq(repairsTable.id, id), eq(repairsTable.companyId, orgId))).returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

export default router;
