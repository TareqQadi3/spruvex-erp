import { Router, type IRouter, type Request } from "express";
import { AppError } from "../../../core/errors/AppError";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import { uuidParamSchema } from "../../../shared/validators/common.validators";
import * as ecommerceService from "../services/ecommerceService";

// Deliberately unauthenticated: an external platform (Salla/Zid/Shopify/mock)
// posts here directly, with no SpruVex JWT. Trust is established per-request
// via provider.verifyWebhook (HMAC signature check inside ecommerceService),
// not via requireAuth/enforceTenantIsolation.
const router: IRouter = Router();

type RequestWithRawBody = Request & { rawBody?: Buffer };

router.post("/:connectionId/orders", async (req, res, next) => {
  try {
    const connectionId = uuidParamSchema.parse(req.params.connectionId);
    const rawBody = (req as RequestWithRawBody).rawBody;
    if (!rawBody) throw AppError.validation("Missing raw request body for webhook signature verification");

    const result = await ecommerceService.stageWebhookOrder(connectionId, req.headers, rawBody, req.body);
    res.status(200).json(buildSuccess({ received: true, duplicate: result.duplicate }));
  } catch (err) {
    next(err);
  }
});

export default router;
