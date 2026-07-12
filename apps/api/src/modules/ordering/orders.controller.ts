import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";

import { ORDER_STATUSES, type OrderStatus } from "@spruvex-r/types";

import { RequirePermission } from "../../shared/rbac/require-permission.decorator";
import { CreateOrderDto, TransitionOrderDto } from "./dto/order.dto";
import { OrderingService } from "./ordering.service";

function parseStatuses(raw?: string): OrderStatus[] | undefined {
  if (!raw) return undefined;
  const list = raw.split(",").map((s) => s.trim());
  return list.filter((s): s is OrderStatus =>
    (ORDER_STATUSES as readonly string[]).includes(s),
  );
}

@Controller("orders")
export class OrdersController {
  constructor(private readonly ordering: OrderingService) {}

  @RequirePermission("orders.view")
  @Get()
  list(
    @Query("branchId") branchId?: string,
    @Query("statuses") statuses?: string,
    @Query("limit") limit?: string,
  ) {
    return this.ordering.list({
      branchId,
      statuses: parseStatuses(statuses),
      limit: limit ? Number(limit) : undefined,
    });
  }

  @RequirePermission("orders.view")
  @Get(":id")
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.ordering.get(id);
  }

  @RequirePermission("orders.create")
  @Post()
  create(
    @Body() dto: CreateOrderDto,
    @Headers("idempotency-key") idempotencyKey: string,
  ) {
    return this.ordering.create(dto, { source: "pos" }, idempotencyKey);
  }

  /** Cancellation (status=cancelled) additionally requires orders.void. */
  @RequirePermission("orders.update_status")
  @HttpCode(200)
  @Post(":id/status")
  transition(@Param("id", ParseUUIDPipe) id: string, @Body() dto: TransitionOrderDto) {
    return this.ordering.transition(id, dto.status, { reason: dto.reason });
  }
}
