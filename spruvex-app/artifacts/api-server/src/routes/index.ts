import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import customersRouter from "../modules/customers/routes/customers";
import suppliersRouter from "../modules/suppliers/routes/suppliers";
import salesRouter from "../modules/sales/routes/sales";
import purchasesRouter from "../modules/purchases/routes/purchases";
import expensesRouter from "../modules/expenses/routes/expenses";
import vouchersRouter from "../modules/vouchers/routes/vouchers";
import accountingRouter from "../modules/accounting";
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
router.use("/customers", requireAuth, requireActiveSubscription, customersRouter);
router.use("/sales", requireAuth, requireActiveSubscription, salesRouter);
router.use("/expenses", requireAuth, requireActiveSubscription, expensesRouter);
router.use("/suppliers", requireAuth, requireActiveSubscription, suppliersRouter);
router.use("/vouchers", requireAuth, requireActiveSubscription, vouchersRouter);
router.use("/purchases", requireAuth, requireActiveSubscription, purchasesRouter);
router.use("/accounting", requireAuth, requireActiveSubscription, accountingRouter);

export default router;
