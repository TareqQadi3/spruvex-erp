/**
 * Domain event names. Modules communicate through these events
 * (NestJS EventEmitter) instead of calling each other directly.
 */
export const DOMAIN_EVENTS = {
  ORDER_PLACED: "order.placed",
  ORDER_CONFIRMED: "order.confirmed",
  ORDER_PREPARING: "order.preparing",
  ORDER_READY: "order.ready",
  ORDER_COMPLETED: "order.completed",
  ORDER_CANCELLED: "order.cancelled",
  INVOICE_ISSUED: "invoice.issued",
  SHIFT_OPENED: "shift.opened",
  SHIFT_CLOSED: "shift.closed",
  TENANT_CREATED: "tenant.created",
} as const;

export type DomainEventName = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];
