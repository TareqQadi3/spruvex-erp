import { Router, type IRouter, type Request } from "express";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import * as paymentsService from "../services/paymentsService";

// No auth middleware on this router — gateways call these endpoints
// directly, authenticated only by their own signature/token scheme (verified
// inside paymentsService.handleWebhook via each provider's verifyWebhook).
const router: IRouter = Router();

router.post("/:provider", async (req: Request & { rawBody?: Buffer }, res, next) => {
  try {
    const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    const result = await paymentsService.handleWebhook(req.params.provider as string, req.headers, rawBody, req.body);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

export default router;
