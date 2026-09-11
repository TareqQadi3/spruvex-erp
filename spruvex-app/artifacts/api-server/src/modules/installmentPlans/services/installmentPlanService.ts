import type { InstallmentPlan } from "@workspace/db";
import { installmentPlanRepository, type InstallmentPlanUpdate } from "../repositories/installmentPlanRepository";
import type { DbClient } from "../../accounting/types";

export interface CreateInstallmentPlanInput {
  months: number;
  interestPercent?: number;
}

export interface UpdateInstallmentPlanInput {
  months?: number;
  interestPercent?: number;
  isActive?: boolean;
}

export async function listInstallmentPlans(db: DbClient, companyId: string): Promise<InstallmentPlan[]> {
  return installmentPlanRepository.list(db, companyId);
}

export async function createInstallmentPlan(db: DbClient, companyId: string, input: CreateInstallmentPlanInput): Promise<InstallmentPlan> {
  if (!input.months) throw new Error("months is required");
  return installmentPlanRepository.insert(db, {
    companyId, months: Number(input.months), interestPercent: (input.interestPercent ?? 0).toString(),
  });
}

export async function updateInstallmentPlan(db: DbClient, companyId: string, id: string, input: UpdateInstallmentPlanInput): Promise<InstallmentPlan | undefined> {
  const changes: InstallmentPlanUpdate = {};
  if (input.months !== undefined) changes.months = Number(input.months);
  if (input.interestPercent !== undefined) changes.interestPercent = input.interestPercent.toString();
  if (input.isActive !== undefined) changes.isActive = input.isActive;
  return installmentPlanRepository.update(db, companyId, id, changes);
}

export async function deleteInstallmentPlan(db: DbClient, companyId: string, id: string): Promise<void> {
  await installmentPlanRepository.delete(db, companyId, id);
}
