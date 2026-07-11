import { PrismaClient } from "@prisma/client";

import {
  ALL_PERMISSION_KEYS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  ROLE_LABELS,
  SYSTEM_ROLES,
} from "@spruvex-r/types";

/**
 * Tenant provisioning — creates a tenant, the five system roles wired to the
 * default permission sets, the owner membership, and (optionally) a first
 * branch. The owner user account must already exist (created at registration).
 *
 * Runs on an ADMIN (BYPASSRLS) connection because a tenant cannot be created
 * from inside a tenant context. Used by the onboarding wizard and the seed.
 */

export interface ProvisionTenantInput {
  name: string;
  nameEn?: string;
  slug: string;
  type?: string;
  country?: string;
  currency?: string;
  defaultLocale?: string;
  logoUrl?: string;
  vatNumber?: string;
  crNumber?: string;
  /** Omit to create the tenant without a branch (wizard creates it in step 3). */
  branch?: { name?: string; nameEn?: string; slug?: string };
  ownerUserId: string;
}

export interface ProvisionedTenant {
  tenantId: string;
  branchId?: string;
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
  return db.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: input.name,
        nameEn: input.nameEn,
        slug: input.slug,
        type: input.type,
        country: input.country ?? "SA",
        currency: input.currency ?? "SAR",
        defaultLocale: input.defaultLocale ?? "ar",
        logoUrl: input.logoUrl,
        vatNumber: input.vatNumber,
        crNumber: input.crNumber,
        createdBy: input.ownerUserId,
      },
    });

    let branchId: string | undefined;
    if (input.branch) {
      const branch = await tx.branch.create({
        data: {
          tenantId: tenant.id,
          name: input.branch.name ?? "الفرع الرئيسي",
          nameEn: input.branch.nameEn ?? "Main Branch",
          slug: input.branch.slug ?? "main",
          createdBy: input.ownerUserId,
        },
      });
      branchId = branch.id;
    }

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
          createdBy: input.ownerUserId,
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

    await tx.userRole.create({
      data: {
        tenantId: tenant.id,
        userId: input.ownerUserId,
        roleId: roleIdsByKey.owner,
        branchId: null, // tenant-wide
        createdBy: input.ownerUserId,
      },
    });

    return {
      tenantId: tenant.id,
      branchId,
      ownerUserId: input.ownerUserId,
      roleIdsByKey,
    };
  });
}
