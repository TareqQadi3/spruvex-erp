import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../core/errors/AppError";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import { syncPullQuerySchema, syncPushSchema } from "../validators/sync.validators";
import * as syncService from "../services/syncService";

export async function pushHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const input = syncPushSchema.parse(req.body);
    const result = await syncService.pushOperations(req.tenant, input);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
}

export async function pullHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const { branchId, since } = syncPullQuerySchema.parse(req.query);
    const lastSyncAt = since ? new Date(since) : null;
    const result = await syncService.pullChanges(req.tenant.companyId, branchId, lastSyncAt);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
}

export async function statusHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const deviceId = String(req.params.deviceId ?? "");
    if (!deviceId) throw AppError.validation("deviceId is required");
    const result = await syncService.getSyncStatus(req.tenant.companyId, deviceId);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
}
