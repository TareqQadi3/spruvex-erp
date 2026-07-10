import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { logger } from "./core/logging/logger";
import { requestContext } from "./core/middleware/requestContext.middleware";
import { rateLimitPerTenant } from "./core/middleware/rateLimit.middleware";
import { errorHandler } from "./core/errors/errorHandler";
import { env } from "./config/env";
import healthRouter from "./routes/health";
import legacyRouter from "./routes";
import authRouter from "./modules/auth/routes/auth.routes";
import rolesRouter from "./modules/rbac/routes/roles.routes";
import permissionsRouter from "./modules/rbac/routes/permissions.routes";
import userRolesRouter from "./modules/rbac/routes/userRoles.routes";
import salesRouter from "./modules/pos/routes/sales.routes";
import inventoryRouter from "./modules/inventory/routes/inventory.routes";
import zatcaRouter from "./modules/zatca/routes/zatca.routes";
import syncRouter from "./modules/sync/routes/sync.routes";
import subscriptionsRouter from "./modules/subscriptions/routes/subscriptions.routes";
import platformRouter from "./modules/platform/routes/platform.routes";
import supportRouter from "./modules/support/routes/support.routes";
import publicRouter from "./modules/public/routes/public.routes";
import aiRouter from "./modules/ai/routes/ai.routes";
import ecommerceRouter from "./modules/ecommerce/routes/ecommerce.routes";
import ecommerceWebhooksRouter from "./modules/ecommerce/routes/ecommerceWebhooks.routes";
import paymentsRouter from "./modules/payments/routes/payments.routes";
import paymentWebhooksRouter from "./modules/payments/routes/paymentWebhooks.routes";
import purchaseInvoicesRouter from "./modules/purchases/routes/purchaseInvoices.routes";
import invoiceTemplatesRouter from "./modules/invoicing/routes/templates.routes";
import invoicePrintRouter from "./modules/invoicing/routes/print.routes";
import biRouter from "./modules/bi/routes/bi.routes";

// Only auth + rbac are mounted so far. Every other module under modules/<name>
// lands here as it's rebuilt against the new core/ + shared/ layer; the
// previous flat routes/index.ts aggregator (and everything it mounted) is
// left in place on disk, untouched, until migrated.
const app: Express = express();

// Security headers (CSP, X-Content-Type-Options, no X-Powered-By, etc.) —
// this is a pure JSON API with no server-rendered HTML, so helmet's
// defaults are safe as-is with no per-route CSP tuning needed.
app.use(helmet());

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// In production, only the configured frontend origin(s) may call this API — set
// ALLOWED_ORIGINS to a comma-separated list. Local dev has no fixed frontend port
// (Vite picks one per-run), so it falls back to allow-all there only.
app.use(
  cors(
    env.allowedOrigins?.length
      ? { origin: env.allowedOrigins }
      : env.isProduction
        ? { origin: false }
        : {},
  ),
);

app.use(
  express.json({
    limit: "10mb",
    // Keep the raw body bytes alongside the parsed JSON: webhook endpoints
    // (ecommerce platforms, payment gateways) verify HMAC signatures over the
    // exact bytes sent, and re-serializing req.body would not round-trip.
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(requestContext);
app.use(rateLimitPerTenant);

app.use(healthRouter);

// The legacy aggregate router mounts first: the current POS frontend is built
// against its endpoints and response shapes (flat { token, user } login, plain
// list endpoints for products/customers/repairs/...). The modular routers
// below only receive requests the legacy set doesn't define (register-company,
// refresh, inventory, zatca, sync, rbac). As each module is migrated, its
// legacy counterpart is removed from routes/index.ts and the module takes over.
app.use("/api", legacyRouter);

// Mounted before userRolesRouter deliberately: userRolesRouter is mounted
// broadly at "/api" with an unscoped `router.use(requireAuth, ...)` inside,
// which intercepts every /api/* request that reaches it (even ones matching
// no route of its own) before falling through. Any unauthenticated route
// must be registered ahead of that mount or it will 401 unconditionally.
app.use("/api/public", publicRouter);
// Webhook receivers are called by external platforms (Salla/Zid/Shopify,
// Tabby/Tamara/Moyasar) with signature verification instead of JWT auth, so
// like /api/public they must be mounted ahead of userRolesRouter's broad
// requireAuth — and ahead of the auth-gated /api/ecommerce and /api/payments
// mounts below, which would otherwise 401 these paths.
app.use("/api/ecommerce/webhooks", ecommerceWebhooksRouter);
app.use("/api/payments/webhooks", paymentWebhooksRouter);

app.use("/api/auth", authRouter);
app.use("/api/roles", rolesRouter);
app.use("/api/permissions", permissionsRouter);
app.use("/api", userRolesRouter); // exposes /users/:userId/roles and /user-roles/:id
app.use("/api/sales", salesRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/zatca", zatcaRouter);
app.use("/api/sync", syncRouter);
app.use("/api/subscriptions", subscriptionsRouter);
app.use("/api/support", supportRouter);
app.use("/api/ai", aiRouter);
app.use("/api/ecommerce", ecommerceRouter);
app.use("/api/payments", paymentsRouter);
// "/api/purchase-invoices", not "/api/purchases" — that prefix is already
// claimed by the legacy purchases router mounted above via legacyRouter.
app.use("/api/purchase-invoices", purchaseInvoicesRouter);
app.use("/api/invoicing/templates", invoiceTemplatesRouter);
app.use("/api/invoicing/print", invoicePrintRouter);
app.use("/api/bi", biRouter);
// Cross-tenant super-admin routes — guarded by requirePlatformAdmin (checks
// usersTable.isPlatformAdmin directly), not enforceTenantIsolation. See
// modules/platform/middleware/platformAdmin.middleware.ts.
app.use("/api/platform", platformRouter);

// Remaining business module routers are mounted here as each is rebuilt, e.g.:
//   app.use("/api/branches", requireAuth, enforceTenantIsolation, branchesRouter);

app.use(errorHandler);

export default app;
