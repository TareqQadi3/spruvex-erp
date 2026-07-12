import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";

import { RequirePermission } from "../../shared/rbac/require-permission.decorator";
import { RecordPaymentDto } from "./dto/payments.dto";
import { PaymentsService } from "./payments.service";
import { ReceiptsService } from "./receipts.service";

@Controller("orders/:orderId")
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly receipts: ReceiptsService,
  ) {}

  @RequirePermission("orders.view")
  @Get("payments")
  summary(@Param("orderId", ParseUUIDPipe) orderId: string) {
    return this.payments.summary(orderId);
  }

  @RequirePermission("payments.record")
  @Post("payments")
  record(
    @Param("orderId", ParseUUIDPipe) orderId: string,
    @Body() dto: RecordPaymentDto,
    @Headers("idempotency-key") idempotencyKey: string,
  ) {
    return this.payments.record(orderId, dto, idempotencyKey);
  }

  @RequirePermission("orders.view")
  @Get("receipt")
  receipt(@Param("orderId", ParseUUIDPipe) orderId: string) {
    return this.receipts.getOrCreate(orderId);
  }
}
