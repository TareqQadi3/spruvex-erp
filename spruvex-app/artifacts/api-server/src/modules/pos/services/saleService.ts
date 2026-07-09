import { PERMISSIONS } from "@workspace/db";
import { withTransaction } from "../../../core/database/transaction";
import { AppError } from "../../../core/errors/AppError";
import { recordAuditEvent } from "../../../core/logging/auditLogger";
import { toCents, fromCents } from "../../../shared/utils/money";
import type { TenantContext } from "../../../shared/types/tenantContext";
import { permissionResolver } from "../../rbac/services/permissionResolverService";
import { SaleRepository } from "../repositories/saleRepository";
import { stockDeductionService } from "./stockDeductionService";
import type { CreateSaleInput, SaleResult } from "../types/pos.types";

const repo = new SaleRepository();

async function assertPermission(tenant: TenantContext, code: string, message: string): Promise<void> {
  const permissions = await permissionResolver.resolve(tenant.companyId, tenant.userId, tenant.branchId);
  if (!permissions.includes(code)) throw AppError.forbidden(message);
}

// NOTE on branch_id: the real `sales` table has no branch_id column and there
// is no `branches` table in the live schema — both would require a schema
// change, out of scope this turn. tenant.branchId (already sourced only from
// the JWT, never the request body) is threaded through so once a branches
// module lands, wiring it into the insert/validation below is a small,
// additive change rather than a redesign.
export async function createSale(tenant: TenantContext, input: CreateSaleInput): Promise<SaleResult> {
  return withTransaction(async (tx) => {
    // --- products: must exist and belong to this company; locked for the
    // duration of the transaction so a concurrent sale can't oversell ---
    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const products = await repo.findProductsForUpdate(tenant.companyId, productIds, tx);
    const productMap = new Map(products.map((product) => [product.id, product]));

    for (const item of input.items) {
      if (!productMap.has(item.productId)) {
        throw AppError.notFound(`Product ${item.productId} not found`);
      }
    }
    for (const item of input.items) {
      const product = productMap.get(item.productId)!;
      if (product.stock < item.quantity) {
        throw AppError.conflict(
          `Insufficient stock for "${product.name}": have ${product.stock}, need ${item.quantity}`,
        );
      }
    }

    // --- payment methods: must exist and belong to this company ---
    const methodIds = [...new Set(input.payments.map((payment) => payment.paymentMethodId))];
    const methods = await repo.findPaymentMethods(tenant.companyId, methodIds, tx);
    const methodMap = new Map(methods.map((method) => [method.id, method]));

    for (const payment of input.payments) {
      if (!methodMap.has(payment.paymentMethodId)) {
        throw AppError.notFound(`Payment method ${payment.paymentMethodId} not found`);
      }
    }

    // --- optional references: still validated against this tenant only ---
    if (input.customerId) {
      const customer = await repo.findCustomerById(tenant.companyId, input.customerId, tx);
      if (!customer) throw AppError.notFound("Customer not found");
    }
    if (input.cashSessionId) {
      const session = await repo.findCashSessionById(tenant.companyId, input.cashSessionId, tx);
      if (!session) throw AppError.notFound("Cash session not found");
      if (session.status !== "open") throw AppError.validation("Cash session is not open");
    }

    // --- discount / price overrides require the existing RBAC permissions,
    // checked against the live DB (not the route, since it depends on body content) ---
    const hasDiscount = (input.discount ?? 0) > 0 || input.items.some((item) => (item.discount ?? 0) > 0);
    if (hasDiscount) {
      await assertPermission(tenant, PERMISSIONS.OVERRIDE_DISCOUNT, "Missing permission to apply a discount");
    }
    const hasPriceOverride = input.items.some((item) => {
      if (item.unitPrice === undefined) return false;
      const product = productMap.get(item.productId)!;
      return toCents(item.unitPrice) !== toCents(product.sellingPrice);
    });
    if (hasPriceOverride) {
      await assertPermission(tenant, PERMISSIONS.EDIT_PRODUCT_PRICE, "Missing permission to override product price");
    }

    // --- totals computed in integer cents throughout ---
    let subtotalCents = 0;
    let itemDiscountCents = 0;
    const computedItems = input.items.map((item) => {
      const product = productMap.get(item.productId)!;
      const unitPriceCents = toCents(item.unitPrice ?? product.sellingPrice);
      const lineDiscountCents = toCents(item.discount ?? 0);
      const lineGrossCents = unitPriceCents * item.quantity;
      subtotalCents += lineGrossCents;
      itemDiscountCents += lineDiscountCents;
      return {
        productId: item.productId,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: fromCents(unitPriceCents),
        discount: fromCents(lineDiscountCents),
        subtotal: fromCents(lineGrossCents - lineDiscountCents),
      };
    });

    const overallDiscountCents = toCents(input.discount ?? 0);
    const totalDiscountCents = itemDiscountCents + overallDiscountCents;
    const totalCents = subtotalCents - totalDiscountCents;
    if (totalCents < 0) throw AppError.validation("Discount exceeds sale subtotal");

    // --- payments must sum to exactly the sale total — no partial/over payment ---
    const paymentTotalCents = input.payments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
    if (paymentTotalCents !== totalCents) {
      throw AppError.validation(
        `Payment total (${fromCents(paymentTotalCents)}) does not match sale total (${fromCents(totalCents)})`,
      );
    }

    // --- fees are additive/informational (charged on top, per vision's payment
    // engine rule: fees apply only to the amount paid via that method) ---
    let feeCents = 0;
    const computedPayments = input.payments.map((payment) => {
      const method = methodMap.get(payment.paymentMethodId)!;
      const amountCents = toCents(payment.amount);
      const fee = Math.round((amountCents * Number(method.percentFee)) / 100) + toCents(method.fixedFee);
      feeCents += fee;
      return { paymentMethodId: method.id, methodName: method.name, amount: fromCents(amountCents) };
    });

    // --- everything below is the actual write; any throw here rolls back
    // the whole transaction, including anything written earlier in this call ---
    const sale = await repo.createSale(
      {
        companyId: tenant.companyId,
        customerId: input.customerId,
        cashSessionId: input.cashSessionId,
        subtotal: fromCents(subtotalCents),
        discount: fromCents(totalDiscountCents),
        total: fromCents(totalCents),
        amountPaid: fromCents(paymentTotalCents),
        change: "0.00",
        paymentMethod: methods.length === 1 ? methods[0].name : "split",
        paymentMethodId: methods.length === 1 ? methods[0].id : undefined,
        paymentFee: fromCents(feeCents),
        status: "completed",
        notes: input.notes,
      },
      tx,
    );

    const items = await repo.createSaleItems(
      computedItems.map((item) => ({ ...item, companyId: tenant.companyId, saleId: sale.id })),
      tx,
    );

    const payments = await repo.createSalePayments(
      computedPayments.map((payment) => ({ ...payment, companyId: tenant.companyId, saleId: sale.id })),
      tx,
    );

    // Deducted last: if stock ran out between the initial check and now
    // (shouldn't happen under the FOR UPDATE lock, but guarded regardless),
    // this throws and the sale/items/payments above are rolled back too —
    // all or nothing. Routed through the inventory engine's compatibility
    // layer (see stockDeductionService) rather than decrementing
    // products.stock directly.
    await stockDeductionService.deduct(
      tenant,
      sale.id,
      input.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        productName: productMap.get(item.productId)!.name,
      })),
      tx,
    );

    recordAuditEvent(tenant, {
      action: "create_sale",
      entityType: "sale",
      entityId: sale.id,
      details: { total: sale.total },
    });

    return {
      id: sale.id,
      companyId: sale.companyId,
      customerId: sale.customerId,
      cashSessionId: sale.cashSessionId,
      subtotal: sale.subtotal,
      discount: sale.discount,
      total: sale.total,
      amountPaid: sale.amountPaid,
      paymentFee: sale.paymentFee,
      status: sale.status,
      items,
      payments,
      createdAt: sale.createdAt,
    };
  });
}
