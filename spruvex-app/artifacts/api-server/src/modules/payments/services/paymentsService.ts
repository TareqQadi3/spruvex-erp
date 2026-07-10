import { PAYMENT_PROVIDERS, type PaymentProviderName, type PaymentGatewaySettings, type PaymentTransaction } from "@workspace/db";
import { AppError } from "../../../core/errors/AppError";
import { recordAuditEvent } from "../../../core/logging/auditLogger";
import { withTransaction } from "../../../core/database/transaction";
import type { DbOrTx } from "../../../core/database/transaction";
import { toCents, fromCents } from "../../../shared/utils/money";
import type { TenantContext } from "../../../shared/types/tenantContext";
import { paymentsRepository, type ListTransactionsFilters } from "../repositories/paymentsRepository";
import { getPaymentProvider } from "../providers";
import type { PaymentStatus } from "../providers/types";

function isPaymentProviderName(value: string): value is PaymentProviderName {
  return (PAYMENT_PROVIDERS as readonly string[]).includes(value);
}

// The DB column also holds "created" (before a gateway checkout call has
// even happened) — a state the provider layer's PaymentStatus never
// produces, so transaction rows need this wider local type.
type TransactionStatus = PaymentStatus | "created";

const TERMINAL_STATUSES = new Set<TransactionStatus>(["refunded"]);

function isDowngradeFromCaptured(current: TransactionStatus, next: TransactionStatus): boolean {
  return current === "captured" && (next === "failed" || next === "cancelled");
}

// --- gateway settings -----------------------------------------------------

export interface GatewaySettingsView {
  id: string;
  provider: string;
  mode: string;
  isActive: boolean;
  hasCredentials: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toGatewayView(row: PaymentGatewaySettings): GatewaySettingsView {
  return {
    id: row.id,
    provider: row.provider,
    mode: row.mode,
    isActive: row.isActive,
    hasCredentials: Boolean(row.credentials && Object.keys(row.credentials as Record<string, unknown>).length > 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listGateways(companyId: string): Promise<GatewaySettingsView[]> {
  const rows = await paymentsRepository.listGatewaySettings(companyId);
  return rows.map(toGatewayView);
}

export interface UpsertGatewayInput {
  credentials?: Record<string, unknown>;
  mode?: "test" | "live";
  isActive?: boolean;
}

export async function upsertGateway(
  tenant: TenantContext,
  provider: string,
  input: UpsertGatewayInput,
): Promise<GatewaySettingsView> {
  if (!isPaymentProviderName(provider)) {
    throw AppError.validation(`Unknown payment provider: ${provider}`);
  }

  const row = await paymentsRepository.upsertGatewaySettings({
    companyId: tenant.companyId,
    provider,
    credentials: input.credentials,
    mode: input.mode,
    isActive: input.isActive,
  });

  recordAuditEvent(tenant, {
    action: "update_payment_gateway",
    entityType: "payment_gateway_settings",
    entityId: row.id,
    details: { provider, mode: row.mode, isActive: row.isActive },
  });

  return toGatewayView(row);
}

// --- checkout ---------------------------------------------------------------

export interface CreateCheckoutServiceInput {
  provider: string;
  source: "sale" | "ecommerce_order";
  sourceId: string;
  idempotencyKey?: string;
  successUrl?: string;
  cancelUrl?: string;
}

async function resolveActiveGateway(companyId: string, provider: string): Promise<PaymentGatewaySettings> {
  const settings = await paymentsRepository.findGatewaySettings(companyId, provider);
  if (!settings || !settings.isActive || !settings.credentials) {
    throw AppError.validation(`Payment gateway ${provider} is not configured/active`);
  }
  return settings;
}

export async function createCheckout(
  tenant: TenantContext,
  input: CreateCheckoutServiceInput,
): Promise<PaymentTransaction> {
  if (!isPaymentProviderName(input.provider)) {
    throw AppError.validation(`Unknown payment provider: ${input.provider}`);
  }

  const settings = await resolveActiveGateway(tenant.companyId, input.provider);

  if (input.idempotencyKey) {
    const existing = await paymentsRepository.findTransactionByIdempotencyKey(tenant.companyId, input.idempotencyKey);
    if (existing) return existing;
  }

  let amountCents: number;
  let saleId: string | null = null;

  if (input.source === "sale") {
    const sale = await paymentsRepository.findSaleById(tenant.companyId, input.sourceId);
    if (!sale) throw AppError.notFound("Sale not found");
    const outstandingCents = toCents(sale.total) - toCents(sale.amountPaid);
    if (outstandingCents <= 0) throw AppError.conflict("Sale is fully paid");
    amountCents = outstandingCents;
    saleId = sale.id;
  } else {
    const order = await paymentsRepository.findEcommerceOrderById(tenant.companyId, input.sourceId);
    if (!order) throw AppError.notFound("Ecommerce order not found");
    if (order.status !== "received") {
      throw AppError.conflict(`Ecommerce order is not awaiting payment (status: ${order.status})`);
    }
    amountCents = toCents(order.total);
    saleId = null;
  }

  const transaction = await paymentsRepository.insertTransaction({
    companyId: tenant.companyId,
    provider: input.provider,
    source: input.source,
    sourceId: input.sourceId,
    saleId,
    amount: fromCents(amountCents),
    currency: "SAR",
    status: "created",
    idempotencyKey: input.idempotencyKey ?? null,
  });

  const provider = getPaymentProvider(input.provider);

  try {
    const result = await provider.createCheckout(
      { credentials: settings.credentials as Record<string, unknown>, mode: settings.mode as "test" | "live" },
      {
        amount: amountCents / 100,
        currency: "SAR",
        description: `SpruVex ${input.source} ${input.sourceId}`,
        reference: transaction.id,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
      },
    );

    const updated = await paymentsRepository.updateTransactionById(tenant.companyId, transaction.id, {
      externalId: result.externalId,
      checkoutUrl: result.checkoutUrl,
      status: "pending",
    });

    recordAuditEvent(tenant, {
      action: "create_payment_checkout",
      entityType: "payment_transaction",
      entityId: transaction.id,
      details: { provider: input.provider, amount: fromCents(amountCents), source: input.source, sourceId: input.sourceId },
    });

    return updated ?? transaction;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown payment provider error";
    await paymentsRepository.updateTransactionById(tenant.companyId, transaction.id, {
      status: "failed",
      errorMessage: message.slice(0, 500),
    });
    throw err;
  }
}

// --- status transitions -----------------------------------------------------

export interface StatusTransitionResult {
  transaction: PaymentTransaction;
  duplicate: boolean;
}

// Shared by both the webhook handler and the manual refresh endpoint so the
// capture side-effects (sale_payments row + sales.amountPaid bump) happen
// exactly once no matter which path observes the transition first.
export async function applyStatusTransition(
  txRow: PaymentTransaction,
  newStatus: PaymentStatus,
  payload?: unknown,
): Promise<StatusTransitionResult> {
  const currentStatus = txRow.status as TransactionStatus;

  if (currentStatus === newStatus) {
    return { transaction: txRow, duplicate: true };
  }
  if (TERMINAL_STATUSES.has(currentStatus)) {
    return { transaction: txRow, duplicate: true };
  }
  if (isDowngradeFromCaptured(currentStatus, newStatus)) {
    return { transaction: txRow, duplicate: true };
  }

  if (newStatus === "captured" && (currentStatus === "created" || currentStatus === "pending")) {
    const claimed = await withTransaction(async (tx: DbOrTx) => {
      // The conditional UPDATE is the concurrency gate: only one of two
      // racing capture observers (duplicate webhook delivery, or webhook vs
      // manual refresh) gets a row back; the loser settles nothing.
      const updatedTx = await paymentsRepository.claimTransactionForCapture(
        txRow.companyId,
        txRow.id,
        payload ?? txRow.payload,
        tx,
      );
      if (!updatedTx) return null;

      if (txRow.source === "sale" && txRow.saleId) {
        await paymentsRepository.insertSalePayment(
          {
            companyId: txRow.companyId,
            saleId: txRow.saleId,
            paymentMethodId: null,
            methodName: `online_${txRow.provider}`,
            amount: txRow.amount,
          },
          tx,
        );
        await paymentsRepository.incrementSaleAmountPaid(txRow.companyId, txRow.saleId, txRow.amount, tx);
      }

      return updatedTx;
    });

    if (!claimed) {
      const current = await paymentsRepository.findTransactionById(txRow.companyId, txRow.id);
      return { transaction: current ?? txRow, duplicate: true };
    }
    return { transaction: claimed, duplicate: false };
  }

  const fields: Partial<Pick<PaymentTransaction, "status" | "errorMessage" | "payload">> = {
    status: newStatus,
    payload: payload ?? txRow.payload,
  };
  if (newStatus === "failed") {
    fields.errorMessage = "Payment failed at provider";
  }

  const updated = await paymentsRepository.updateTransactionById(txRow.companyId, txRow.id, fields);
  if (!updated) throw AppError.internal("Failed to update payment transaction");

  return { transaction: updated, duplicate: false };
}

// --- refresh / refund --------------------------------------------------------

export async function refreshTransaction(tenant: TenantContext, id: string): Promise<PaymentTransaction> {
  const txRow = await paymentsRepository.findTransactionById(tenant.companyId, id);
  if (!txRow) throw AppError.notFound("Payment transaction not found");
  if (!txRow.externalId) throw AppError.validation("Payment transaction has no external id yet");

  const settings = await resolveActiveGateway(tenant.companyId, txRow.provider);
  const provider = getPaymentProvider(txRow.provider as PaymentProviderName);

  const status = await provider.getStatus(
    { credentials: settings.credentials as Record<string, unknown>, mode: settings.mode as "test" | "live" },
    txRow.externalId,
  );

  const { transaction } = await applyStatusTransition(txRow, status);
  return transaction;
}

export async function refundTransaction(
  tenant: TenantContext,
  id: string,
  amount?: number,
): Promise<PaymentTransaction> {
  const txRow = await paymentsRepository.findTransactionById(tenant.companyId, id);
  if (!txRow) throw AppError.notFound("Payment transaction not found");
  if (txRow.status !== "captured") throw AppError.conflict("Only captured payments can be refunded");
  if (!txRow.externalId) throw AppError.validation("Payment transaction has no external id");

  const transactionCents = toCents(txRow.amount);
  const refundCents = amount !== undefined ? toCents(amount) : transactionCents;
  if (refundCents <= 0) throw AppError.validation("Refund amount must be positive");
  if (refundCents > transactionCents) throw AppError.validation("Refund amount exceeds transaction amount");

  const settings = await resolveActiveGateway(tenant.companyId, txRow.provider);
  const provider = getPaymentProvider(txRow.provider as PaymentProviderName);

  await provider.refund(
    { credentials: settings.credentials as Record<string, unknown>, mode: settings.mode as "test" | "live" },
    txRow.externalId,
    refundCents / 100,
  );

  // Single-shot refund only — partial refund accounting (adjusting
  // sales.amountPaid down by less than the full amount) is out of scope;
  // the requested refund amount is recorded in payload for audit purposes.
  const payload = {
    ...(typeof txRow.payload === "object" && txRow.payload ? (txRow.payload as Record<string, unknown>) : {}),
    refundRequested: fromCents(refundCents),
  };

  const { transaction } = await applyStatusTransition(txRow, "refunded", payload);

  recordAuditEvent(tenant, {
    action: "refund_payment",
    entityType: "payment_transaction",
    entityId: txRow.id,
    details: { provider: txRow.provider, amount: fromCents(refundCents), transactionAmount: txRow.amount },
  });

  return transaction;
}

// --- listing / detail ---------------------------------------------------------

export async function getTransaction(tenant: TenantContext, id: string): Promise<PaymentTransaction> {
  const txRow = await paymentsRepository.findTransactionById(tenant.companyId, id);
  if (!txRow) throw AppError.notFound("Payment transaction not found");
  return txRow;
}

export async function listTransactions(
  companyId: string,
  filters: ListTransactionsFilters,
): Promise<{ rows: PaymentTransaction[]; total: number }> {
  return paymentsRepository.listTransactions(companyId, filters);
}

// --- webhook -----------------------------------------------------------------

export interface WebhookResult {
  received: boolean;
  duplicate: boolean;
}

// Deliberately does NOT check subscription/addon state (no requireModule
// equivalent here): an in-flight payment must be able to settle even if the
// payment_gateways addon lapses mid-checkout — the webhook is the gateway
// telling us what already happened, not a new feature usage to gate.
export async function handleWebhook(
  providerName: string,
  headers: Record<string, string | string[] | undefined>,
  rawBody: Buffer,
  body: unknown,
): Promise<WebhookResult> {
  if (!isPaymentProviderName(providerName)) {
    throw AppError.validation(`Unknown payment provider: ${providerName}`);
  }
  const provider = getPaymentProvider(providerName);

  const parsed = provider.parseWebhook(body);
  if (!parsed) throw AppError.validation("Unrecognized webhook payload");

  const txRow = await paymentsRepository.findTransactionByProviderExternalIdUnscoped(providerName, parsed.externalId);
  if (!txRow) throw AppError.notFound("Payment transaction not found");

  const settings = await paymentsRepository.findGatewaySettings(txRow.companyId, providerName);
  if (!settings || !settings.credentials) throw AppError.notFound("Payment transaction not found");

  const valid = provider.verifyWebhook(
    { credentials: settings.credentials as Record<string, unknown>, mode: settings.mode as "test" | "live" },
    headers,
    rawBody,
  );
  if (!valid) throw AppError.unauthorized("invalid webhook signature");

  const { duplicate } = await applyStatusTransition(txRow, parsed.status, body);
  return { received: true, duplicate };
}
