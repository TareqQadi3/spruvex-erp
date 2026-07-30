import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per completed/attempted import run — the audit trail Phase 5 item
// 9 asks for (who imported what, when, and the outcome counts). Not wired to
// a general-purpose audit_log table since that doesn't exist yet (Phase 6);
// this is self-contained and sufficient for imports specifically.
export const importJobsTable = pgTable("import_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  entityType: text("entity_type").notNull(), // products | customers | suppliers
  fileName: text("file_name"),
  totalRows: integer("total_rows").notNull().default(0),
  createdCount: integer("created_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  errors: jsonb("errors"), // Array<{ row: number; error: string }>, capped
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Saved column-mapping presets ("مورد الجوالات") so a merchant importing the
// same supplier's file layout repeatedly doesn't remap columns every time.
export const importMappingTemplatesTable = pgTable("import_mapping_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  entityType: text("entity_type").notNull(),
  name: text("name").notNull(),
  mapping: jsonb("mapping").notNull(), // { targetField: sourceColumnName }
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertImportJobSchema = createInsertSchema(importJobsTable).omit({ id: true, createdAt: true });
export type InsertImportJob = z.infer<typeof insertImportJobSchema>;
export type ImportJob = typeof importJobsTable.$inferSelect;

export const insertImportMappingTemplateSchema = createInsertSchema(importMappingTemplatesTable).omit({ id: true, createdAt: true });
export type InsertImportMappingTemplate = z.infer<typeof insertImportMappingTemplateSchema>;
export type ImportMappingTemplate = typeof importMappingTemplatesTable.$inferSelect;
