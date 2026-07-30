import { Router } from "express";
import type { AuthedRequest } from "../lib/auth-middleware";
import { listAuditLogs } from "../modules/auditLog/auditLogService";

const router = Router();

router.get("/", async (req: AuthedRequest, res) => {
  const { userId, action, entityType, from, to, page, pageSize } = req.query;
  const result = await listAuditLogs(req.user!.companyId, {
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
