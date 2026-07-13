import { Module } from "@nestjs/common";

import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

/**
 * Reports & Analytics module (Phase 7) — sales, operations and financial
 * reporting, plus the dashboard summary card. Read-only aggregation over
 * the Ordering/Inventory domains; no new persisted state.
 */
@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
