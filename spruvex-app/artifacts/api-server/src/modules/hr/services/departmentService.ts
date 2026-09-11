import type { Department } from "@workspace/db";
import { departmentRepository, type DepartmentUpdate } from "../repositories/departmentRepository";
import type { DbClient } from "../../accounting/types";

export interface CreateDepartmentInput {
  name: string;
  managerId?: string;
}

export type UpdateDepartmentInput = Partial<CreateDepartmentInput>;

export async function listDepartments(db: DbClient, companyId: string): Promise<Department[]> {
  return departmentRepository.list(db, companyId);
}

export async function createDepartment(db: DbClient, companyId: string, input: CreateDepartmentInput): Promise<Department> {
  if (!input.name) throw new Error("name is required");
  return departmentRepository.insert(db, { companyId, name: input.name, managerId: input.managerId });
}

export async function updateDepartment(db: DbClient, companyId: string, id: string, input: UpdateDepartmentInput): Promise<Department | undefined> {
  const changes: DepartmentUpdate = {};
  if (input.name !== undefined) changes.name = input.name;
  if (input.managerId !== undefined) changes.managerId = input.managerId;
  return departmentRepository.update(db, companyId, id, changes);
}

export async function deleteDepartment(db: DbClient, companyId: string, id: string): Promise<void> {
  await departmentRepository.delete(db, companyId, id);
}
