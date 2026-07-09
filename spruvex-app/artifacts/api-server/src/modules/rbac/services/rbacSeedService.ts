import { eq, isNull, and } from "drizzle-orm";
import { permissionsTable, rolesTable, rolePermissionsTable, PERMISSIONS, DEFAULT_ROLES } from "@workspace/db";
import { db } from "../../../core/database/connection";
import { withTransaction } from "../../../core/database/transaction";
import { logger } from "../../../core/logging/logger";

// Seeds the global (company_id IS NULL) permission catalog and default role
// templates exactly once. Idempotent — safe to call on every server start.
export async function ensureGlobalRbacSeeded(): Promise<void> {
  await withTransaction(async (tx) => {
    const permissionCodeToId = new Map<string, string>();

    for (const [, code] of Object.entries(PERMISSIONS)) {
      const [existing] = await tx
        .select()
        .from(permissionsTable)
        .where(and(eq(permissionsTable.code, code), isNull(permissionsTable.companyId)))
        .limit(1);

      if (existing) {
        permissionCodeToId.set(code, existing.id);
        continue;
      }

      const [created] = await tx
        .insert(permissionsTable)
        .values({ code, module: code.split("_")[0] ?? "general", companyId: null })
        .returning();
      permissionCodeToId.set(code, created.id);
    }

    for (const defaultRole of DEFAULT_ROLES) {
      const [existingRole] = await tx
        .select()
        .from(rolesTable)
        .where(and(eq(rolesTable.name, defaultRole.name), isNull(rolesTable.companyId)))
        .limit(1);

      const role =
        existingRole ??
        (
          await tx
            .insert(rolesTable)
            .values({
              name: defaultRole.name,
              displayName: defaultRole.displayName,
              isSystem: true,
              companyId: null,
            })
            .returning()
        )[0];

      for (const code of defaultRole.permissions) {
        const permissionId = permissionCodeToId.get(code);
        if (!permissionId) continue;
        await tx
          .insert(rolePermissionsTable)
          .values({ roleId: role.id, permissionId, companyId: null })
          .onConflictDoNothing();
      }
    }
  });

  logger.info("Global RBAC catalog (permissions + default roles) verified/seeded");
}
