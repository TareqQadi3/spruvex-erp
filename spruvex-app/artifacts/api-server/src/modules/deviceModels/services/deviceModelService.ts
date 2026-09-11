import type { DeviceModel } from "@workspace/db";
import { deviceModelRepository } from "../repositories/deviceModelRepository";
import type { DbClient } from "../../accounting/types";

export interface CreateDeviceModelInput {
  brandId: string;
  name: string;
}

export async function listDeviceModels(db: DbClient, companyId: string, brandId?: string): Promise<DeviceModel[]> {
  return deviceModelRepository.list(db, companyId, brandId);
}

// (brandId, name) is unique per company — a repeat create returns the
// existing row instead of erroring, matching the legacy route's behavior.
export async function createDeviceModel(db: DbClient, companyId: string, input: CreateDeviceModelInput): Promise<{ model: DeviceModel; created: boolean }> {
  if (!input.brandId || !input.name) throw new Error("brandId and name are required");
  const inserted = await deviceModelRepository.insertIfAbsent(db, { companyId, brandId: input.brandId, name: input.name });
  if (inserted) return { model: inserted, created: true };
  const existing = await deviceModelRepository.findByBrandAndName(db, companyId, input.brandId, input.name);
  return { model: existing!, created: false };
}

export async function deleteDeviceModel(db: DbClient, companyId: string, id: string): Promise<void> {
  await deviceModelRepository.delete(db, companyId, id);
}
