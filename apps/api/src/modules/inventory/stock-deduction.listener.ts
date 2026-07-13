import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { DOMAIN_EVENTS } from "@spruvex-r/types";

import type { OrderEventPayload } from "../../shared/realtime/orders-realtime.listener";
import { InventoryService } from "./inventory.service";

interface OrderItemLike {
  productId: string;
  quantity: number;
}

/**
 * Reacts to order.status_changed: when an order reaches `completed`,
 * deducts recipe ingredients from stock. Decoupled from the checkout
 * transaction on purpose (see InventoryService.deductForCompletedOrder for
 * the safety rationale) — this listener never affects the order itself.
 */
@Injectable()
export class StockDeductionListener {
  constructor(private readonly inventory: InventoryService) {}

  @OnEvent(DOMAIN_EVENTS.ORDER_STATUS_CHANGED)
  async onStatusChanged(payload: OrderEventPayload): Promise<void> {
    if (payload.order.status !== "completed") return;

    const items = (payload.order.items as OrderItemLike[] | undefined) ?? [];
    await this.inventory.deductForCompletedOrder(
      payload.tenantId,
      payload.branchId,
      payload.order.id,
      items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    );
  }
}
