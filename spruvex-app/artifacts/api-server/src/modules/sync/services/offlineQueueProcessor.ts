import { ZodError } from "zod";
import { customersTable } from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { AppError } from "../../../core/errors/AppError";
import { compositeKeyMatch } from "../../../core/database/compositeKey";
import type { TenantContext } from "../../../shared/types/tenantContext";
import * as saleService from "../../pos/services/saleService";
import * as inventoryService from "../../inventory/services/inventoryService";
import { createSaleSchema } from "../../pos/validators/pos.validators";
import { adjustStockSchema } from "../../inventory/validators/inventory.validators";
import { resolveConflict } from "./conflictResolver";
import type { OfflineOperationInput } from "../types/syncTypes";

// Only entity types with a real handler below — anything else is rejected
// with a clear reason rather than silently mishandled. Extend this list (and
// add a handler) as more modules gain their own CRUD service.
const GENERIC_CRUD_ENTITY_TYPES = ["customer"] as const;

function zodMessage(err: ZodError): string {
  return err.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}

async function processCustomerOperation(
  tenant: TenantContext,
  operation: OfflineOperationInput,
  client: DbOrTx = db,
): Promise<unknown> {
  const payload = operation.payload;

  if (operation.operationType === "create") {
    const [row] = await client
      .insert(customersTable)
      .values({
        companyId: tenant.companyId,
        name: String(payload.name ?? ""),
        phone: payload.phone !== undefined ? String(payload.phone) : undefined,
        email: payload.email !== undefined ? String(payload.email) : undefined,
        address: payload.address !== undefined ? String(payload.address) : undefined,
      })
      .returning();
    return row;
  }

  const customerId = payload.id !== undefined ? String(payload.id) : "";
  if (!customerId) throw AppError.validation("customer payload must include id for update/delete");

  if (operation.operationType === "delete") {
    const [row] = await client
      .delete(customersTable)
      .where(compositeKeyMatch(customersTable.companyId, customersTable.id, tenant.companyId, customerId))
      .returning({ id: customersTable.id });
    if (!row) throw AppError.notFound("Customer not found");
    return row;
  }

  if (operation.operationType === "update") {
    // LAST_WRITE_WINS per the conflict policy — but customers has no
    // updated_at column to compare against (no schema changes this pass), so
    // resolveConflict's documented no-server-timestamp fallback applies: the
    // client write is applied directly.
    const resolution = resolveConflict({ entityType: "customer", clientTimestamp: new Date(), clientPayload: payload });
    if (!resolution.useClientPayload) {
      throw AppError.conflict("Server version is newer; client update discarded");
    }

    const updates: Record<string, unknown> = {};
    if (payload.name !== undefined) updates.name = String(payload.name);
    if (payload.phone !== undefined) updates.phone = String(payload.phone);
    if (payload.email !== undefined) updates.email = String(payload.email);
    if (payload.address !== undefined) updates.address = String(payload.address);

    const [row] = await client
      .update(customersTable)
      .set(updates)
      .where(compositeKeyMatch(customersTable.companyId, customersTable.id, tenant.companyId, customerId))
      .returning();
    if (!row) throw AppError.notFound("Customer not found");
    return row;
  }

  throw AppError.validation(`Unsupported operation "${operation.operationType}" for entity "customer"`);
}

// Dispatches one offline-queued operation to the domain service that owns
// it. create_sale/adjust_stock reuse the POS and inventory engines exactly
// as any other caller would — each manages its own transaction internally,
// so this function does not wrap them in an outer one (see syncService's
// header comment for the atomicity trade-off that implies).
export async function processOperation(tenant: TenantContext, operation: OfflineOperationInput): Promise<unknown> {
  switch (operation.operationType) {
    case "create_sale": {
      try {
        const input = createSaleSchema.parse(operation.payload);
        return await saleService.createSale(tenant, input);
      } catch (err) {
        if (err instanceof ZodError) throw AppError.validation(`Invalid create_sale payload: ${zodMessage(err)}`);
        throw err;
      }
    }

    case "adjust_stock": {
      try {
        const input = adjustStockSchema.parse(operation.payload);
        return await inventoryService.adjustStock(tenant, input);
      } catch (err) {
        if (err instanceof ZodError) throw AppError.validation(`Invalid adjust_stock payload: ${zodMessage(err)}`);
        throw err;
      }
    }

    case "create_payment":
      // No standalone "add a payment to an existing sale" capability exists
      // anywhere in the app — payments are only ever created as part of
      // create_sale. Rejected honestly rather than silently mishandled or
      // partially implemented.
      throw AppError.validation(
        "create_payment is not supported as a standalone offline operation — payments are recorded as part of create_sale",
      );

    case "create":
    case "update":
    case "delete":
      if (!GENERIC_CRUD_ENTITY_TYPES.includes(operation.entityType as (typeof GENERIC_CRUD_ENTITY_TYPES)[number])) {
        throw AppError.validation(`Unsupported entity type for generic CRUD: "${operation.entityType}"`);
      }
      return processCustomerOperation(tenant, operation);

    default:
      throw AppError.validation(`Unsupported operation type: "${operation.operationType}"`);
  }
}
