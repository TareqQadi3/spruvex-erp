import { pgTable, uuid, text, timestamp, numeric, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Chart of accounts. System accounts (isSystem) are seeded per-org by
// chartOfAccountsService and back every automatic posting rule in postingService —
// they must not be deletable from the UI, only deactivated.
export const accountsTable = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  type: text("type").notNull(), // asset | liability | equity | revenue | expense
  subtype: text("subtype"),
  parentId: uuid("parent_id"),
  normalBalance: text("normal_balance").notNull(), // debit | credit
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("accounts_company_code_idx").on(table.companyId, table.code),
]);

export const insertAccountSchema = createInsertSchema(accountsTable).omit({ id: true, createdAt: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;

// One journal entry = one balanced transaction (postEntry enforces debit == credit
// before either this or its lines are written). entryNumber is a human-readable
// reference, sourceType/sourceId trace it back to the business record that caused it.
export const journalEntriesTable = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  entryNumber: text("entry_number").notNull(),
  date: text("date").notNull(),
  memo: text("memo"),
  sourceType: text("source_type").notNull(), // sale | purchase | expense | voucher_receipt | voucher_payment | manual | sale_return | purchase_return
  sourceId: uuid("source_id"),
  isManual: boolean("is_manual").notNull().default(false),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJournalEntrySchema = createInsertSchema(journalEntriesTable).omit({ id: true, createdAt: true });
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;

export const journalEntryLinesTable = pgTable("journal_entry_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  journalEntryId: uuid("journal_entry_id").notNull(),
  accountId: uuid("account_id").notNull(),
  debit: numeric("debit", { precision: 12, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 12, scale: 2 }).notNull().default("0"),
  memo: text("memo"),
});

export const insertJournalEntryLineSchema = createInsertSchema(journalEntryLinesTable).omit({ id: true });
export type InsertJournalEntryLine = z.infer<typeof insertJournalEntryLineSchema>;
export type JournalEntryLine = typeof journalEntryLinesTable.$inferSelect;
