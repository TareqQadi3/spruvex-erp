import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { AuditService } from "../../shared/audit/audit.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { TenantContextService } from "../../shared/tenancy/tenant-context.service";
import { CreateCategoryDto, UpdateCategoryDto } from "./dto/category.dto";

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.scoped.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        _count: { select: { products: { where: { deletedAt: null } } } },
      },
    });
  }

  async create(dto: CreateCategoryDto) {
    const ctx = this.tenantContext.contextOrThrow;
    const category = await this.prisma.scoped.category.create({
      data: {
        tenantId: this.tenantContext.tenantIdOrThrow,
        ...dto,
        createdBy: ctx.userId,
      },
    });
    await this.audit.log({
      action: "category.created",
      entityType: "category",
      entityId: category.id,
      meta: { name: category.name },
    });
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const ctx = this.tenantContext.contextOrThrow;
    await this.findOrThrow(id);
    const category = await this.prisma.scoped.category.update({
      where: { id },
      data: { ...dto, updatedBy: ctx.userId },
    });
    await this.audit.log({
      action: "category.updated",
      entityType: "category",
      entityId: id,
      meta: { changes: { ...dto } },
    });
    return category;
  }

  async softDelete(id: string) {
    const ctx = this.tenantContext.contextOrThrow;
    const category = await this.findOrThrow(id);

    const productCount = await this.prisma.scoped.product.count({
      where: { categoryId: id, deletedAt: null },
    });
    if (productCount > 0) {
      throw new ConflictException(
        "Category still has products — move or delete them first",
      );
    }

    await this.prisma.scoped.category.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: ctx.userId },
    });
    await this.audit.log({
      action: "category.deleted",
      entityType: "category",
      entityId: id,
      meta: { name: category.name },
    });
    return { deleted: true };
  }

  private async findOrThrow(id: string) {
    const category = await this.prisma.scoped.category.findFirst({
      where: { id, deletedAt: null },
    });
    if (!category) {
      throw new NotFoundException("Category not found");
    }
    return category;
  }
}
