import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import brandsRouter from "./brands";
import productsRouter from "./products";
import cashSessionsRouter from "./cashSessions";
import repairsRouter from "./repairs";
import repairPartsRouter from "./repairParts";
import reportsRouter from "./reports";
import settingsRouter from "./settings";
import authRouter from "./auth";
import paymentMethodsRouter from "./paymentMethods";
import warehousesRouter from "./warehouses";
import installmentPlansRouter from "./installmentPlans";
import installmentSalesRouter from "./installmentSales";
import customersRouter from "../modules/customers/routes/customers";
import suppliersRouter from "../modules/suppliers/routes/suppliers";
import salesRouter from "../modules/sales/routes/sales";
import purchasesRouter from "../modules/purchases/routes/purchases";
import expensesRouter from "../modules/expenses/routes/expenses";
import vouchersRouter from "../modules/vouchers/routes/vouchers";
import accountingRouter from "../modules/accounting";
import barcodeSearchRouter from "./barcodeSearch";
import { requireAuth, requireActiveSubscription } from "../lib/auth-middleware";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);

// requireAuth + requireActiveSubscription applied per-path (not as a bare
// router.use(...) with no path) deliberately: app.ts mounts this whole
// aggregate at app.use("/api", legacyRouter), so ANY request under /api/*
// flows into this router first — including ones meant for sibling mounts
// like /api/platform, /api/zatca, /api/ai that live entirely outside this
// file. A pathless router.use(mw) runs unconditionally for every request
// reaching the router regardless of whether a later route matches, so it
// was incorrectly 403ing /api/platform/* (platform-admin routes, gated by
// their own requirePlatformAdmin check, not tenant subscription state) —
// caught live before this shipped. Previously each line only had
// requireAuth, with no subscription-status check at all: a suspended/
// expired/cancelled company could keep using the whole app freely.
router.use("/categories", requireAuth, requireActiveSubscription, categoriesRouter);
router.use("/brands", requireAuth, requireActiveSubscription, brandsRouter);
router.use("/products", requireAuth, requireActiveSubscription, productsRouter);
router.use("/customers", requireAuth, requireActiveSubscription, customersRouter);
router.use("/cash-sessions", requireAuth, requireActiveSubscription, cashSessionsRouter);
router.use("/sales", requireAuth, requireActiveSubscription, salesRouter);
router.use("/repairs", requireAuth, requireActiveSubscription, repairsRouter);
router.use("/repair-parts", requireAuth, requireActiveSubscription, repairPartsRouter);
router.use("/expenses", requireAuth, requireActiveSubscription, expensesRouter);
router.use("/reports", requireAuth, requireActiveSubscription, reportsRouter);
router.use("/settings", requireAuth, requireActiveSubscription, settingsRouter);
router.use("/payment-methods", requireAuth, requireActiveSubscription, paymentMethodsRouter);
router.use("/suppliers", requireAuth, requireActiveSubscription, suppliersRouter);
router.use("/vouchers", requireAuth, requireActiveSubscription, vouchersRouter);
router.use("/warehouses", requireAuth, requireActiveSubscription, warehousesRouter);
router.use("/installment-plans", requireAuth, requireActiveSubscription, installmentPlansRouter);
router.use("/installment-sales", requireAuth, requireActiveSubscription, installmentSalesRouter);
router.use("/purchases", requireAuth, requireActiveSubscription, purchasesRouter);
router.use("/accounting", requireAuth, requireActiveSubscription, accountingRouter);
router.use("/barcode-search", requireAuth, requireActiveSubscription, barcodeSearchRouter);

export default router;
