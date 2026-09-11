import { Router, type IRouter } from "express";
import { PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import { listAuditLogs } from "../auditLogService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription(), requirePermission(PERMISSIONS.AUDIT_VIEW));

router.get("/", async (req, res) => {
  const { userId, action, entityType, from, to, page, pageSize } = req.query;
  const result = await listAuditLogs(req.tenant!.companyId, {
    userId: typeof userId === "string" ? userId : undefined,
    action: typeof action === "string" ? action : undefined,
    entityType: typeof entityType === "string" ? entityType : undefined,
    from: typeof from === "string" ? from : undefined,
    to: typeof to === "string" ? to : undefined,
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
  });
  res.json(result);
});

export default router;
