import type { Unit } from "@workspace/db";
import { unitRepository } from "../repositories/unitRepository";
import type { DbClient } from "../../accounting/types";

export interface CreateUnitInput {
  nameAr: string;
  nameEn?: string;
  symbol?: string;
}

export async function listUnits(db: DbClient, companyId: string): Promise<Unit[]> {
  return unitRepository.list(db, companyId);
}

export async function createUnit(db: DbClient, companyId: string, input: CreateUnitInput): Promise<Unit> {
  if (!input.nameAr) throw new Error("nameAr is required");
  return unitRepository.insert(db, { companyId, nameAr: input.nameAr, nameEn: input.nameEn, symbol: input.symbol });
}
