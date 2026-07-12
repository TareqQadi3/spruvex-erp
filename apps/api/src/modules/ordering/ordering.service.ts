import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Prisma } from "@prisma/client";

import {
  canTransition,
  DOMAIN_EVENTS,
  ORDER_STATUS_TRANSITIONS,
  type OrderSource,
  type OrderStatus,
} from "@spruvex-r/types";

import { AuditService } from "../../shared/audit/audit.service";
import { halalasToSar, sarToHalalas, vatFromGross } from "../../shared/common/money";
import { PrismaService } from "../../shared/prisma/prisma.service";
import {
  actorOrNull,
  TenantContextService,
} from "../../shared/tenancy/tenant-context.service";
import { CreateOrderDto, OrderItemInputDto } from "./dto/order.dto";

export const ORDER_INCLUDE = {
  items: { include: { modifiers: true }, orderBy: { createdAt: "asc" } },
  table: { select: { id: true, number: true } },
  statusHistory: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.OrderInclude;

interface CreateOrderContext {
  source: OrderSource;
  /** Overrides for the guest flow (no authenticated user). */
  tenantId?: string;
}

const NUMBER_CONFLICT_RETRIES = 3;

@Injectable()
export class OrderingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  list(filter: { branchId?: string; statuses?: OrderStatus[]; limit?: number }) {
    return this.prisma.scoped.order.findMany({
      where: {
        deletedAt: null,
        ...(filter.branchId ? { branchId: filter.branchId } : {}),
        ...(filter.statuses?.length ? { status: { in: filter.statuses } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: Math.min(filter.limit ?? 100, 200),
      include: ORDER_INCLUDE,
    });
  }

  async get(id: string) {
    const order = await this.prisma.scoped.order.findFirst({
      where: { id, deletedAt: null },
      include: ORDER_INCLUDE,
    });
    if (!order) {
      throw new NotFoundException("Order not found");
    }
    return order;
  }

  /**
   * Creates an order atomically: validates products/modifiers against the
   * catalog, freezes price/name snapshots, computes totals in halalas,
   * assigns the daily sequential number, and (for dine-in) attaches the
   * order to the table's open session — opening one when none exists.
   */
  async create(dto: CreateOrderDto, opts: CreateOrderContext, idempotencyKey: string) {
    const ctx = this.tenantContext.contextOrThrow;
    const tenantId = opts.tenantId ?? this.tenantContext.tenantIdOrThrow;
    const actor = actorOrNull(ctx.userId);

    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      throw new BadRequestException("Idempotency-Key header is required (8-128 chars)");
    }

    // Idempotent replay: return the original order.
    const existing = await this.prisma.forTenant(tenantId).order.findFirst({
      where: { idempotencyKey },
      include: ORDER_INCLUDE,
    });
    if (existing) {
      return existing;
    }

    for (let attempt = 1; ; attempt++) {
      try {
        const order = await this.prisma.scopedTransaction(async (tx) => {
          return this.createInTransaction(tx, dto, opts, tenantId, actor, idempotencyKey);
        }, tenantId);

        await this.audit.log({
          tenantId,
          action: "order.created",
          entityType: "order",
          entityId: order.id,
          branchId: order.branchId,
          meta: { orderNumber: order.orderNumber, source: opts.source, total: order.total.toString() },
        });
        this.events.emit(DOMAIN_EVENTS.ORDER_CREATED, {
          tenantId,
          branchId: order.branchId,
          order,
        });

        if (dto.confirm) {
          return this.transition(order.id, "confirmed", { tenantId });
        }
        return order;
      } catch (error) {
        // Daily-number race: retry the whole transaction.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          attempt < NUMBER_CONFLICT_RETRIES
        ) {
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * The single, central place status changes happen. Validates the transition
   * against the state machine, records history (who/when/why), audits, and
   * emits the domain event.
   */
  async transition(
    id: string,
    to: OrderStatus,
    opts: { reason?: string; tenantId?: string } = {},
  ) {
    const ctx = this.tenantContext.contextOrThrow;
    const tenantId = opts.tenantId ?? this.tenantContext.tenantIdOrThrow;
    const actor = actorOrNull(ctx.userId);

    if (to === "cancelled" && !ctx.permissions.has("orders.void")) {
      throw new ForbiddenException("Cancelling an order requires the orders.void permission");
    }

    const order = await this.prisma.scopedTransaction(async (tx) => {
      const current = await tx.order.findFirst({ where: { id, deletedAt: null } });
      if (!current) {
        throw new NotFoundException("Order not found");
      }
      if (!canTransition(current.status, to)) {
        throw new ConflictException(
          `Invalid transition ${current.status} -> ${to}. Allowed: ${
            ORDER_STATUS_TRANSITIONS[current.status].join(", ") || "none"
          }`,
        );
      }

      const updated = await tx.order.update({
        where: { id },
        data: {
          status: to,
          updatedBy: actor,
          ...(to === "cancelled" ? { cancelledReason: opts.reason } : {}),
        },
        include: ORDER_INCLUDE,
      });
      await tx.orderStatusHistory.create({
        data: {
          tenantId,
          orderId: id,
          fromStatus: current.status,
          toStatus: to,
          changedBy: actor,
          reason: opts.reason,
        },
      });
      return updated;
    }, tenantId);

    await this.audit.log({
      tenantId,
      action: to === "cancelled" ? "order.cancelled" : "order.status_changed",
      entityType: "order",
      entityId: id,
      branchId: order.branchId,
      meta: { to, reason: opts.reason ?? null, orderNumber: order.orderNumber },
    });
    this.events.emit(
      to === "cancelled" ? DOMAIN_EVENTS.ORDER_CANCELLED : DOMAIN_EVENTS.ORDER_STATUS_CHANGED,
      { tenantId, branchId: order.branchId, order },
    );
    return order;
  }

  // --------------------------------------------------------------------- //

  private async createInTransaction(
    tx: Prisma.TransactionClient,
    dto: CreateOrderDto,
    opts: CreateOrderContext,
    tenantId: string,
    actor: string | null,
    idempotencyKey: string,
  ) {
    // Resolve branch + table/session.
    let branchId: string;
    let tableId: string | null = null;
    let tableSessionId: string | null = null;

    if (dto.type === "dine_in") {
      if (!dto.tableId) {
        throw new BadRequestException("tableId is required for dine-in orders");
      }
      const table = await tx.table.findFirst({
        where: { id: dto.tableId, deletedAt: null },
      });
      if (!table) {
        throw new NotFoundException("Table not found");
      }
      if (table.status === "disabled") {
        throw new ConflictException("Table is disabled");
      }
      branchId = table.branchId;
      tableId = table.id;

      // Orders join the table's open session; open one if none exists.
      const session =
        (await tx.tableSession.findFirst({
          where: { tableId: table.id, closedAt: null },
        })) ??
        (await tx.tableSession.create({
          data: { tenantId, branchId, tableId: table.id, openedBy: actor },
        }));
      tableSessionId = session.id;
      if (table.status !== "occupied") {
        await tx.table.update({ where: { id: table.id }, data: { status: "occupied" } });
      }
    } else {
      if (!dto.branchId) {
        throw new BadRequestException("branchId is required for non-dine-in orders");
      }
      const branch = await tx.branch.findFirst({
        where: { id: dto.branchId, deletedAt: null },
      });
      if (!branch) {
        throw new NotFoundException("Branch not found");
      }
      branchId = branch.id;
    }

    const priced = await this.priceItems(tx, dto.items, branchId);

    const tenant = await tx.tenant.findFirst({ where: { id: tenantId } });
    const vatRate = Number(tenant?.vatRate ?? 15);
    const subtotalHalalas = priced.reduce((sum, item) => sum + item.lineTotalHalalas, 0);
    const vatHalalas = vatFromGross(subtotalHalalas, vatRate);

    // Daily sequential number per branch.
    const today = new Date();
    const orderDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    const last = await tx.order.findFirst({
      where: { branchId, orderDate },
      orderBy: { orderNumber: "desc" },
      select: { orderNumber: true },
    });

    const order = await tx.order.create({
      data: {
        tenantId,
        branchId,
        orderNumber: (last?.orderNumber ?? 0) + 1,
        orderDate,
        type: dto.type,
        source: opts.source,
        tableId,
        tableSessionId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        notes: dto.notes,
        subtotal: halalasToSar(subtotalHalalas),
        discount: "0",
        vatRate: vatRate.toFixed(2),
        vatAmount: halalasToSar(vatHalalas),
        total: halalasToSar(subtotalHalalas),
        idempotencyKey,
        placedBy: actor,
        createdBy: actor,
        items: {
          create: priced.map((item) => ({
            tenantId,
            productId: item.productId,
            productSnapshot: item.productSnapshot,
            quantity: item.quantity,
            unitPrice: halalasToSar(item.unitPriceHalalas),
            lineTotal: halalasToSar(item.lineTotalHalalas),
            notes: item.notes,
            modifiers: {
              create: item.modifiers.map((modifier) => ({
                tenantId,
                modifierId: modifier.modifierId,
                modifierSnapshot: modifier.snapshot,
                priceAdjustment: halalasToSar(modifier.adjustmentHalalas),
              })),
            },
          })),
        },
        statusHistory: {
          create: { tenantId, fromStatus: null, toStatus: "new", changedBy: actor },
        },
      },
      include: ORDER_INCLUDE,
    });
    return order;
  }

  /** Validates items against the catalog and freezes snapshots + prices. */
  private async priceItems(
    tx: Prisma.TransactionClient,
    items: OrderItemInputDto[],
    branchId: string,
  ) {
    const productIds = [...new Set(items.map((item) => item.productId))];
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, deletedAt: null, isActive: true },
      include: {
        branchSettings: { where: { branchId } },
        modifierGroups: {
          include: {
            group: {
              include: { modifiers: { where: { deletedAt: null, isActive: true } } },
            },
          },
        },
      },
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    return items.map((item) => {
      const product = productById.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product not found or inactive: ${item.productId}`);
      }
      const branchSetting = product.branchSettings[0];
      if (branchSetting && !branchSetting.isAvailable) {
        throw new ConflictException(`Product "${product.name}" is not available in this branch`);
      }

      const unitPriceHalalas = sarToHalalas(
        (branchSetting?.priceOverride ?? product.basePrice).toString(),
      );

      // Validate selected modifiers against the product's attached groups.
      const selectedIds = item.modifierIds ?? [];
      if (new Set(selectedIds).size !== selectedIds.length) {
        throw new BadRequestException("Duplicate modifier selection");
      }
      const attachedGroups = product.modifierGroups
        .map((link) => link.group)
        .filter((group) => group.deletedAt === null && group.isActive);
      const modifierIndex = new Map(
        attachedGroups.flatMap((group) =>
          group.modifiers.map((modifier) => [modifier.id, { modifier, group }] as const),
        ),
      );

      const resolved = selectedIds.map((modifierId) => {
        const entry = modifierIndex.get(modifierId);
        if (!entry) {
          throw new BadRequestException(
            `Modifier ${modifierId} is not available for product "${product.name}"`,
          );
        }
        return entry;
      });

      // Enforce group selection rules (min/max, required).
      for (const group of attachedGroups) {
        const count = resolved.filter((entry) => entry.group.id === group.id).length;
        const min = group.isRequired ? Math.max(group.minSelect, 1) : group.minSelect;
        if (count < min) {
          throw new BadRequestException(
            `Group "${group.name}" requires at least ${min} selection(s) for "${product.name}"`,
          );
        }
        if (group.maxSelect != null && count > group.maxSelect) {
          throw new BadRequestException(
            `Group "${group.name}" allows at most ${group.maxSelect} selection(s)`,
          );
        }
      }

      const modifiers = resolved.map(({ modifier, group }) => ({
        modifierId: modifier.id,
        adjustmentHalalas: sarToHalalas(modifier.priceAdjustment.toString()),
        snapshot: {
          name: modifier.name,
          nameEn: modifier.nameEn,
          groupName: group.name,
          groupNameEn: group.nameEn,
        },
      }));

      const adjustments = modifiers.reduce((sum, m) => sum + m.adjustmentHalalas, 0);
      const lineTotalHalalas = (unitPriceHalalas + adjustments) * item.quantity;

      return {
        productId: product.id,
        quantity: item.quantity,
        notes: item.notes,
        unitPriceHalalas,
        lineTotalHalalas,
        productSnapshot: {
          name: product.name,
          nameEn: product.nameEn,
          sku: product.sku,
          price: halalasToSar(unitPriceHalalas),
        },
        modifiers,
      };
    });
  }
}
