// Idempotent, non-destructive backfill for companies that predate the
// default-warehouse fix in registerCompany (see modules/auth/services/
// authService.ts) — every company registered before that fix has zero
// warehouses marked isDefault=true, which blocks the inventory-engine
// paths (stock transfers/adjustments, ecommerce-order import) with "No
// default warehouse configured for this company".
//
// Safe by construction:
//   - Never deletes or updates any existing business data (sales,
//     products, stock, etc.) — only touches the warehouses table, and
//     only for companies that currently have zero default warehouses.
//   - For a company with existing warehouse rows but none marked default,
//     promotes its oldest warehouse to default (no new row).
//   - For a company with zero warehouse rows at all, inserts exactly one
//     new warehouse named "المستودع الرئيسي" and marks it default — the
//     same values registerCompany itself uses for a fresh signup.
//   - Re-running is always a no-op for companies already fixed (the
//     query only selects companies with zero default warehouses).
//
// Usage:
//   tsx scripts/backfillDefaultWarehouses.ts           # dry run — reports only, writes nothing
//   tsx scripts/backfillDefaultWarehouses.ts --apply    # actually performs the backfill
import { eq, and, asc, sql } from "drizzle-orm";
import { db, pool, companiesTable, warehousesTable } from "@workspace/db";

const DEFAULT_WAREHOUSE_NAME = "المستودع الرئيسي";

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");

  const companiesMissingDefault = await db
    .select({ id: companiesTable.id, name: companiesTable.name })
    .from(companiesTable)
    .where(
      sql`not exists (
        select 1 from ${warehousesTable}
        where ${warehousesTable.companyId} = ${companiesTable.id}
          and ${warehousesTable.isDefault} = true
      )`,
    );

  if (companiesMissingDefault.length === 0) {
    console.log("No companies missing a default warehouse. Nothing to do.");
    return;
  }

  console.log(
    `Found ${companiesMissingDefault.length} company(ies) without a default warehouse` +
      (apply ? " — applying fix:" : " — DRY RUN (pass --apply to write changes):"),
  );

  let promoted = 0;
  let created = 0;

  for (const company of companiesMissingDefault) {
    const [existing] = await db
      .select({ id: warehousesTable.id, name: warehousesTable.name })
      .from(warehousesTable)
      .where(eq(warehousesTable.companyId, company.id))
      .orderBy(asc(warehousesTable.createdAt))
      .limit(1);

    if (existing) {
      console.log(`  [promote] ${company.name} (${company.id}) -> existing warehouse "${existing.name}"`);
      if (apply) {
        await db
          .update(warehousesTable)
          .set({ isDefault: true })
          .where(and(eq(warehousesTable.id, existing.id), eq(warehousesTable.companyId, company.id)));
      }
      promoted++;
    } else {
      console.log(`  [create]  ${company.name} (${company.id}) -> new "${DEFAULT_WAREHOUSE_NAME}" warehouse`);
      if (apply) {
        await db.insert(warehousesTable).values({
          companyId: company.id,
          name: DEFAULT_WAREHOUSE_NAME,
          isRepairStock: false,
          isDefault: true,
        });
      }
      created++;
    }
  }

  console.log(`\n${apply ? "Applied" : "Would apply"}: ${promoted} promoted, ${created} created.`);
  if (!apply) {
    console.log("Re-run with --apply to perform these changes.");
  }
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
