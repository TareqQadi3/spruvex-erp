import { pgTable, uuid, text, date, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// T-16 — HR foundation ONLY: employees, departments, attendance.
// Deliberately excluded from this stage (needs a separate scoping session):
// payroll/allowances, leave balances, anything touching modules/accounting.

export const departmentsTable = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  name: text("name").notNull(),
  managerId: uuid("manager_id"), // optional — references employees.id, not enforced at DB level (no cross-table FK cycle with employees.departmentId)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("departments_company_idx").on(table.companyId),
]);

export const EMPLOYEE_STATUSES = ["active", "terminated"] as const;
export type EmployeeStatus = typeof EMPLOYEE_STATUSES[number];

// Deliberately separate from usersTable: not every employee has a system
// login (e.g. a technician who never touches the POS), and the reverse
// (every login belonging to exactly one employee) isn't true either during
// this foundation stage. userId is a nullable, optional link the other way
// (employees -> users) rather than adding a column to the existing,
// auth-central usersTable — less disruptive to that table's schema.
export const employeesTable = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  userId: uuid("user_id"), // optional link to an existing system-login user
  name: text("name").notNull(),
  nationalId: text("national_id"),
  departmentId: uuid("department_id"),
  position: text("position"),
  hireDate: date("hire_date"),
  status: text("status").notNull().default("active"),
  branchId: uuid("branch_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("employees_company_idx").on(table.companyId),
  index("employees_company_department_idx").on(table.companyId, table.departmentId),
]);

export const ATTENDANCE_SOURCES = ["manual", "kiosk"] as const;
export type AttendanceSource = typeof ATTENDANCE_SOURCES[number];

export const attendanceTable = pgTable("attendance", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  employeeId: uuid("employee_id").notNull(),
  clockIn: timestamp("clock_in").notNull(),
  clockOut: timestamp("clock_out"),
  source: text("source").notNull().default("manual"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("attendance_company_employee_idx").on(table.companyId, table.employeeId),
]);

export const insertDepartmentSchema = createInsertSchema(departmentsTable).omit({ id: true, createdAt: true });
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departmentsTable.$inferSelect;

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
