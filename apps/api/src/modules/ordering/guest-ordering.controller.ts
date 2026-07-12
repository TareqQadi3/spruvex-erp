import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";

import { Public } from "../../shared/rbac/public.decorator";
import { GuestCreateOrderDto } from "./dto/order.dto";
import { GuestOrderingService } from "./guest-ordering.service";

/**
 * Public guest endpoints (QR ordering readiness — the customer app arrives
 * in Phase 6). No account required, but:
 * - rate-limited per IP,
 * - scoped strictly by a valid, current table QR token,
 * - Idempotency-Key mandatory on order creation.
 */
@Public()
@UseGuards(ThrottlerGuard)
@Controller("public/tables")
export class GuestOrderingController {
  constructor(private readonly guest: GuestOrderingService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(":qrToken")
  tableInfo(@Param("qrToken") qrToken: string) {
    return this.guest.tableInfo(qrToken);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(":qrToken/menu")
  menu(@Param("qrToken") qrToken: string) {
    return this.guest.menu(qrToken);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(":qrToken/orders")
  createOrder(
    @Param("qrToken") qrToken: string,
    @Body() dto: GuestCreateOrderDto,
    @Headers("idempotency-key") idempotencyKey: string,
  ) {
    return this.guest.createOrder(qrToken, dto, idempotencyKey);
  }
}
