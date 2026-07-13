import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "spruvex:isPublic";

/**
 * Marks an endpoint as public (no auth / no permission required).
 * Guest endpoints (digital menu, QR ordering) still get rate limiting
 * and table-code validation — @Public only skips RBAC.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
