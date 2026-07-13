import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { AuditService } from "../../shared/audit/audit.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { TenantContextService } from "../../shared/tenancy/tenant-context.service";
import { CreateIngredientDto, UpdateIngredientDto } from "./dto/ingredient.dto";

@Injectable()
export class IngredientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  list() {
    return this.prisma.scoped.ingredient.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
    });
  }

  async get(id: string) {
    const ingredient = await this.prisma.scoped.ingredient.findFirst({
      where: { id, deletedAt: null },
    });
    if (!ingredient) {
      throw new NotFoundException("Ingredient not found");
    }
    return ingredient;
  }

  async create(dto: CreateIngredientDto) {
    const ctx = this.tenantContext.contextOrThrow;
    const ingredient = await this.prisma.scoped.ingredient.create({
      data: {
        tenantId: this.tenantContext.tenantIdOrThrow,
        name: dto.name,
        nameEn: dto.nameEn,
        unitType: dto.unitType,
        averageCost: dto.averageCost ?? "0",
        reorderLevel: dto.reorderLevel,
        isActive: dto.isActive,
        createdBy: ctx.userId,
      },
    });
    await this.audit.log({
      action: "ingredient.created",
      entityType: "ingredient",
      entityId: ingredient.id,
      meta: { name: ingredient.name, unitType: ingredient.unitType },
    });
    return ingredient;
  }

  async update(id: string, dto: UpdateIngredientDto) {
    const ctx = this.tenantContext.contextOrThrow;
    await this.get(id);
    // Explicit field whitelist — `declare unitType: never` on the DTO is a
    // compile-time-only guard; a raw HTTP body could still carry the key, so
    // the measurement family must never come from a blind `...dto` spread.
    const ingredient = await this.prisma.scoped.ingredient.update({
      where: { id },
      data: {
        name: dto.name,
        nameEn: dto.nameEn,
        averageCost: dto.averageCost,
        reorderLevel: dto.reorderLevel,
        isActive: dto.isActive,
        updatedBy: ctx.userId,
      },
    });
    await this.audit.log({
      action: "ingredient.updated",
      entityType: "ingredient",
      entityId: id,
      meta: { changes: { ...dto } },
    });
    return ingredient;
  }

  async softDelete(id: string) {
    const ctx = this.tenantContext.contextOrThrow;
    const ingredient = await this.get(id);

    const usedInRecipes = await this.prisma.scoped.recipeItem.count({
      where: { ingredientId: id },
    });
    if (usedInRecipes > 0) {
      throw new ConflictException(
        "Ingredient is used in one or more recipes — remove it from those recipes first",
      );
    }

    await this.prisma.scoped.ingredient.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: ctx.userId },
    });
    await this.audit.log({
      action: "ingredient.deleted",
      entityType: "ingredient",
      entityId: id,
      meta: { name: ingredient.name },
    });
    return { deleted: true };
  }
}
