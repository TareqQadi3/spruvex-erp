import { AppError } from "../../../core/errors/AppError";
import { ErrorCode } from "../../../core/errors/errorCodes";
import type { DbOrTx } from "../../../core/database/transaction";
import type { TenantContext } from "../../../shared/types/tenantContext";
import * as inventoryService from "../../inventory/services/inventoryService";

export interface StockDeductionItem {
  productId: string;
  quantity: number;
  productName: string;
}

// Compatibility layer: saleService's call site and signature are unchanged
// from the original products.stock-only implementation. Internally, every
// deduction is now routed through the inventory engine (modules/inventory),
// which writes a real stock_movements row and keeps the new per-warehouse
// stock table authoritative — products.stock is kept in sync as a
// backward-compatible mirror (see StockRepository.syncProductStockColumn),
// so nothing else reading that column directly breaks.
export class StockDeductionService {
  async deduct(tenant: TenantContext, saleId: string, items: StockDeductionItem[], client: DbOrTx): Promise<void> {
    for (const item of items) {
      try {
        await inventoryService.commitStockDeduction(
          tenant,
          {
            productId: item.productId,
            quantity: item.quantity,
            referenceType: "sale",
            referenceId: saleId,
          },
          client,
        );
      } catch (err) {
        // Re-labeled with the product name for a clearer POS error message —
        // the inventory engine itself only knows the product id.
        if (err instanceof AppError && err.code === ErrorCode.CONFLICT) {
          throw AppError.conflict(`Insufficient stock for "${item.productName}" — sale rolled back`);
        }
        throw err;
      }
    }
  }
}

export const stockDeductionService = new StockDeductionService();
