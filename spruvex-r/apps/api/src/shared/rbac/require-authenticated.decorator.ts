import { SetMetadata } from "@nestjs/common";

export const REQUIRE_AUTH_KEY = "spruvex:requireAuthenticated";

/**
 * Marks an endpoint that needs a logged-in user but no tenant permission.
 * Used ONLY for the pre-tenant slice of onboarding (a fresh owner has no
 * roles yet) and for `/auth/me`. Everything else uses @RequirePermission().
 */
export const RequireAuthenticated = () => SetMetadata(REQUIRE_AUTH_KEY, true);
