import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { PermissionsGuard } from "../../src/shared/rbac/permissions.guard";
import { Public } from "../../src/shared/rbac/public.decorator";
import { RequirePermission } from "../../src/shared/rbac/require-permission.decorator";
import {
  TenantContextService,
  type RequestContext,
} from "../../src/shared/tenancy/tenant-context.service";

class FixtureController {
  @Public()
  publicEndpoint() {}

  @RequirePermission("orders.void")
  voidOrder() {}

  @RequirePermission("orders.view", "reports.view")
  salesReport() {}

  undeclaredEndpoint() {}
}

function executionContextFor(methodName: keyof FixtureController): ExecutionContext {
  return {
    getHandler: () => FixtureController.prototype[methodName],
    getClass: () => FixtureController,
  } as unknown as ExecutionContext;
}

describe("PermissionsGuard", () => {
  const reflector = new Reflector();
  const tenantContext = new TenantContextService();
  const guard = new PermissionsGuard(reflector, tenantContext);

  const runAs = (permissions: string[], fn: () => void) => {
    const ctx: RequestContext = {
      tenantId: "11111111-1111-4111-8111-111111111111",
      userId: "22222222-2222-4222-8222-222222222222",
      permissions: new Set(permissions),
    };
    tenantContext.run(ctx, fn);
  };

  it("allows @Public endpoints without any context", () => {
    expect(guard.canActivate(executionContextFor("publicEndpoint"))).toBe(true);
  });

  it("denies endpoints with no @RequirePermission declaration (no implicit trust)", () => {
    runAs(["orders.void"], () => {
      expect(() => guard.canActivate(executionContextFor("undeclaredEndpoint"))).toThrow(
        ForbiddenException,
      );
    });
  });

  it("rejects unauthenticated requests to protected endpoints", () => {
    expect(() => guard.canActivate(executionContextFor("voidOrder"))).toThrow(
      UnauthorizedException,
    );
  });

  it("denies when the permission is missing", () => {
    runAs(["orders.view"], () => {
      expect(() => guard.canActivate(executionContextFor("voidOrder"))).toThrow(
        ForbiddenException,
      );
    });
  });

  it("allows when all required permissions are held", () => {
    runAs(["orders.void"], () => {
      expect(guard.canActivate(executionContextFor("voidOrder"))).toBe(true);
    });
    runAs(["orders.view", "reports.view"], () => {
      expect(guard.canActivate(executionContextFor("salesReport"))).toBe(true);
    });
  });

  it("requires ALL permissions when several are declared", () => {
    runAs(["orders.view"], () => {
      expect(() => guard.canActivate(executionContextFor("salesReport"))).toThrow(
        ForbiddenException,
      );
    });
  });
});
