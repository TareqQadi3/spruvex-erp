import { Injectable, NotFoundException } from "@nestjs/common";

import { PlatformPrismaService } from "../../shared/prisma/platform-prisma.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import {
  GUEST_ACTOR,
  TenantContextService,
} from "../../shared/tenancy/tenant-context.service";
import { GuestCreateOrderDto } from "./dto/order.dto";
import { OrderingService } from "./ordering.service";

/**
 * Guest (QR) ordering. The QR token is the only credential: it is resolved
 * to tenant/branch/table on the platform connection (tokens are globally
 * unique, and no tenant context exists yet), after which every data access
 * runs inside that tenant's RLS scope with the guest sentinel actor.
 */
@Injectable()
export class GuestOrderingService {
  constructor(
    private readonly platformDb: PlatformPrismaService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly ordering: OrderingService,
  ) {}

  private async resolveToken(qrToken: string) {
    const table = await this.platformDb.table.findFirst({
      where: { qrToken, deletedAt: null },
      include: {
        branch: {
          select: { id: true, name: true, nameEn: true, isActive: true, deletedAt: true },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            slug: true,
            logoUrl: true,
            currency: true,
            defaultLocale: true,
            status: true,
          },
        },
      },
    });
    if (
      !table ||
      table.tenant.status !== "active" ||
      !table.branch.isActive ||
      table.branch.deletedAt
    ) {
      throw new NotFoundException("QR code is not valid");
    }
    return table;
  }

  async tableInfo(qrToken: string) {
    const table = await this.resolveToken(qrToken);
    return {
      restaurant: {
        name: table.tenant.name,
        nameEn: table.tenant.nameEn,
        slug: table.tenant.slug,
        logoUrl: table.tenant.logoUrl,
        currency: table.tenant.currency,
        defaultLocale: table.tenant.defaultLocale,
      },
      branch: { name: table.branch.name, nameEn: table.branch.nameEn },
      table: { number: table.number, status: table.status },
    };
  }

  /** Active menu for the table's branch (branch availability + price overrides applied). */
  async menu(qrToken: string) {
    const table = await this.resolveToken(qrToken);
    const scoped = this.prisma.forTenant(table.tenantId);

    const categories = await scoped.category.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: { id: true, name: true, nameEn: true, description: true, imageUrl: true },
    });
    const products = await scoped.product.findMany({
      where: { deletedAt: null, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: {
        branchSettings: { where: { branchId: table.branchId } },
        modifierGroups: {
          orderBy: { sortOrder: "asc" },
          include: {
            group: {
              include: {
                modifiers: {
                  where: { deletedAt: null, isActive: true },
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
      },
    });

    return {
      categories,
      products: products
        .filter((product) => product.branchSettings[0]?.isAvailable !== false)
        .map((product) => ({
          id: product.id,
          categoryId: product.categoryId,
          name: product.name,
          nameEn: product.nameEn,
          description: product.description,
          descriptionEn: product.descriptionEn,
          imageUrl: product.imageUrl,
          price: (product.branchSettings[0]?.priceOverride ?? product.basePrice).toString(),
          modifierGroups: product.modifierGroups
            .filter((link) => link.group.deletedAt === null && link.group.isActive)
            .map((link) => ({
              id: link.group.id,
              name: link.group.name,
              nameEn: link.group.nameEn,
              isRequired: link.group.isRequired,
              minSelect: link.group.minSelect,
              maxSelect: link.group.maxSelect,
              modifiers: link.group.modifiers.map((modifier) => ({
                id: modifier.id,
                name: modifier.name,
                nameEn: modifier.nameEn,
                priceAdjustment: modifier.priceAdjustment.toString(),
              })),
            })),
        })),
    };
  }

  /** Creates a dine-in order attached to the table's open session. */
  async createOrder(qrToken: string, dto: GuestCreateOrderDto, idempotencyKey: string) {
    const table = await this.resolveToken(qrToken);

    const order = await this.tenantContext.run(
      { userId: GUEST_ACTOR, tenantId: table.tenantId, permissions: new Set() },
      () =>
        this.ordering.create(
          {
            type: "dine_in",
            tableId: table.id,
            items: dto.items,
            notes: dto.notes,
            customerName: dto.customerName,
          },
          { source: "qr", tenantId: table.tenantId },
          idempotencyKey,
        ),
    );

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      total: order.total.toString(),
    };
  }
}
