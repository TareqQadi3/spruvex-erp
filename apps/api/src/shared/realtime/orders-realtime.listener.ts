import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { DOMAIN_EVENTS } from "@spruvex-r/types";

import { RealtimeGateway } from "./realtime.gateway";
import { RT_EVENTS, rtRooms } from "./rooms";

/** Payload shape shared by all order domain events. */
export interface OrderEventPayload {
  tenantId: string;
  branchId: string;
  order: unknown; // serialized order (Decimals as strings)
}

/**
 * Bridges order domain events to the realtime layer:
 * every event fans out to the restaurant orders room and the branch kitchen room.
 */
@Injectable()
export class OrdersRealtimeListener {
  constructor(private readonly gateway: RealtimeGateway) {}

  @OnEvent(DOMAIN_EVENTS.ORDER_CREATED)
  onCreated(payload: OrderEventPayload): void {
    this.gateway.emitToRooms(
      [rtRooms.tenantOrders(payload.tenantId), rtRooms.branchKitchen(payload.branchId)],
      RT_EVENTS.ORDER_CREATED,
      payload.order,
    );
  }

  @OnEvent(DOMAIN_EVENTS.ORDER_STATUS_CHANGED)
  onStatusChanged(payload: OrderEventPayload): void {
    this.gateway.emitToRooms(
      [rtRooms.tenantOrders(payload.tenantId), rtRooms.branchKitchen(payload.branchId)],
      RT_EVENTS.ORDER_UPDATED,
      payload.order,
    );
  }

  @OnEvent(DOMAIN_EVENTS.ORDER_CANCELLED)
  onCancelled(payload: OrderEventPayload): void {
    this.gateway.emitToRooms(
      [rtRooms.tenantOrders(payload.tenantId), rtRooms.branchKitchen(payload.branchId)],
      RT_EVENTS.ORDER_UPDATED,
      payload.order,
    );
  }
}
