import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Admin (BYPASSRLS) connection for the narrow set of operations that cannot
 * run inside a tenant context:
 *
 * - Identity bootstrap: global tables (users, refresh_tokens, otp_codes) and
 *   reading a user's memberships/permissions at login, BEFORE a tenant is known.
 * - Tenant provisioning: creating the tenant row itself during onboarding.
 * - Platform super-admin module (later phase).
 *
 * RULE: business modules must NEVER inject this service — all tenant data
 * access goes through PrismaService.scoped (RLS enforced). Any new usage of
 * this class needs the same scrutiny as a raw SQL query.
 */
@Injectable()
export class PlatformPrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({ datasourceUrl: process.env.ADMIN_DATABASE_URL });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
