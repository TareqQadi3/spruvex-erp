import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { DOMAIN_EVENTS } from "@spruvex-r/types";

import { RealtimeGateway } from "./realtime.gateway";
import { RT_EVENTS, rtRooms } from "./rooms";

/** Payload shape shared by all order domain events. */
export interface OrderEventPayload {
  tenantId: string;
  branchId: string;
  order: {
    id: string;
    orderNumber: number;
    status: string;
    total: unknown;
    createdAt: Date | string;
  } & Record<string, unknown>;
}

/** Guest-facing trim: status only — no staff, actor or catalog internals. */
function guestPayload(order: OrderEventPayload["order"]) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    total: String(order.total),
    createdAt: order.createdAt,
  };
}

/**
 * Bridges order domain events to the realtime layer:
 * staff rooms (restaurant orders + branch kitchen) get the full order;
 * the per-order guest room gets a trimmed status event.
 */
@Injectable()
export class OrdersRealtimeListener {
  constructor(private readonly gateway: RealtimeGateway) {}

  private fanOut(event: string, payload: OrderEventPayload): void {
    this.gateway.emitToRooms(
      [rtRooms.tenantOrders(payload.tenantId), rtRooms.branchKitchen(payload.branchId)],
      event,
      payload.order,
    );
    this.gateway.emitToRooms(
      [rtRooms.order(payload.order.id)],
      RT_EVENTS.GUEST_ORDER_STATUS,
      guestPayload(payload.order),
    );
  }

  @OnEvent(DOMAIN_EVENTS.ORDER_CREATED)
  onCreated(payload: OrderEventPayload): void {
    this.fanOut(RT_EVENTS.ORDER_CREATED, payload);
  }

  @OnEvent(DOMAIN_EVENTS.ORDER_STATUS_CHANGED)
  onStatusChanged(payload: OrderEventPayload): void {
    this.fanOut(RT_EVENTS.ORDER_UPDATED, payload);
  }

  @OnEvent(DOMAIN_EVENTS.ORDER_CANCELLED)
  onCancelled(payload: OrderEventPayload): void {
    this.fanOut(RT_EVENTS.ORDER_UPDATED, payload);
  }
}
