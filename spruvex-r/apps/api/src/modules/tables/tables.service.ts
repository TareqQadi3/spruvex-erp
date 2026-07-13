import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes } from "node:crypto";

import { AuditService } from "../../shared/audit/audit.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { TenantContextService } from "../../shared/tenancy/tenant-context.service";
import { CreateTableDto, UpdateTableDto } from "./dto/tables.dto";

/** Non-guessable, URL-safe QR token (~96 bits of entropy). */
export function newQrToken(): string {
  return randomBytes(12).toString("base64url");
}

const TABLE_INCLUDE = {
  floor: { select: { id: true, name: true, nameEn: true } },
  branch: { select: { id: true, name: true, nameEn: true } },
} as const;

@Injectable()
export class TablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  list(filter: { branchId?: string; floorId?: string }) {
    return this.prisma.scoped.table.findMany({
      where: {
        deletedAt: null,
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
        ...(filter.floorId ? { floorId: filter.floorId } : {}),
      },
      orderBy: [{ number: "asc" }],
      include: TABLE_INCLUDE,
    });
  }

  async get(id: string) {
    const table = await this.prisma.scoped.table.findFirst({
      where: { id, deletedAt: null },
      include: TABLE_INCLUDE,
    });
    if (!table) {
      throw new NotFoundException("Table not found");
    }
    return table;
  }

  async create(dto: CreateTableDto) {
    const ctx = this.tenantContext.contextOrThrow;

    const floor = await this.prisma.scoped.floor.findFirst({
      where: { id: dto.floorId, deletedAt: null },
    });
    if (!floor) {
      throw new NotFoundException("Floor not found");
    }
    await this.assertNumberAvailable(floor.branchId, dto.number);

    const table = await this.prisma.scoped.table.create({
      data: {
        tenantId: this.tenantContext.tenantIdOrThrow,
        branchId: floor.branchId,
        floorId: dto.floorId,
        number: dto.number,
        capacity: dto.capacity ?? 4,
        qrToken: newQrToken(),
        createdBy: ctx.userId,
      },
      include: TABLE_INCLUDE,
    });
    await this.audit.log({
      action: "table.created",
      entityType: "table",
      entityId: table.id,
      branchId: floor.branchId,
      meta: { number: dto.number },
    });
    return table;
  }

  async update(id: string, dto: UpdateTableDto) {
    const ctx = this.tenantContext.contextOrThrow;
    const existing = await this.get(id);

    let branchId = existing.branchId;
    if (dto.floorId && dto.floorId !== existing.floorId) {
      const floor = await this.prisma.scoped.floor.findFirst({
        where: { id: dto.floorId, deletedAt: null },
      });
      if (!floor) {
        throw new NotFoundException("Floor not found");
      }
      if (floor.branchId !== existing.branchId) {
        throw new ConflictException("Cannot move a table to a floor in another branch");
      }
      branchId = floor.branchId;
    }
    if (dto.number && dto.number !== existing.number) {
      await this.assertNumberAvailable(branchId, dto.number, id);
    }

    const table = await this.prisma.scoped.table.update({
      where: { id },
      data: { ...dto, updatedBy: ctx.userId },
      include: TABLE_INCLUDE,
    });
    await this.audit.log({
      action: "table.updated",
      entityType: "table",
      entityId: id,
      meta: { changes: { ...dto } },
    });
    return table;
  }

  async softDelete(id: string) {
    const ctx = this.tenantContext.contextOrThrow;
    const table = await this.get(id);

    const openSession = await this.prisma.scoped.tableSession.findFirst({
      where: { tableId: id, closedAt: null },
    });
    if (openSession) {
      throw new ConflictException("Table has an open session — close it first");
    }

    await this.prisma.scoped.table.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: ctx.userId },
    });
    await this.audit.log({
      action: "table.deleted",
      entityType: "table",
      entityId: id,
      meta: { number: table.number },
    });
    return { deleted: true };
  }

  /**
   * Regenerates the QR token. The previous token stops resolving immediately
   * (old printed QRs are disabled). The replaced token is kept in the audit log.
   */
  async regenerateQr(id: string) {
    const ctx = this.tenantContext.contextOrThrow;
    const existing = await this.get(id);

    const table = await this.prisma.scoped.table.update({
      where: { id },
      data: {
        qrToken: newQrToken(),
        qrGeneratedAt: new Date(),
        updatedBy: ctx.userId,
      },
      include: TABLE_INCLUDE,
    });
    await this.audit.log({
      action: "table.qr_regenerated",
      entityType: "table",
      entityId: id,
      meta: { previousToken: existing.qrToken },
    });
    return table;
  }

  /**
   * Resolves a table by its public QR token — the entry point the guest
   * ordering app (Phase 6) will use. Regenerated (old) tokens return null.
   */
  async resolveByToken(qrToken: string) {
    return this.prisma.scoped.table.findFirst({
      where: { qrToken, deletedAt: null },
      include: TABLE_INCLUDE,
    });
  }

  private async assertNumberAvailable(branchId: string, number: string, exceptId?: string) {
    const existing = await this.prisma.scoped.table.findFirst({
      where: {
        branchId,
        number,
        deletedAt: null,
        ...(exceptId ? { id: { not: exceptId } } : {}),
      },
    });
    if (existing) {
      throw new ConflictException(`Table number "${number}" already exists in this branch`);
    }
  }
}
