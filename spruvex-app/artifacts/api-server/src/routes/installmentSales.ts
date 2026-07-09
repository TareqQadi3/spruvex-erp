import { Router } from "express";
import { db, installmentSalesTable, installmentPaymentsTable, installmentPlansTable, salesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";

const router = Router();

router.get("/", async (req: AuthedRequest, res) => {
  const { saleId } = req.query;
  const conditions = [eq(installmentSalesTable.companyId, req.user!.companyId)];
  if (saleId) conditions.push(eq(installmentSalesTable.saleId, saleId as string));
  const sales = await db.select().from(installmentSalesTable)
    .where(and(...conditions))
    .orderBy(installmentSalesTable.createdAt);
  res.json(sales);
});

router.post("/", async (req: AuthedRequest, res) => {
  const { saleId, customerId, planId, principal, downPayment } = req.body;
  if (!principal) {
    res.status(400).json({ error: "principal is required" });
    return;
  }
  if (!planId) {
    res.status(400).json({ error: "planId is required" });
    return;
  }

  const [plan] = await db.select().from(installmentPlansTable)
    .where(and(eq(installmentPlansTable.id, planId), eq(installmentPlansTable.companyId, req.user!.companyId)));
  if (!plan) {
    res.status(404).json({ error: "Installment plan not found" });
    return;
  }

  if (saleId) {
    const [sale] = await db.select().from(salesTable)
      .where(and(eq(salesTable.id, saleId), eq(salesTable.companyId, req.user!.companyId)));
    if (!sale) {
      res.status(404).json({ error: "Sale not found" });
      return;
    }
  }

  const principalNum = Number(principal);
  const downPaymentNum = Number(downPayment) || 0;
  const interestPercent = Number(plan.interestPercent);
  const months = plan.months;
  const totalAmount = principalNum * (1 + interestPercent / 100);
  const financedAmount = totalAmount - downPaymentNum;
  const monthlyAmount = financedAmount / months;

  const result = await db.transaction(async (tx) => {
    const [installmentSale] = await tx.insert(installmentSalesTable).values({
      companyId: req.user!.companyId,
      customerId: customerId ?? null,
      saleId: saleId ?? null,
      principal: principalNum.toFixed(2),
      interestPercent: interestPercent.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      months,
      monthlyAmount: monthlyAmount.toFixed(2),
      downPayment: downPaymentNum.toFixed(2),
      startDate: new Date().toISOString().slice(0, 10),
    }).returning();

    const startDate = new Date();
    const paymentRows = Array.from({ length: months }, (_, i) => {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i + 1);
      return {
        companyId: req.user!.companyId,
        installmentSaleId: installmentSale!.id,
        amount: monthlyAmount.toFixed(2),
        dueDate: dueDate.toISOString().slice(0, 10),
      };
    });
    const payments = paymentRows.length > 0
      ? await tx.insert(installmentPaymentsTable).values(paymentRows).returning()
      : [];

    return { installmentSale, payments };
  });

  res.status(201).json(result);
});

router.get("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const [installmentSale] = await db.select().from(installmentSalesTable)
    .where(and(eq(installmentSalesTable.id, id), eq(installmentSalesTable.companyId, req.user!.companyId)));
  if (!installmentSale) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const payments = await db.select().from(installmentPaymentsTable)
    .where(and(eq(installmentPaymentsTable.installmentSaleId, id), eq(installmentPaymentsTable.companyId, req.user!.companyId)))
    .orderBy(installmentPaymentsTable.dueDate);
  res.json({ ...installmentSale, payments });
});

router.post("/:id/payments/:paymentId/pay", async (req: AuthedRequest, res) => {
  const { id, paymentId } = req.params as { id: string; paymentId: string };
  const [payment] = await db.select().from(installmentPaymentsTable)
    .where(and(
      eq(installmentPaymentsTable.id, paymentId),
      eq(installmentPaymentsTable.installmentSaleId, id),
      eq(installmentPaymentsTable.companyId, req.user!.companyId),
    ));
  if (!payment) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (payment.isPaid) {
    res.status(400).json({ error: "Payment already recorded" });
    return;
  }

  const [updated] = await db.update(installmentPaymentsTable).set({
    isPaid: true,
    paidDate: new Date().toISOString().slice(0, 10),
  }).where(eq(installmentPaymentsTable.id, paymentId)).returning();

  const remaining = await db.select().from(installmentPaymentsTable)
    .where(and(eq(installmentPaymentsTable.installmentSaleId, id), eq(installmentPaymentsTable.isPaid, false)));
  if (remaining.length === 0) {
    await db.update(installmentSalesTable).set({ status: "completed" })
      .where(eq(installmentSalesTable.id, id));
  }

  res.json(updated);
});

export default router;
