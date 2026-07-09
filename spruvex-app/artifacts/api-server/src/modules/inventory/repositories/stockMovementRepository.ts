import { desc, eq } from "drizzle-orm";
import { stockMovementsTable, type StockMovementType } from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { withTenantScope } from "../../../core/database/compositeKey";

export interface RecordMovementInput {
  productId: string;
  warehouseId: string;
  movementType: StockMovementType;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  createdBy?: string;
}

// Append-only — no update/delete methods on purpose. This table is the
// audit trail; corrections happen by recording a new, opposite movement,
// never by editing history.
export class StockMovementRepository {
  async record(companyId: string, entry: RecordMovementInput, client: DbOrTx = db) {
    const [row] = await client
      .insert(stockMovementsTable)
      .values({ companyId, ...entry })
      .returning();
    return row;
  }

  async listForProduct(companyId: string, productId: string, client: DbOrTx = db) {
    return client
      .select()
      .from(stockMovementsTable)
      .where(withTenantScope(stockMovementsTable.companyId, companyId, eq(stockMovementsTable.productId, productId)))
      .orderBy(desc(stockMovementsTable.createdAt));
  }
}
