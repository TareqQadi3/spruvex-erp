import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";

import { AuditService } from "../../shared/audit/audit.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { TenantContextService } from "../../shared/tenancy/tenant-context.service";
import {
  CreateStockLocationDto,
  UpdateStockLocationDto,
} from "./dto/stock-location.dto";

const DEFAULT_LOCATION_NAME = "المخزن الرئيسي";
const DEFAULT_LOCATION_NAME_EN = "Main Store";

@Injectable()
export class StockLocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  list(branchId?: string) {
    return this.prisma.scoped.stockLocation.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  }

  async create(dto: CreateStockLocationDto) {
    const ctx = this.tenantContext.contextOrThrow;
    const tenantId = this.tenantContext.tenantIdOrThrow;
    const branch = await this.prisma.scoped.branch.findFirst({
      where: { id: dto.branchId, deletedAt: null },
    });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    return this.prisma.scopedTransaction(async (tx) => {
      if (dto.isDefault) {
        await tx.stockLocation.updateMany({
          where: { branchId: dto.branchId, isDefault: true },
          data: { isDefault: false },
        });
      }
      const location = await tx.stockLocation.create({
        data: {
          tenantId,
          branchId: dto.branchId,
          name: dto.name,
          nameEn: dto.nameEn,
          isDefault: dto.isDefault ?? false,
          isActive: dto.isActive,
          createdBy: ctx.userId,
        },
      });
      await this.audit.log({
        action: "stock_location.created",
        entityType: "stock_location",
        entityId: location.id,
        branchId: dto.branchId,
        meta: { name: location.name },
      });
      return location;
    });
  }

  async update(id: string, dto: UpdateStockLocationDto) {
    const ctx = this.tenantContext.contextOrThrow;
    const existing = await this.prisma.scoped.stockLocation.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException("Stock location not found");
    }

    return this.prisma.scopedTransaction(async (tx) => {
      if (dto.isDefault) {
        await tx.stockLocation.updateMany({
          where: { branchId: existing.branchId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      // Explicit field whitelist — `declare branchId: never` on the DTO is a
      // compile-time-only guard; a raw HTTP body could still carry the key,
      // so the owning branch must never come from a blind `...dto` spread.
      const location = await tx.stockLocation.update({
        where: { id },
        data: {
          name: dto.name,
          nameEn: dto.nameEn,
          isDefault: dto.isDefault,
          isActive: dto.isActive,
          updatedBy: ctx.userId,
        },
      });
      await this.audit.log({
        action: "stock_location.updated",
        entityType: "stock_location",
        entityId: id,
        meta: { changes: { ...dto } },
      });
      return location;
    });
  }

  async softDelete(id: string) {
    const ctx = this.tenantContext.contextOrThrow;
    const existing = await this.prisma.scoped.stockLocation.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) {
      throw new NotFoundException("Stock location not found");
    }
    const hasStock = await this.prisma.scoped.stockLevel.findFirst({
      where: { locationId: id, quantity: { not: 0 } },
    });
    if (hasStock) {
      throw new ConflictException("Location still holds stock — clear it before removing");
    }

    await this.prisma.scoped.stockLocation.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: ctx.userId },
    });
    await this.audit.log({
      action: "stock_location.deleted",
      entityType: "stock_location",
      entityId: id,
      meta: { name: existing.name },
    });
    return { deleted: true };
  }

  /**
   * Returns the branch's default location, lazily creating "Main Store" the
   * first time stock is recorded for a branch that has none yet — so
   * ingredients/recipes work immediately without a mandatory setup step.
   * Always called from inside a `scopedTransaction` (InventoryService) so
   * the read-then-write stays atomic.
   */
  async getOrCreateDefault(branchId: string, tx: Prisma.TransactionClient) {
    const tenantId = this.tenantContext.tenantIdOrThrow;
    const existingDefault = await tx.stockLocation.findFirst({
      where: { branchId, isDefault: true, deletedAt: null },
    });
    if (existingDefault) {
      return existingDefault;
    }
    const anyActive = await tx.stockLocation.findFirst({
      where: { branchId, deletedAt: null, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (anyActive) {
      return tx.stockLocation.update({
        where: { id: anyActive.id },
        data: { isDefault: true },
      });
    }
    return tx.stockLocation.create({
      data: {
        tenantId,
        branchId,
        name: DEFAULT_LOCATION_NAME,
        nameEn: DEFAULT_LOCATION_NAME_EN,
        isDefault: true,
      },
    });
  }
}
