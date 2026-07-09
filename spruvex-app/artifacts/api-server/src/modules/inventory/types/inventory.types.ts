export interface StockLevel {
  productId: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  reservedQuantity: number;
  available: number;
}

export interface AggregatedStock {
  productId: string;
  totalQuantity: number;
  totalReserved: number;
  totalAvailable: number;
  byWarehouse: StockLevel[];
}

export interface AdjustStockInput {
  productId: string;
  warehouseId: string;
  quantityDelta: number;
  reason: string;
}

export interface TransferStockInput {
  productId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  quantity: number;
  notes?: string;
}

export interface ReserveStockInput {
  productId: string;
  // Omitted = resolved to the product's own warehouse assignment, or the
  // company's default warehouse — see inventoryService.resolveWarehouseId.
  warehouseId?: string;
  quantity: number;
  referenceType: string;
  referenceId?: string;
}

export interface CommitStockDeductionInput {
  productId: string;
  warehouseId?: string;
  quantity: number;
  referenceType: string;
  referenceId?: string;
}
