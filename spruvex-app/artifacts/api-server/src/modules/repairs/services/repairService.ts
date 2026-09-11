import { db, REPAIR_STATUSES, type Repair } from "@workspace/db";
import { ValidationError, parseOptionalNumber } from "../../../lib/validation";
import { repairRepository, type RepairListFilters, type RepairUpdate, type RepairSummary } from "../repositories/repairRepository";

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

export async function listRepairs(companyId: string, filters: RepairListFilters) {
  return repairRepository.list(db, companyId, filters);
}

export async function listRepairsByImei(companyId: string, imei: string) {
  return repairRepository.listByImei(db, companyId, imei);
}

export interface RepairDetail extends RepairSummary {
  totalCost: number;
}

export async function getRepairDetail(companyId: string, id: string): Promise<RepairDetail | undefined> {
  const repair = await repairRepository.findById(db, companyId, id);
  if (!repair) return undefined;
  const total = await repairRepository.sumPartsCost(db, companyId, id);
  return { ...repair, totalCost: total };
}

export async function getRepairHistory(companyId: string, id: string) {
  return repairRepository.listHistory(db, companyId, id);
}

export interface CreateRepairInput {
  customerId?: string;
  deviceType: string;
  deviceBrand?: string;
  deviceModel?: string;
  imei?: string;
  problemDescription: string;
  estimatedCost?: number;
  technicianNotes?: string;
}

export async function createRepair(companyId: string, userId: string, input: CreateRepairInput): Promise<Repair> {
  if (!input.deviceType || !input.problemDescription) {
    throw new ValidationError("deviceType and problemDescription are required");
  }
  return db.transaction(async (tx) => {
    const row = await repairRepository.insert(tx, {
      companyId,
      ticketNumber: generateTicketNumber(),
      customerId: input.customerId,
      deviceType: input.deviceType,
      deviceBrand: input.deviceBrand,
      deviceModel: input.deviceModel,
      imei: input.imei,
      problemDescription: input.problemDescription,
      estimatedCost: parseOptionalNumber(input.estimatedCost, "estimatedCost")?.toString(),
      technicianNotes: input.technicianNotes,
      status: "received",
    });
    await repairRepository.insertHistory(tx, {
      companyId, repairId: row.id, status: "received", changedBy: userId,
    });
    return row;
  });
}

export interface UpdateRepairInput {
  deviceType?: string;
  deviceBrand?: string;
  deviceModel?: string;
  imei?: string;
  problemDescription?: string;
  technicianNotes?: string;
  repairCost?: number;
  estimatedCost?: number;
  isPaid?: boolean;
  status?: string;
  customerId?: string;
  warrantyExpiresAt?: string;
}

export async function updateRepair(companyId: string, userId: string, id: string, input: UpdateRepairInput): Promise<Repair | undefined> {
  if (input.status !== undefined) assertValidStatus(input.status);

  return db.transaction(async (tx) => {
    if (input.status === STATUS_REQUIRING_APPROVAL) {
      const existing = await repairRepository.findStatusAndApproval(tx, companyId, id);
      if (existing && existing.status !== STATUS_REQUIRING_APPROVAL && !existing.approvedAt) {
        throw new ValidationError("Repair must be customer-approved before moving to in_repair");
      }
    }
    const changes: RepairUpdate = { updatedAt: new Date() };
    if (input.deviceType !== undefined) changes.deviceType = input.deviceType;
    if (input.deviceBrand !== undefined) changes.deviceBrand = input.deviceBrand;
    if (input.deviceModel !== undefined) changes.deviceModel = input.deviceModel;
    if (input.imei !== undefined) changes.imei = input.imei;
    if (input.problemDescription !== undefined) changes.problemDescription = input.problemDescription;
    if (input.technicianNotes !== undefined) changes.technicianNotes = input.technicianNotes;
    if (input.repairCost !== undefined) changes.repairCost = parseOptionalNumber(input.repairCost, "repairCost")?.toString();
    if (input.estimatedCost !== undefined) changes.estimatedCost = parseOptionalNumber(input.estimatedCost, "estimatedCost")?.toString();
    if (input.isPaid !== undefined) changes.isPaid = input.isPaid;
    if (input.status !== undefined) changes.status = input.status;
    if (input.customerId !== undefined) changes.customerId = input.customerId;
    if (input.warrantyExpiresAt !== undefined) changes.warrantyExpiresAt = input.warrantyExpiresAt;

    const row = await repairRepository.update(tx, companyId, id, changes);
    if (row && input.status !== undefined) {
      await repairRepository.insertHistory(tx, {
        companyId, repairId: row.id, status: input.status, notes: input.technicianNotes, changedBy: userId,
      });
    }
    return row;
  });
}

export async function patchRepairStatus(companyId: string, userId: string, id: string, status: string, technicianNotes?: string): Promise<Repair | undefined> {
  if (!status) throw new ValidationError("status is required");
  assertValidStatus(status);

  return db.transaction(async (tx) => {
    const existing = await repairRepository.findStatusAndApproval(tx, companyId, id);
    if (
      existing
      && status === STATUS_REQUIRING_APPROVAL
      && existing.status !== STATUS_REQUIRING_APPROVAL
      && !existing.approvedAt
    ) {
      throw new ValidationError("Repair must be customer-approved before moving to in_repair");
    }
    const changes: RepairUpdate = { status, updatedAt: new Date() };
    if (technicianNotes !== undefined) changes.technicianNotes = technicianNotes;
    const row = await repairRepository.update(tx, companyId, id, changes);
    if (row) {
      await repairRepository.insertHistory(tx, {
        companyId, repairId: row.id, status, notes: technicianNotes, changedBy: userId,
      });
    }
    return row;
  });
}

export class InvalidTechnicianError extends Error {}

// Assign or reassign the technician working a repair ticket. technicianId may be null
// to unassign. Validated against this company's own users so one tenant can't assign
// another tenant's user id onto their repair.
export async function assignTechnician(companyId: string, id: string, technicianId: string | null | undefined): Promise<Repair | undefined> {
  if (technicianId !== null && technicianId !== undefined) {
    const technician = await repairRepository.findTechnician(db, companyId, technicianId);
    if (!technician) throw new InvalidTechnicianError("technicianId must reference a user in this company");
  }
  return repairRepository.updateTechnician(db, companyId, id, technicianId ?? null);
}

// Marks the repair as customer-approved (sets approvedAt). This is the single flag the
// waiting_for_parts -> in_repair status transition checks for; no broader approval
// workflow beyond this timestamp.
export async function approveRepair(companyId: string, id: string): Promise<Repair | undefined> {
  return repairRepository.update(db, companyId, id, {
    approvedAt: new Date(),
    updatedAt: new Date(),
  });
}
