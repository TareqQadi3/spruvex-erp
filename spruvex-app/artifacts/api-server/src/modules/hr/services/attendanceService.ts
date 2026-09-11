import type { Attendance } from "@workspace/db";
import { attendanceRepository } from "../repositories/attendanceRepository";
import type { DbClient } from "../../accounting/types";

export class AlreadyClockedInError extends Error {}
export class AlreadyClockedOutError extends Error {}

export async function listAttendance(db: DbClient, companyId: string, employeeId: string): Promise<Attendance[]> {
  return attendanceRepository.listByEmployee(db, companyId, employeeId);
}

export interface ClockInInput {
  employeeId: string;
  source?: string;
}

export async function clockIn(db: DbClient, companyId: string, input: ClockInInput): Promise<Attendance> {
  if (!input.employeeId) throw new Error("employeeId is required");
  const open = await attendanceRepository.findOpen(db, companyId, input.employeeId);
  if (open) throw new AlreadyClockedInError("This employee is already clocked in");

  return attendanceRepository.insert(db, {
    companyId,
    employeeId: input.employeeId,
    clockIn: new Date(),
    source: input.source ?? "manual",
  });
}

export async function clockOut(db: DbClient, companyId: string, id: string): Promise<Attendance | undefined> {
  const record = await attendanceRepository.findById(db, companyId, id);
  if (!record) return undefined;
  if (record.clockOut) throw new AlreadyClockedOutError("This attendance record is already clocked out");
  return attendanceRepository.clockOut(db, companyId, id, new Date());
}
