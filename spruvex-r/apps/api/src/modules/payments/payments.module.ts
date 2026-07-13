import { Module } from "@nestjs/common";

import { OrderingModule } from "../ordering/ordering.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { ReceiptsService } from "./receipts.service";

/**
 * Payments module — cash/card/split checkout with open-shift requirement,
 * over/duplicate-payment prevention, auto-completion on full payment and
 * the receipt foundation.
 */
@Module({
  imports: [OrderingModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, ReceiptsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
