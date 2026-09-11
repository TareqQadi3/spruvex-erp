import { eq, and, isNull } from "drizzle-orm";
import { attendanceTable, type Attendance, type InsertAttendance } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export const attendanceRepository = {
  async listByEmployee(db: DbClient, companyId: string, employeeId: string): Promise<Attendance[]> {
    return db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.companyId, companyId), eq(attendanceTable.employeeId, employeeId)))
      .orderBy(attendanceTable.clockIn);
  },

  async findOpen(db: DbClient, companyId: string, employeeId: string): Promise<Attendance | undefined> {
    const [row] = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.companyId, companyId), eq(attendanceTable.employeeId, employeeId), isNull(attendanceTable.clockOut)))
      .limit(1);
    return row;
  },

  async insert(db: DbClient, row: InsertAttendance): Promise<Attendance> {
    const [attendance] = await db.insert(attendanceTable).values(row).returning();
    return attendance;
  },

  async findById(db: DbClient, companyId: string, id: string): Promise<Attendance | undefined> {
    const [row] = await db.select().from(attendanceTable)
      .where(and(eq(attendanceTable.id, id), eq(attendanceTable.companyId, companyId)));
    return row;
  },

  async clockOut(db: DbClient, companyId: string, id: string, clockOut: Date): Promise<Attendance | undefined> {
    const [updated] = await db.update(attendanceTable).set({ clockOut })
      .where(and(eq(attendanceTable.id, id), eq(attendanceTable.companyId, companyId)))
      .returning();
    return updated;
  },
};
