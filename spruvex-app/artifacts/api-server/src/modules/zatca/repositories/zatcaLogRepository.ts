import { desc, eq } from "drizzle-orm";
import { zatcaLogsTable, type ZatcaRequestType } from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { withTenantScope } from "../../../core/database/compositeKey";

export interface RecordZatcaLogInput {
  invoiceId: string;
  requestType: ZatcaRequestType;
  status: "pending" | "success" | "failed";
  httpStatusCode?: number;
  requestPayload?: unknown;
  responsePayload?: unknown;
  respondedAt?: Date;
}

// Append-only — every submission attempt gets its own row, retries included,
// so the full ZATCA correspondence history for an invoice is auditable.
export class ZatcaLogRepository {
  async record(companyId: string, entry: RecordZatcaLogInput, client: DbOrTx = db) {
    const [row] = await client
      .insert(zatcaLogsTable)
      .values({ companyId, ...entry })
      .returning();
    return row;
  }

  async listForInvoice(companyId: string, invoiceId: string, client: DbOrTx = db) {
    return client
      .select()
      .from(zatcaLogsTable)
      .where(withTenantScope(zatcaLogsTable.companyId, companyId, eq(zatcaLogsTable.invoiceId, invoiceId)))
      .orderBy(desc(zatcaLogsTable.submittedAt));
  }
}
