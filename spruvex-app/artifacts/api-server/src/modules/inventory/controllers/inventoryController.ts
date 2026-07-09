import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../core/errors/AppError";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import { uuidParamSchema } from "../../../shared/validators/common.validators";
import {
  adjustStockSchema,
  commitStockDeductionSchema,
  getStockQuerySchema,
  reserveStockSchema,
  transferStockSchema,
} from "../validators/inventory.validators";
import * as inventoryService from "../services/inventoryService";

export async function getStockHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const productId = uuidParamSchema.parse(req.params.productId);
    const { warehouseId } = getStockQuerySchema.parse(req.query);
    const stock = await inventoryService.getStock(req.tenant.companyId, productId, warehouseId);
    res.status(200).json(buildSuccess(stock));
  } catch (err) {
    next(err);
  }
}

export async function adjustStockHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const input = adjustStockSchema.parse(req.body);
    const result = await inventoryService.adjustStock(req.tenant, input);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
}

export async function transferStockHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const input = transferStockSchema.parse(req.body);
    const result = await inventoryService.transferStock(req.tenant, input);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
}

export async function reserveStockHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const input = reserveStockSchema.parse(req.body);
    const result = await inventoryService.reserveStock(req.tenant, input);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
}

export async function commitStockDeductionHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const input = commitStockDeductionSchema.parse(req.body);
    const result = await inventoryService.commitStockDeduction(req.tenant, input);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
}
