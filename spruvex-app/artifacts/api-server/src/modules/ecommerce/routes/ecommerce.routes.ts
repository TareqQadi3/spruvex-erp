import { Router, type IRouter } from "express";
import { PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireModule } from "../../../core/middleware/subscription.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import { AppError } from "../../../core/errors/AppError";
import { buildPaginated, buildSuccess } from "../../../shared/utils/responseEnvelope";
import { uuidParamSchema } from "../../../shared/validators/common.validators";
import {
  createConnectionSchema,
  importOrderSchema,
  listMappingsQuerySchema,
  listOrdersQuerySchema,
  pushProductsSchema,
  updateConnectionSchema,
} from "../validators/ecommerce.validators";
import * as ecommerceService from "../services/ecommerceService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireModule("ecommerce"));

router.get("/connections", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const connections = await ecommerceService.listConnections(req.tenant);
    res.status(200).json(buildSuccess(connections));
  } catch (err) {
    next(err);
  }
});

router.post("/connections", requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const input = createConnectionSchema.parse(req.body);
    const connection = await ecommerceService.createConnection(req.tenant, input);
    res.status(201).json(buildSuccess(connection));
  } catch (err) {
    next(err);
  }
});

router.patch("/connections/:id", requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const id = uuidParamSchema.parse(req.params.id);
    const input = updateConnectionSchema.parse(req.body);
    const connection = await ecommerceService.updateConnection(req.tenant, id, input);
    res.status(200).json(buildSuccess(connection));
  } catch (err) {
    next(err);
  }
});

router.post("/connections/:id/test", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const id = uuidParamSchema.parse(req.params.id);
    const result = await ecommerceService.testConnection(req.tenant, id);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.post("/connections/:id/push-products", requirePermission(PERMISSIONS.MANAGE_SETTINGS), async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const id = uuidParamSchema.parse(req.params.id);
    const { productIds } = pushProductsSchema.parse(req.body);
    const results = await ecommerceService.pushProducts(req.tenant, id, productIds);
    res.status(200).json(buildSuccess(results));
  } catch (err) {
    next(err);
  }
});

router.get("/connections/:id/mappings", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const id = uuidParamSchema.parse(req.params.id);
    const filters = listMappingsQuerySchema.parse(req.query);
    const { rows, total } = await ecommerceService.listMappings(req.tenant, id, filters);
    res.status(200).json(buildPaginated(rows, { page: filters.page, pageSize: filters.pageSize, total }));
  } catch (err) {
    next(err);
  }
});

router.post("/connections/:id/pull-orders", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const id = uuidParamSchema.parse(req.params.id);
    const result = await ecommerceService.pullOrders(req.tenant, id);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.get("/orders", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const filters = listOrdersQuerySchema.parse(req.query);
    const { rows, total } = await ecommerceService.listOrders(req.tenant, filters);
    res.status(200).json(buildPaginated(rows, { page: filters.page, pageSize: filters.pageSize, total }));
  } catch (err) {
    next(err);
  }
});

router.get("/orders/:id", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const id = uuidParamSchema.parse(req.params.id);
    const order = await ecommerceService.getOrder(req.tenant, id);
    res.status(200).json(buildSuccess(order));
  } catch (err) {
    next(err);
  }
});

router.post("/orders/:id/import", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const id = uuidParamSchema.parse(req.params.id);
    const { paymentMethodId } = importOrderSchema.parse(req.body);
    const result = await ecommerceService.importOrder(req.tenant, id, paymentMethodId);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.post("/orders/:id/ignore", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const id = uuidParamSchema.parse(req.params.id);
    const order = await ecommerceService.ignoreOrder(req.tenant, id);
    res.status(200).json(buildSuccess(order));
  } catch (err) {
    next(err);
  }
});

export default router;
