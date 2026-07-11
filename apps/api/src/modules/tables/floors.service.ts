import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { AuditService } from "../../shared/audit/audit.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { TenantContextService } from "../../shared/tenancy/tenant-context.service";
import { CreateFloorDto, UpdateFloorDto } from "./dto/tables.dto";

@Injectable()
export class FloorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  list(branchId?: string) {
    return this.prisma.scoped.floor.findMany({
      where: { deletedAt: null, ...(branchId ? { branchId } : {}) },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        branch: { select: { id: true, name: true, nameEn: true } },
        _count: { select: { tables: { where: { deletedAt: null } } } },
      },
    });
  }

  async create(dto: CreateFloorDto) {
    const ctx = this.tenantContext.contextOrThrow;
    const branch = await this.prisma.scoped.branch.findFirst({
      where: { id: dto.branchId, deletedAt: null },
    });
    if (!branch) {
      throw new NotFoundException("Branch not found");
    }

    const floor = await this.prisma.scoped.floor.create({
      data: {
        tenantId: this.tenantContext.tenantIdOrThrow,
        ...dto,
        createdBy: ctx.userId,
      },
    });
    await this.audit.log({
      action: "floor.created",
      entityType: "floor",
      entityId: floor.id,
      branchId: dto.branchId,
      meta: { name: floor.name },
    });
    return floor;
  }

  async update(id: string, dto: UpdateFloorDto) {
    const ctx = this.tenantContext.contextOrThrow;
    await this.findOrThrow(id);
    const floor = await this.prisma.scoped.floor.update({
      where: { id },
      data: { ...dto, updatedBy: ctx.userId },
    });
    await this.audit.log({
      action: "floor.updated",
      entityType: "floor",
      entityId: id,
      meta: { changes: { ...dto } },
    });
    return floor;
  }

  async softDelete(id: string) {
    const ctx = this.tenantContext.contextOrThrow;
    const floor = await this.findOrThrow(id);

    const tableCount = await this.prisma.scoped.table.count({
      where: { floorId: id, deletedAt: null },
    });
    if (tableCount > 0) {
      throw new ConflictException("Floor still has tables — move or delete them first");
    }

    await this.prisma.scoped.floor.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: ctx.userId },
    });
    await this.audit.log({
      action: "floor.deleted",
      entityType: "floor",
      entityId: id,
      meta: { name: floor.name },
    });
    return { deleted: true };
  }

  private async findOrThrow(id: string) {
    const floor = await this.prisma.scoped.floor.findFirst({
      where: { id, deletedAt: null },
    });
    if (!floor) {
      throw new NotFoundException("Floor not found");
    }
    return floor;
  }
}
