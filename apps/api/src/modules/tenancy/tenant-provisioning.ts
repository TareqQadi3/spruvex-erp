import { PrismaClient } from "@prisma/client";

import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  ROLE_LABELS,
  SYSTEM_ROLES,
} from "@spruvex-r/types";

import { hashPassword } from "../identity/password";

/**
 * Tenant provisioning — creates a tenant with its default branch, the five
 * system roles wired to the default permission sets, and the owner account.
 *
 * Runs on an ADMIN (BYPASSRLS) connection because a tenant cannot be created
 * from inside a tenant context. Used by the seed today and by the Phase 1
 * onboarding flow.
 */

export interface ProvisionTenantInput {
  name: string;
  nameEn?: string;
  slug: string;
  vatNumber?: string;
  crNumber?: string;
  branch?: { name?: string; nameEn?: string; slug?: string };
  owner: { name: string; email: string; phone?: string; password: string };
}

export interface ProvisionedTenant {
  tenantId: string;
  branchId: string;
  ownerUserId: string;
  roleIdsByKey: Record<string, string>;
}

/** Upserts the global permission catalog from @spruvex-r/types. Idempotent. */
export async function syncPermissionCatalog(db: PrismaClient): Promise<void> {
  for (const key of ALL_PERMISSION_KEYS) {
    await db.permission.upsert({
      where: { key },
      update: { description: PERMISSIONS[key] },
      create: { key, description: PERMISSIONS[key] },
    });
  }
}

export async function provisionTenant(
  db: PrismaClient,
  input: ProvisionTenantInput,
): Promise<ProvisionedTenant> {
  const passwordHash = await hashPassword(input.owner.password);

  return db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.name,
        nameEn: input.nameEn,
        slug: input.slug,
        vatNumber: input.vatNumber,
        crNumber: input.crNumber,
      },
    });

    const branch = await tx.branch.create({
      data: {
        tenantId: tenant.id,
        name: input.branch?.name ?? "الفرع الرئيسي",
        nameEn: input.branch?.nameEn ?? "Main Branch",
        slug: input.branch?.slug ?? "main",
      },
    });

    const permissions = await tx.permission.findMany();
    const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]));

    const roleIdsByKey: Record<string, string> = {};
    for (const roleKey of SYSTEM_ROLES) {
      const role = await tx.role.create({
        data: {
          tenantId: tenant.id,
          key: roleKey,
          nameAr: ROLE_LABELS[roleKey].ar,
          nameEn: ROLE_LABELS[roleKey].en,
          isSystem: true,
        },
      });
      roleIdsByKey[roleKey] = role.id;

      await tx.rolePermission.createMany({
        data: DEFAULT_ROLE_PERMISSIONS[roleKey].map((permissionKey) => {
          const permissionId = permissionIdByKey.get(permissionKey);
          if (!permissionId) {
            throw new Error(
              `Permission catalog out of sync — missing key: ${permissionKey}`,
            );
          }
          return { tenantId: tenant.id, roleId: role.id, permissionId };
        }),
      });
    }

    const owner = await tx.user.create({
      data: {
        email: input.owner.email,
        phone: input.owner.phone,
        name: input.owner.name,
        passwordHash,
      },
    });

    await tx.userRole.create({
      data: {
        tenantId: tenant.id,
        userId: owner.id,
        roleId: roleIdsByKey.owner,
        branchId: null, // tenant-wide
      },
    });

    return {
      tenantId: tenant.id,
      branchId: branch.id,
      ownerUserId: owner.id,
      roleIdsByKey,
    };
  });
}
