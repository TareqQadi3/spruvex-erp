import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../../src/modules/identity/password";
import {
  provisionTenant,
  type ProvisionedTenant,
} from "../../src/modules/tenancy/tenant-provisioning";

/** Creates a verified owner user + fully provisioned tenant with one branch. */
export async function provisionTestTenant(
  admin: PrismaClient,
  input: { name: string; slug: string; ownerEmail: string; password?: string },
): Promise<ProvisionedTenant & { ownerEmail: string }> {
  const owner = await admin.user.create({
    data: {
      email: input.ownerEmail,
      name: `Owner of ${input.slug}`,
      passwordHash: await hashPassword(input.password ?? "Test-12345"),
      emailVerifiedAt: new Date(),
    },
  });
  const provisioned = await provisionTenant(admin, {
    name: input.name,
    slug: input.slug,
    branch: {},
    ownerUserId: owner.id,
  });
  return { ...provisioned, ownerEmail: input.ownerEmail };
}
