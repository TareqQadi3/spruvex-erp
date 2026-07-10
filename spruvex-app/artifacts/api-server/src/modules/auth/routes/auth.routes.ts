import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { rateLimitAuth } from "../../../core/middleware/rateLimit.middleware";
import { AppError } from "../../../core/errors/AppError";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import { registerCompanySchema, loginSchema, refreshSchema } from "../validators/auth.validators";
import * as authService from "../services/authService";

const router: IRouter = Router();

router.post("/register-company", rateLimitAuth, async (req, res, next) => {
  try {
    const input = registerCompanySchema.parse(req.body);
    const result = await authService.registerCompany(input);
    res.status(201).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.post("/login", rateLimitAuth, async (req, res, next) => {
  try {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = refreshSchema.parse(req.body);
    const result = await authService.refresh(refreshToken);
    res.status(200).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

// Stateless refresh tokens (see tokenService) — nothing to revoke server-side
// yet. Endpoint exists so clients have a stable contract to call on sign-out.
router.post("/logout", (_req, res) => {
  res.status(200).json(buildSuccess({ success: true }));
});

router.get("/me", requireAuth, enforceTenantIsolation, async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const user = await authService.getCurrentUser(req.tenant);
    res.status(200).json(buildSuccess({ user }));
  } catch (err) {
    next(err);
  }
});

export default router;
