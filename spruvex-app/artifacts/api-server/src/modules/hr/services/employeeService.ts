import type { Employee } from "@workspace/db";
import { employeeRepository, type EmployeeUpdate } from "../repositories/employeeRepository";
import type { DbClient } from "../../accounting/types";

export interface CreateEmployeeInput {
  userId?: string;
  name: string;
  nationalId?: string;
  departmentId?: string;
  position?: string;
  hireDate?: string;
  status?: string;
  branchId?: string;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export async function listEmployees(db: DbClient, companyId: string, departmentId?: string): Promise<Employee[]> {
  return employeeRepository.list(db, companyId, departmentId);
}

export async function getEmployee(db: DbClient, companyId: string, id: string): Promise<Employee | undefined> {
  return employeeRepository.findById(db, companyId, id);
}

export async function createEmployee(db: DbClient, companyId: string, input: CreateEmployeeInput): Promise<Employee> {
  if (!input.name) throw new Error("name is required");
  return employeeRepository.insert(db, {
    companyId,
    userId: input.userId,
    name: input.name,
    nationalId: input.nationalId,
    departmentId: input.departmentId,
    position: input.position,
    hireDate: input.hireDate,
    status: input.status ?? "active",
    branchId: input.branchId,
  });
}

export async function updateEmployee(db: DbClient, companyId: string, id: string, input: UpdateEmployeeInput): Promise<Employee | undefined> {
  const changes: EmployeeUpdate = {};
  if (input.userId !== undefined) changes.userId = input.userId;
  if (input.name !== undefined) changes.name = input.name;
  if (input.nationalId !== undefined) changes.nationalId = input.nationalId;
  if (input.departmentId !== undefined) changes.departmentId = input.departmentId;
  if (input.position !== undefined) changes.position = input.position;
  if (input.hireDate !== undefined) changes.hireDate = input.hireDate;
  if (input.status !== undefined) changes.status = input.status;
  if (input.branchId !== undefined) changes.branchId = input.branchId;
  return employeeRepository.update(db, companyId, id, changes);
}

export async function deleteEmployee(db: DbClient, companyId: string, id: string): Promise<void> {
  await employeeRepository.delete(db, companyId, id);
}
