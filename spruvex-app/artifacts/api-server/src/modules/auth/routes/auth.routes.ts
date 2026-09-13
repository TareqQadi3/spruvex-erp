import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import { rateLimitAuth } from "../../../core/middleware/rateLimit.middleware";
import { AppError } from "../../../core/errors/AppError";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import { uuidParamSchema } from "../../../shared/validators/common.validators";
import { PERMISSIONS } from "@workspace/db";
import {
  registerCompanySchema,
  requestOtpSchema,
  checkOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  loginSchema,
  refreshSchema,
  createInviteSchema,
  acceptInviteSchema,
} from "../validators/auth.validators";
import * as authService from "../services/authService";
import * as inviteService from "../services/inviteService";
import { requestRegistrationOtp, checkRegistrationOtp } from "../services/otpService";

const router: IRouter = Router();

router.post("/register-company/request-otp", rateLimitAuth, async (req, res, next) => {
  try {
    const { email } = requestOtpSchema.parse(req.body);
    await requestRegistrationOtp(email);
    res.status(200).json(buildSuccess({ sent: true }));
  } catch (err) {
    next(err);
  }
});

// Non-consuming peek used by the signup wizard right after the merchant
// types the code (step 2), so a wrong/expired code is caught immediately
// instead of only at final submit after business type + plan are also
// picked. The real, consuming check still happens in registerCompany below.
router.post("/register-company/check-otp", rateLimitAuth, async (req, res, next) => {
  try {
    const { email, otp } = checkOtpSchema.parse(req.body);
    await checkRegistrationOtp(email, otp);
    res.status(200).json(buildSuccess({ valid: true }));
  } catch (err) {
    next(err);
  }
});

router.post("/register-company", rateLimitAuth, async (req, res, next) => {
  try {
    const input = registerCompanySchema.parse(req.body);
    const result = await authService.registerCompany(input);
    res.status(201).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

router.post("/forgot-password", rateLimitAuth, async (req, res, next) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    await authService.forgotPassword(email);
    res.status(200).json(buildSuccess({ sent: true }));
  } catch (err) {
    next(err);
  }
});

router.post("/reset-password", rateLimitAuth, async (req, res, next) => {
  try {
    const input = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(input);
    res.status(200).json(buildSuccess({ reset: true }));
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

// Staff invite flow — no "invite" concept existed anywhere in the product
// before this: admins could only create a teammate by typing a
// username/password for them directly (still supported, unchanged, at the
// legacy /api/auth/users endpoints). This adds the email-invite alternative
// used by every mainstream ERP/POS competitor (Foodics/Zid/Odoo): the
// employee picks their own username/password when accepting.
router.post(
  "/invites",
  requireAuth, enforceTenantIsolation, requirePermission(PERMISSIONS.USERS_MANAGE),
  async (req, res, next) => {
    try {
      if (!req.tenant) throw AppError.unauthorized();
      const input = createInviteSchema.parse(req.body);
      const invite = await inviteService.createInvite(req.tenant, input);
      res.status(201).json(buildSuccess(invite));
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/invites",
  requireAuth, enforceTenantIsolation, requirePermission(PERMISSIONS.USERS_MANAGE),
  async (req, res, next) => {
    try {
      if (!req.tenant) throw AppError.unauthorized();
      const invites = await inviteService.listInvites(req.tenant.companyId);
      res.status(200).json(buildSuccess(invites));
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/invites/:id",
  requireAuth, enforceTenantIsolation, requirePermission(PERMISSIONS.USERS_MANAGE),
  async (req, res, next) => {
    try {
      if (!req.tenant) throw AppError.unauthorized();
      const id = uuidParamSchema.parse(req.params.id);
      await inviteService.revokeInvite(req.tenant.companyId, id);
      res.status(200).json(buildSuccess({ success: true }));
    } catch (err) {
      next(err);
    }
  },
);

// Public — the recipient isn't authenticated yet (that's the whole point of
// an accept-invite link), so these two intentionally carry no auth
// middleware. The token itself (unguessable, single-purpose, short-lived)
// is the credential.
router.get("/invites/:token/info", rateLimitAuth, async (req, res, next) => {
  try {
    const info = await inviteService.getInviteInfo(req.params.token as string);
    res.status(200).json(buildSuccess(info));
  } catch (err) {
    next(err);
  }
});

router.post("/invites/:token/accept", rateLimitAuth, async (req, res, next) => {
  try {
    const { username, password } = acceptInviteSchema.omit({ token: true }).parse(req.body);
    const result = await inviteService.acceptInvite({ token: req.params.token as string, username, password });
    res.status(201).json(buildSuccess(result));
  } catch (err) {
    next(err);
  }
});

export default router;
