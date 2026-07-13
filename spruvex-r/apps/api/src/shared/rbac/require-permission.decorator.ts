import { SetMetadata } from "@nestjs/common";

import type { PermissionKey } from "@spruvex-r/types";

export const PERMISSIONS_KEY = "spruvex:permissions";

/**
 * Declares the permission(s) an endpoint requires. Every non-public endpoint
 * MUST carry this decorator — the global PermissionsGuard denies endpoints
 * with no explicit declaration (no implicit trust).
 */
export const RequirePermission = (...permissions: [PermissionKey, ...PermissionKey[]]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
