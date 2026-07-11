import { Injectable, UnauthorizedException } from "@nestjs/common";
import { AsyncLocalStorage } from "node:async_hooks";

import type { PermissionKey } from "@spruvex-r/types";

/**
 * Per-request context, resolved from the JWT (never from client parameters).
 * Populated by the auth layer (Phase 1); tests populate it via `run()`.
 */
export interface RequestContext {
  tenantId: string;
  userId?: string;
  branchId?: string;
  permissions: ReadonlySet<PermissionKey | string>;
}

@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<RequestContext>();

  /** Runs `fn` with the given context — the entry point for the auth middleware and tests. */
  run<T>(context: RequestContext, fn: () => T): T {
    return this.als.run(context, fn);
  }

  get context(): RequestContext | undefined {
    return this.als.getStore();
  }

  get contextOrThrow(): RequestContext {
    const ctx = this.context;
    if (!ctx) {
      throw new UnauthorizedException("No tenant context — request is not authenticated");
    }
    return ctx;
  }

  get tenantIdOrThrow(): string {
    return this.contextOrThrow.tenantId;
  }
}
