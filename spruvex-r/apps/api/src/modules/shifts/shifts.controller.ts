import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";

import { RequirePermission } from "../../shared/rbac/require-permission.decorator";
import { CloseShiftDto, OpenShiftDto } from "./dto/shifts.dto";
import { ShiftsService } from "./shifts.service";

@Controller("shifts")
export class ShiftsController {
  constructor(private readonly shifts: ShiftsService) {}

  @RequirePermission("shifts.view")
  @Get()
  list(@Query("branchId") branchId?: string) {
    return this.shifts.list(branchId);
  }

  @RequirePermission("shifts.view")
  @Get("current")
  async current(@Query("branchId") branchId: string) {
    return (await this.shifts.current(branchId)) ?? null;
  }

  @RequirePermission("shifts.open")
  @Post("open")
  open(@Body() dto: OpenShiftDto) {
    return this.shifts.open(dto);
  }

  @RequirePermission("shifts.close")
  @HttpCode(200)
  @Post(":id/close")
  close(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CloseShiftDto) {
    return this.shifts.close(id, dto);
  }
}
