import { Module } from "@nestjs/common";

import { FloorsService } from "./floors.service";
import { QrService } from "./qr.service";
import { TableSessionsService } from "./table-sessions.service";
import { FloorsController, TablesController } from "./tables.controller";
import { TablesService } from "./tables.service";

/**
 * Tables module — floors/areas, tables, permanent per-table QR tokens
 * (generation, regeneration, PNG download, PDF print sheet) and table
 * sessions: the foundation QR ordering (Phase 6) and the order engine
 * (Phase 4) build on.
 */
@Module({
  controllers: [FloorsController, TablesController],
  providers: [FloorsService, TablesService, TableSessionsService, QrService],
  exports: [TablesService, TableSessionsService],
})
export class TablesModule {}
