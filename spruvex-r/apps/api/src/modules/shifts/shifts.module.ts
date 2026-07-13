import { Module } from "@nestjs/common";

import { ShiftsController } from "./shifts.controller";
import { ShiftsService } from "./shifts.service";

/**
 * Shifts module — cashier sessions with opening cash float and close
 * foundation. Payments require an open shift; full reconciliation
 * reporting arrives in Phase 8.
 */
@Module({
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}
