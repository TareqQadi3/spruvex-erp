import { db, type RepairPart } from "@workspace/db";
import { ValidationError, parseRequiredNumber, parseOptionalNumber } from "../../../lib/validation";
import { applyStockDelta } from "../../../lib/stockDelta";
import { repairPartRepository, type RepairPartUpdate } from "../repositories/repairPartRepository";

export async function listRepairParts(companyId: string, repairId: string): Promise<RepairPart[]> {
  return repairPartRepository.listByRepair(db, companyId, repairId);
}

export interface CreateRepairPartInput {
  repairId: string;
  productId?: string;
  partName: string;
  quantity?: number;
  partCost?: number;
  laborFee?: number;
}

export async function createRepairPart(companyId: string, input: CreateRepairPartInput): Promise<RepairPart> {
  if (!input.repairId || !input.partName) throw new ValidationError("repairId and partName are required");

  const qty = parseOptionalNumber(input.quantity, "quantity") ?? 1;
  const cost = parseOptionalNumber(input.partCost, "partCost") ?? 0;
  const fee = parseOptionalNumber(input.laborFee, "laborFee") ?? 0;

  return db.transaction(async (tx) => {
    if (input.productId) {
      const booked = await applyStockDelta(tx, {
        companyId,
        productId: input.productId,
        delta: -qty,
        movementType: "sale",
        referenceType: "repair_part",
        referenceId: input.repairId,
      });
      if (booked === null) {
        const product = await repairPartRepository.findProduct(tx, companyId, input.productId);
        throw new ValidationError(`Insufficient stock for ${product?.name ?? "product"}`);
      }
    }
    return repairPartRepository.insert(tx, {
      companyId,
      repairId: input.repairId,
      productId: input.productId ?? null,
      partName: input.partName,
      quantity: qty,
      partCost: cost.toString(),
      laborFee: fee.toString(),
    });
  });
}

export interface UpdateRepairPartInput {
  partName?: string;
  quantity?: number;
  partCost?: number;
  laborFee?: number;
  productId?: string;
}

export async function updateRepairPart(companyId: string, id: string, input: UpdateRepairPartInput): Promise<RepairPart | undefined> {
  const changes: RepairPartUpdate = {};
  if (input.partName !== undefined) changes.partName = input.partName;
  if (input.quantity !== undefined) changes.quantity = parseRequiredNumber(input.quantity, "quantity");
  if (input.partCost !== undefined) changes.partCost = parseRequiredNumber(input.partCost, "partCost").toString();
  if (input.laborFee !== undefined) changes.laborFee = parseRequiredNumber(input.laborFee, "laborFee").toString();
  if (input.productId !== undefined) changes.productId = input.productId;
  return repairPartRepository.update(db, companyId, id, changes);
}

// Note: throws ValidationError if the part isn't found — deliberately NOT
// caught here or in the route, matching the legacy route's behavior exactly
// (its DELETE handler had no try/catch, unlike POST/PUT, so a missing part
// propagates to the global error handler rather than a clean 404).
export async function deleteRepairPart(companyId: string, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const part = await repairPartRepository.findById(tx, companyId, id);
    if (!part) throw new ValidationError("Part not found");

    if (part.productId) {
      await applyStockDelta(tx, {
        companyId,
        productId: part.productId,
        delta: part.quantity,
        movementType: "sale",
        referenceType: "repair_part_return",
        referenceId: id,
      });
    }

    await repairPartRepository.delete(tx, companyId, id);
  });
}
