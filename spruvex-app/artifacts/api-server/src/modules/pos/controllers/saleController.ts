import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../core/errors/AppError";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import { createSaleSchema } from "../validators/pos.validators";
import * as saleService from "../services/saleService";

export async function createSaleHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const input = createSaleSchema.parse(req.body);
    const sale = await saleService.createSale(req.tenant, input);
    res.status(201).json(buildSuccess(sale));
  } catch (err) {
    next(err);
  }
}
