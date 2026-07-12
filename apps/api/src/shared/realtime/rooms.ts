/**
 * Realtime room names. Rooms are always derived server-side from the
 * authenticated socket's tenant — clients can never name another tenant's room.
 */
export const rtRooms = {
  /** Restaurant-level order updates (POS, dashboard). */
  tenantOrders: (tenantId: string) => `tenant:${tenantId}:orders`,
  /** Branch-level kitchen updates (KDS). */
  branchKitchen: (branchId: string) => `branch:${branchId}:kitchen`,
  /** Table-level customer status updates (guest ordering, Phase 6). */
  table: (tableId: string) => `table:${tableId}`,
};

/** Events emitted to clients. */
export const RT_EVENTS = {
  ORDER_CREATED: "order.created",
  ORDER_UPDATED: "order.updated",
} as const;
