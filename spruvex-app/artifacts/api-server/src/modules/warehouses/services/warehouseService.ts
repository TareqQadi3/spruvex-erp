import { db, type Warehouse, type WarehouseSection } from "@workspace/db";
import { warehouseRepository } from "../repositories/warehouseRepository";

export interface CreateWarehouseInput {
  name: string;
  isRepairStock?: boolean;
  isDefault?: boolean;
  branchId?: string;
}

export interface UpdateWarehouseInput {
  name?: string;
  isRepairStock?: boolean;
  isDefault?: boolean;
  branchId?: string;
}

export async function listWarehouses(companyId: string, branchId?: string): Promise<Warehouse[]> {
  return warehouseRepository.list(db, companyId, branchId);
}

export async function createWarehouse(companyId: string, input: CreateWarehouseInput): Promise<Warehouse> {
  if (!input.name) throw new Error("name is required");

  if (input.isDefault === true) {
    return db.transaction(async (tx) => {
      await warehouseRepository.clearExistingDefault(tx, companyId);
      return warehouseRepository.insert(tx, {
        companyId, name: input.name, isRepairStock: input.isRepairStock ?? false, isDefault: true, branchId: input.branchId,
      });
    });
  }

  return warehouseRepository.insert(db, {
    companyId, name: input.name, isRepairStock: input.isRepairStock ?? false, branchId: input.branchId,
  });
}

export async function updateWarehouse(companyId: string, id: string, input: UpdateWarehouseInput): Promise<Warehouse | undefined> {
  const baseChanges = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.isRepairStock !== undefined ? { isRepairStock: input.isRepairStock } : {}),
    ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
  };

  // Exactly one default per company — clear the existing default first in
  // the same transaction so a failed update never leaves zero or two.
  if (input.isDefault === true) {
    return db.transaction(async (tx) => {
      await warehouseRepository.clearExistingDefault(tx, companyId);
      return warehouseRepository.update(tx, companyId, id, { ...baseChanges, isDefault: true });
    });
  }

  return warehouseRepository.update(db, companyId, id, {
    ...baseChanges,
    ...(input.isDefault === false ? { isDefault: false } : {}),
  });
}

export async function deleteWarehouse(companyId: string, id: string): Promise<void> {
  await warehouseRepository.delete(db, companyId, id);
}

export interface CreateWarehouseSectionInput {
  warehouseId: string;
  name: string;
}

export async function listWarehouseSections(companyId: string, warehouseId?: string): Promise<WarehouseSection[]> {
  return warehouseRepository.listSections(db, companyId, warehouseId);
}

export async function createWarehouseSection(companyId: string, input: CreateWarehouseSectionInput): Promise<WarehouseSection> {
  if (!input.warehouseId || !input.name) throw new Error("warehouseId and name are required");
  return warehouseRepository.insertSection(db, { companyId, warehouseId: input.warehouseId, name: input.name });
}

export async function deleteWarehouseSection(companyId: string, id: string): Promise<void> {
  await warehouseRepository.deleteSection(db, companyId, id);
}
