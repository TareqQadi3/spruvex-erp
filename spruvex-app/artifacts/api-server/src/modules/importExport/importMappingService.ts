import { eq, and, desc } from "drizzle-orm";
import { importMappingTemplatesTable, importJobsTable, type ImportMappingTemplate, type ImportJob, type InsertImportMappingTemplate } from "@workspace/db";
import type { DbClient } from "../accounting/types";

export async function listMappingTemplates(db: DbClient, companyId: string, entityType?: string): Promise<ImportMappingTemplate[]> {
  const conditions = [eq(importMappingTemplatesTable.companyId, companyId)];
  if (entityType) conditions.push(eq(importMappingTemplatesTable.entityType, entityType));
  return db.select().from(importMappingTemplatesTable).where(and(...conditions));
}

export interface CreateMappingTemplateInput {
  entityType: string;
  name: string;
  mapping: InsertImportMappingTemplate["mapping"];
}

export async function createMappingTemplate(db: DbClient, companyId: string, input: CreateMappingTemplateInput): Promise<ImportMappingTemplate> {
  if (!input.entityType || !input.name || !input.mapping) throw new Error("entityType, name and mapping are required");
  const [template] = await db.insert(importMappingTemplatesTable)
    .values({ companyId, entityType: input.entityType, name: input.name, mapping: input.mapping }).returning();
  return template;
}

export async function listRecentJobs(db: DbClient, companyId: string): Promise<ImportJob[]> {
  return db.select().from(importJobsTable)
    .where(eq(importJobsTable.companyId, companyId))
    .orderBy(desc(importJobsTable.createdAt))
    .limit(20);
}
