import type { TenantContext } from "../types/tenantContext";

// Business-module services extend this so every service method has the
// requesting tenant's identity available without threading it through
// every function signature by hand.
export abstract class BaseService {
  protected constructor(protected readonly tenant: TenantContext) {}
}
