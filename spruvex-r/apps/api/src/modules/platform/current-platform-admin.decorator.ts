import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import type { PlatformRequest } from "./platform-admin.guard";

/** The authenticated platform admin, attached by PlatformAdminGuard. */
export const CurrentPlatformAdmin = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest<PlatformRequest>().platformAdmin;
});
