import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../../core/errors/AppError";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import { uuidParamSchema } from "../../../shared/validators/common.validators";
import { createInvoiceFromSaleSchema, submitToZatcaSchema } from "../validators/zatca.validators";
import * as zatcaService from "../services/zatcaService";

export async function createInvoiceHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const input = createInvoiceFromSaleSchema.parse(req.body);
    const invoice = await zatcaService.createInvoiceFromSale(req.tenant, input);
    res.status(201).json(buildSuccess(invoice));
  } catch (err) {
    next(err);
  }
}

export async function getInvoiceHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const invoiceId = uuidParamSchema.parse(req.params.id);
    const detail = await zatcaService.getInvoiceDetail(req.tenant.companyId, invoiceId);
    res.status(200).json(buildSuccess(detail));
  } catch (err) {
    next(err);
  }
}

export async function generateXmlHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const invoiceId = uuidParamSchema.parse(req.params.id);
    const xml = await zatcaService.generateUBLXML(req.tenant, invoiceId);
    res.status(200).json(buildSuccess(xml));
  } catch (err) {
    next(err);
  }
}

export async function signInvoiceHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const invoiceId = uuidParamSchema.parse(req.params.id);
    const signature = await zatcaService.signInvoice(req.tenant, invoiceId);
    res.status(200).json(buildSuccess(signature));
  } catch (err) {
    next(err);
  }
}

export async function generateQrHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const invoiceId = uuidParamSchema.parse(req.params.id);
    const qr = await zatcaService.generateQRCode(req.tenant, invoiceId);
    res.status(200).json(buildSuccess(qr));
  } catch (err) {
    next(err);
  }
}

export async function submitHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const invoiceId = uuidParamSchema.parse(req.params.id);
    const input = submitToZatcaSchema.parse(req.body);
    const result = await zatcaService.submitToZATCA(req.tenant, invoiceId, input);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
}
