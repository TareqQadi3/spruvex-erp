import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";

import { AuditService } from "../../shared/audit/audit.service";
import { halalasToSar, sarToHalalas } from "../../shared/common/money";
import { PrismaService } from "../../shared/prisma/prisma.service";
import {
  actorOrNull,
  TenantContextService,
} from "../../shared/tenancy/tenant-context.service";
import { buildZatcaQrPayload } from "./zatca/tlv";

const NUMBER_CONFLICT_RETRIES = 3;

/**
 * Receipt foundation: sequential per-branch numbering with a frozen snapshot
 * of restaurant info, order lines, VAT fields and payments. Idempotent
 * get-or-create — the POS fetches the receipt after completing an order.
 * The ZATCA invoice service (Phase 7) builds on this structure; thermal
 * print layouts consume `payload`.
 */
@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async getOrCreate(orderId: string) {
    const existing = await this.prisma.scoped.receipt.findUnique({
      where: { orderId },
    });
    if (existing) {
      return existing;
    }
    return this.issue(orderId);
  }

  private async issue(orderId: string) {
    const ctx = this.tenantContext.contextOrThrow;
    const tenantId = this.tenantContext.tenantIdOrThrow;

    for (let attempt = 1; ; attempt++) {
      try {
        const receipt = await this.prisma.scopedTransaction(async (tx) => {
          // Concurrent issuance guard: re-check inside the transaction.
          const raced = await tx.receipt.findUnique({ where: { orderId } });
          if (raced) {
            return raced;
          }

          const order = await tx.order.findFirst({
            where: { id: orderId, deletedAt: null },
            include: {
              items: { include: { modifiers: true } },
              table: { select: { number: true } },
            },
          });
          if (!order) {
            throw new NotFoundException("Order not found");
          }
          if (order.status !== "completed") {
            throw new ConflictException("Receipts are issued for completed orders only");
          }

          const [tenant, branch, payments] = await Promise.all([
            tx.tenant.findFirst({ where: { id: tenantId } }),
            tx.branch.findFirst({ where: { id: order.branchId } }),
            tx.payment.findMany({
              where: { orderId, status: "completed" },
              orderBy: { createdAt: "asc" },
            }),
          ]);

          const last = await tx.receipt.findFirst({
            where: { branchId: order.branchId },
            orderBy: { receiptNumber: "desc" },
            select: { receiptNumber: true, invoiceHash: true },
          });

          const issuedAt = new Date();
          const receiptNumber = (last?.receiptNumber ?? 0) + 1;
          const sellerName = tenant?.legalName ?? tenant?.name ?? "";
          const totalBeforeVat = halalasToSar(
            sarToHalalas(order.total.toString()) - sarToHalalas(order.vatAmount.toString()),
          );

          // ZATCA Phase 1 simplified-invoice QR (TLV/Base64). Only issued
          // when the establishment has a VAT registration number.
          const qrPayload = tenant?.vatNumber
            ? buildZatcaQrPayload({
                sellerName,
                vatNumber: tenant.vatNumber,
                timestamp: issuedAt.toISOString(),
                total: order.total.toString(),
                vatAmount: order.vatAmount.toString(),
              })
            : null;

          // ZATCA Phase 2 readiness: per-branch hash chain over the
          // invoice's canonical fields, linked to the previous invoice.
          const previousInvoiceHash = last?.invoiceHash ?? null;
          const invoiceHash = createHash("sha256")
            .update(
              JSON.stringify({
                tenantId,
                branchId: order.branchId,
                receiptNumber,
                orderId,
                issuedAt: issuedAt.toISOString(),
                total: order.total.toString(),
                vatAmount: order.vatAmount.toString(),
                previousInvoiceHash,
              }),
            )
            .digest("hex");

          return tx.receipt.create({
            data: {
              tenantId,
              branchId: order.branchId,
              orderId,
              receiptNumber,
              vatRate: order.vatRate,
              vatAmount: order.vatAmount,
              total: order.total,
              issuedAt,
              issuedBy: actorOrNull(ctx.userId),
              qrPayload,
              invoiceHash,
              previousInvoiceHash,
              payload: {
                restaurant: {
                  name: tenant?.name,
                  nameEn: tenant?.nameEn,
                  legalName: sellerName,
                  vatNumber: tenant?.vatNumber,
                  crNumber: tenant?.crNumber,
                  address: tenant?.address,
                  logoUrl: tenant?.logoUrl,
                  currency: tenant?.currency,
                },
                branch: {
                  name: branch?.name,
                  nameEn: branch?.nameEn,
                  address: branch?.address,
                  phone: branch?.phone,
                },
                order: {
                  orderNumber: order.orderNumber,
                  type: order.type,
                  table: order.table?.number ?? null,
                  createdAt: order.createdAt.toISOString(),
                  lines: order.items.map((item) => ({
                    name: (item.productSnapshot as { name: string }).name,
                    nameEn: (item.productSnapshot as { nameEn: string | null }).nameEn,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice.toString(),
                    lineTotal: item.lineTotal.toString(),
                    modifiers: item.modifiers.map((modifier) => ({
                      name: (modifier.modifierSnapshot as { name: string }).name,
                      priceAdjustment: modifier.priceAdjustment.toString(),
                    })),
                  })),
                },
                totals: {
                  subtotal: order.subtotal.toString(),
                  discount: order.discount.toString(),
                  totalBeforeVat,
                  vatRate: order.vatRate.toString(),
                  vatAmount: order.vatAmount.toString(),
                  total: order.total.toString(),
                },
                payments: payments.map((payment) => ({
                  method: payment.method,
                  amount: payment.amount.toString(),
                  reference: payment.reference,
                })),
              },
            },
          });
        });

        await this.audit.log({
          action: "receipt.issued",
          entityType: "receipt",
          entityId: receipt.id,
          branchId: receipt.branchId,
          meta: { receiptNumber: receipt.receiptNumber, orderId },
        });
        return receipt;
      } catch (error) {
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
}
