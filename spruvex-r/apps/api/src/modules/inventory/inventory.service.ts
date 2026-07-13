import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { AuditService } from "../../shared/audit/audit.service";
import { costUnitsToSar, sarToCostUnits } from "../../shared/common/money";
import { PrismaService } from "../../shared/prisma/prisma.service";
import {
  actorOrNull,
  GUEST_ACTOR,
  TenantContextService,
} from "../../shared/tenancy/tenant-context.service";
import {
  RecordAdjustmentDto,
  RecordPurchaseDto,
  RecordWasteDto,
} from "./dto/stock-movement.dto";
import { StockLocationsService } from "./stock-locations.service";

/** Line items from the order.status_changed event payload, trimmed to what deduction needs. */
export interface CompletedOrderItem {
  productId: string;
  quantity: number;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
    private readonly locations: StockLocationsService,
  ) {}

  levels(branchId?: string, locationId?: string) {
    return this.prisma.scoped.stockLevel.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(locationId ? { locationId } : {}),
      },
      include: {
        ingredient: { select: { id: true, name: true, nameEn: true, unitType: true, reorderLevel: true } },
        location: { select: { id: true, name: true, nameEn: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  movements(filter: { branchId?: string; ingredientId?: string; limit?: number }) {
    return this.prisma.scoped.stockMovement.findMany({
      where: {
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
        ...(filter.ingredientId ? { ingredientId: filter.ingredientId } : {}),
      },
      include: {
        ingredient: { select: { id: true, name: true, nameEn: true } },
        location: { select: { id: true, name: true, nameEn: true } },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(filter.limit ?? 100, 300),
    });
  }

  async recordPurchase(dto: RecordPurchaseDto) {
    const ctx = this.tenantContext.contextOrThrow;
    const actor = actorOrNull(ctx.userId);
    const quantityBase = Number(dto.quantity);

    return this.prisma.scopedTransaction(async (tx) => {
      const ingredient = await this.ingredientOrThrow(tx, dto.ingredientId);
      const locationId = await this.resolveLocationId(tx, dto.branchId, dto.locationId);

      const movement = await this.createMovement(tx, {
        branchId: dto.branchId,
        locationId,
        ingredientId: dto.ingredientId,
        type: "purchase",
        quantity: quantityBase,
        unitCost: dto.unitCost,
        reason: dto.reason,
        performedBy: actor,
      });

      // Weighted moving average: (oldQty*oldCost + newQty*newCost) / (oldQty+newQty).
      const level = await this.upsertLevel(tx, dto.branchId, locationId, dto.ingredientId, quantityBase);
      const priorQty = Number(level.quantity) - quantityBase;
      const priorCostUnits = sarToCostUnits(ingredient.averageCost.toString());
      const newCostUnits = sarToCostUnits(dto.unitCost);
      const blendedUnits =
        priorQty > 0
          ? Math.round((priorQty * priorCostUnits + quantityBase * newCostUnits) / (priorQty + quantityBase))
          : newCostUnits;

      await tx.ingredient.update({
        where: { id: dto.ingredientId },
        data: { averageCost: costUnitsToSar(blendedUnits), updatedBy: actor },
      });

      await this.audit.log({
        action: "stock.purchase_recorded",
        entityType: "stock_movement",
        entityId: movement.id,
        branchId: dto.branchId,
        meta: { ingredientId: dto.ingredientId, quantity: dto.quantity, unitCost: dto.unitCost },
      });
      return movement;
    });
  }

  async recordWaste(dto: RecordWasteDto) {
    const ctx = this.tenantContext.contextOrThrow;
    const actor = actorOrNull(ctx.userId);
    const quantityBase = Number(dto.quantity);

    return this.prisma.scopedTransaction(async (tx) => {
      await this.ingredientOrThrow(tx, dto.ingredientId);
      const locationId = await this.resolveLocationId(tx, dto.branchId, dto.locationId);

      const movement = await this.createMovement(tx, {
        branchId: dto.branchId,
        locationId,
        ingredientId: dto.ingredientId,
        type: "waste",
        quantity: -quantityBase,
        reason: dto.reason,
        performedBy: actor,
      });
      await this.upsertLevel(tx, dto.branchId, locationId, dto.ingredientId, -quantityBase);

      await this.audit.log({
        action: "stock.waste_recorded",
        entityType: "stock_movement",
        entityId: movement.id,
        branchId: dto.branchId,
        meta: { ingredientId: dto.ingredientId, quantity: dto.quantity, reason: dto.reason },
      });
      return movement;
    });
  }

  /** Reconciles the counted physical quantity — computes and records the delta. */
  async recordAdjustment(dto: RecordAdjustmentDto) {
    const ctx = this.tenantContext.contextOrThrow;
    const actor = actorOrNull(ctx.userId);
    const counted = Number(dto.countedQuantity);

    return this.prisma.scopedTransaction(async (tx) => {
      await this.ingredientOrThrow(tx, dto.ingredientId);
      const locationId = await this.resolveLocationId(tx, dto.branchId, dto.locationId);

      const existing = await tx.stockLevel.findUnique({
        where: { locationId_ingredientId: { locationId, ingredientId: dto.ingredientId } },
      });
      const current = Number(existing?.quantity ?? 0);
      const delta = counted - current;
      if (delta === 0) {
        throw new BadRequestException("Counted quantity matches the current balance — nothing to adjust");
      }

      const movement = await this.createMovement(tx, {
        branchId: dto.branchId,
        locationId,
        ingredientId: dto.ingredientId,
        type: "adjustment",
        quantity: delta,
        reason: dto.reason,
        performedBy: actor,
      });
      await this.upsertLevel(tx, dto.branchId, locationId, dto.ingredientId, delta);

      await this.audit.log({
        action: "stock.adjustment_recorded",
        entityType: "stock_movement",
        entityId: movement.id,
        branchId: dto.branchId,
        meta: {
          ingredientId: dto.ingredientId,
          countedQuantity: dto.countedQuantity,
          previousQuantity: current.toString(),
          delta: delta.toString(),
          reason: dto.reason,
        },
      });
      return movement;
    });
  }

  /**
   * Automatic stock deduction on order completion (plan: "only if safe with
   * the order.completed event"). Safety measures:
   * - runs from an event listener, decoupled from the checkout transaction —
   *   a failure here can never roll back or block a completed sale;
   * - idempotent via the (tenant, type, referenceType, referenceId,
   *   ingredient) unique constraint — a duplicate event is a silent no-op;
   * - skips products with no recipe defined; never throws to the caller.
   */
  async deductForCompletedOrder(
    tenantId: string,
    branchId: string,
    orderId: string,
    items: CompletedOrderItem[],
  ): Promise<void> {
    // Event listeners run outside any HTTP request, so there is no ambient
    // tenant context yet — establish one (system actor) for the duration
    // of this operation so scoped queries and the audit log work normally.
    await this.tenantContext.run(
      { userId: GUEST_ACTOR, tenantId, permissions: new Set() },
      () => this.deductForCompletedOrderInContext(tenantId, branchId, orderId, items),
    );
  }

  private async deductForCompletedOrderInContext(
    tenantId: string,
    branchId: string,
    orderId: string,
    items: CompletedOrderItem[],
  ): Promise<void> {
    try {
      const alreadyDone = await this.prisma
        .forTenant(tenantId)
        .stockMovement.findFirst({
          where: { type: "sale_deduction", referenceType: "order", referenceId: orderId },
          select: { id: true },
        });
      if (alreadyDone) {
        return; // idempotent no-op — already deducted for this order
      }

      const productIds = [...new Set(items.map((item) => item.productId))];
      const recipeItems = await this.prisma.forTenant(tenantId).recipeItem.findMany({
        where: { productId: { in: productIds } },
        include: { unit: true },
      });
      if (recipeItems.length === 0) {
        return; // none of the sold products have a recipe — nothing to deduct
      }

      await this.prisma.scopedTransaction(async (tx) => {
        const locationId = (await this.locations.getOrCreateDefault(branchId, tx)).id;

        for (const item of items) {
          const lines = recipeItems.filter((line) => line.productId === item.productId);
          for (const line of lines) {
            const quantityBase = Number(line.quantity) * Number(line.unit.toBaseFactor) * item.quantity;
            await this.createMovement(tx, {
              branchId,
              locationId,
              ingredientId: line.ingredientId,
              type: "sale_deduction",
              quantity: -quantityBase,
              referenceType: "order",
              referenceId: orderId,
              performedBy: null,
            });
            await this.upsertLevel(tx, branchId, locationId, line.ingredientId, -quantityBase);
          }
        }
      }, tenantId);
    } catch (error) {
      // Non-blocking by design: inventory failures must never affect an
      // already-completed order. Surface loudly in logs for operators.
      this.logger.error(
        `Stock deduction failed for order ${orderId}: ${(error as Error).message}`,
      );
    }
  }

  // --------------------------------------------------------------------- //

  private async ingredientOrThrow(tx: Prisma.TransactionClient, id: string) {
    const ingredient = await tx.ingredient.findFirst({ where: { id, deletedAt: null } });
    if (!ingredient) {
      throw new NotFoundException("Ingredient not found");
    }
    return ingredient;
  }

  private async resolveLocationId(
    tx: Prisma.TransactionClient,
    branchId: string,
    locationId?: string,
  ): Promise<string> {
    if (!locationId) {
      return (await this.locations.getOrCreateDefault(branchId, tx)).id;
    }
    const location = await tx.stockLocation.findFirst({
      where: { id: locationId, branchId, deletedAt: null },
    });
    if (!location) {
      throw new NotFoundException("Stock location not found in this branch");
    }
    return location.id;
  }

  private async createMovement(
    tx: Prisma.TransactionClient,
    input: {
      branchId: string;
      locationId: string;
      ingredientId: string;
      type: "purchase" | "waste" | "adjustment" | "sale_deduction" | "transfer_in" | "transfer_out";
      quantity: number;
      unitCost?: string;
      referenceType?: string;
      referenceId?: string;
      reason?: string;
      performedBy: string | null;
    },
  ) {
    try {
      return await tx.stockMovement.create({
        data: {
          tenantId: this.tenantContext.tenantIdOrThrow,
          branchId: input.branchId,
          locationId: input.locationId,
          ingredientId: input.ingredientId,
          type: input.type,
          quantity: input.quantity.toFixed(3),
          unitCost: input.unitCost,
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          reason: input.reason,
          performedBy: input.performedBy,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("This stock movement was already recorded");
      }
      throw error;
    }
  }

  private async upsertLevel(
    tx: Prisma.TransactionClient,
    branchId: string,
    locationId: string,
    ingredientId: string,
    delta: number,
  ) {
    return tx.stockLevel.upsert({
      where: { locationId_ingredientId: { locationId, ingredientId } },
      create: {
        tenantId: this.tenantContext.tenantIdOrThrow,
        branchId,
        locationId,
        ingredientId,
        quantity: delta.toFixed(3),
      },
      update: { quantity: { increment: delta.toFixed(3) } },
    });
  }
}
