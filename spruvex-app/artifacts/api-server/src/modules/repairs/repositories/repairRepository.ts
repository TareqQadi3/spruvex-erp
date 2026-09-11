import { eq, and, ilike, or, desc, sql, type SQL } from "drizzle-orm";
import { repairsTable, customersTable, repairStatusHistoryTable, repairPartsTable, usersTable, type Repair } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

// Shape actually returned by REPAIR_SELECT below — a left join against
// customers plus a subset of repairsTable's own columns (no companyId,
// unlike the full Repair row type).
export type RepairSummary = Pick<Repair,
  "id" | "ticketNumber" | "customerId" | "deviceType" | "deviceBrand" | "deviceModel" | "imei" |
  "problemDescription" | "technicianNotes" | "status" | "repairCost" | "estimatedCost" | "isPaid" |
  "warrantyExpiresAt" | "technicianId" | "approvedAt" | "createdAt" | "updatedAt"
> & {
  customerName: string | null;
  customerPhone: string | null;
};

export const REPAIR_SELECT = {
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

export interface RepairListFilters {
  status?: string;
  customerId?: string;
  search?: string;
}

export interface InsertRepairRow {
  companyId: string;
  ticketNumber: string;
  customerId?: string;
  deviceType: string;
  deviceBrand?: string;
  deviceModel?: string;
  imei?: string;
  problemDescription: string;
  estimatedCost?: string;
  technicianNotes?: string;
  status: "received";
}

// The legacy route passed req.body.warrantyExpiresAt straight through
// untyped (implicit any) to a timestamp column — a loose Record here
// preserves that exact (untyped) behavior rather than "fixing" it, which
// would be a behavior change, not a pure migration.
export type RepairUpdate = Record<string, unknown> & { updatedAt: Date };

export const repairRepository = {
  async list(db: DbClient, companyId: string, filters: RepairListFilters) {
    const conditions = [eq(repairsTable.companyId, companyId)];
    if (filters.status) conditions.push(eq(repairsTable.status, filters.status));
    if (filters.customerId) conditions.push(eq(repairsTable.customerId, filters.customerId));

    const base = db.select(REPAIR_SELECT).from(repairsTable)
      .leftJoin(customersTable, eq(repairsTable.customerId, customersTable.id));

    if (filters.search) {
      conditions.push(or(
        ilike(repairsTable.ticketNumber, `%${filters.search}%`),
        ilike(repairsTable.deviceBrand, `%${filters.search}%`),
        ilike(repairsTable.deviceModel, `%${filters.search}%`),
        ilike(repairsTable.imei, `%${filters.search}%`),
        ilike(customersTable.name, `%${filters.search}%`),
      ) as SQL);
    }

    return base.where(and(...conditions)).orderBy(repairsTable.createdAt);
  },

  async listByImei(db: DbClient, companyId: string, imei: string) {
    return db.select(REPAIR_SELECT).from(repairsTable)
      .leftJoin(customersTable, eq(repairsTable.customerId, customersTable.id))
      .where(and(eq(repairsTable.companyId, companyId), eq(repairsTable.imei, imei)))
      .orderBy(desc(repairsTable.createdAt));
  },

  async findById(db: DbClient, companyId: string, id: string) {
    const [repair] = await db.select(REPAIR_SELECT).from(repairsTable)
      .leftJoin(customersTable, eq(repairsTable.customerId, customersTable.id))
      .where(and(eq(repairsTable.id, id), eq(repairsTable.companyId, companyId)));
    return repair;
  },

  // Server-computed total: sum of each part's (unit cost * quantity) plus its labor fee.
  // Replaces any client-side cost math — this is the one source of truth for repair cost.
  async sumPartsCost(db: DbClient, companyId: string, repairId: string): Promise<number> {
    const [{ total }] = await db
      .select({ total: sql<string>`coalesce(sum(${repairPartsTable.partCost} * ${repairPartsTable.quantity} + ${repairPartsTable.laborFee}), 0)` })
      .from(repairPartsTable)
      .where(and(eq(repairPartsTable.repairId, repairId), eq(repairPartsTable.companyId, companyId)));
    return Number(total);
  },

  async listHistory(db: DbClient, companyId: string, repairId: string) {
    return db.select().from(repairStatusHistoryTable)
      .where(and(eq(repairStatusHistoryTable.repairId, repairId), eq(repairStatusHistoryTable.companyId, companyId)))
      .orderBy(repairStatusHistoryTable.changedAt);
  },

  async insert(db: DbClient, row: InsertRepairRow) {
    const [repair] = await db.insert(repairsTable).values(row).returning();
    return repair;
  },

  async insertHistory(db: DbClient, row: { companyId: string; repairId: string; status: string; notes?: string; changedBy: string }) {
    await db.insert(repairStatusHistoryTable).values({
      companyId: row.companyId, repairId: row.repairId, status: row.status, notes: row.notes, changedBy: row.changedBy,
    });
  },

  async findStatusAndApproval(db: DbClient, companyId: string, id: string) {
    const [row] = await db.select({ status: repairsTable.status, approvedAt: repairsTable.approvedAt })
      .from(repairsTable)
      .where(and(eq(repairsTable.id, id), eq(repairsTable.companyId, companyId)));
    return row;
  },

  async update(db: DbClient, companyId: string, id: string, changes: RepairUpdate) {
    const [row] = await db.update(repairsTable).set(changes)
      .where(and(eq(repairsTable.id, id), eq(repairsTable.companyId, companyId)))
      .returning();
    return row;
  },

  async findTechnician(db: DbClient, companyId: string, technicianId: string) {
    const [technician] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(and(eq(usersTable.id, technicianId), eq(usersTable.companyId, companyId)));
    return technician;
  },

  async updateTechnician(db: DbClient, companyId: string, id: string, technicianId: string | null) {
    const [updated] = await db.update(repairsTable).set({ technicianId, updatedAt: new Date() })
      .where(and(eq(repairsTable.id, id), eq(repairsTable.companyId, companyId)))
      .returning();
    return updated;
  },
};
