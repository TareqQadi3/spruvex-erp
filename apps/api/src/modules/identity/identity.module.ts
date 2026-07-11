import { Module } from "@nestjs/common";

/**
 * Identity module — auth (JWT access+refresh), users, roles, permissions, PIN.
 * Phase 0 ships the password/PIN primitives and the RBAC data model;
 * authentication flows land in Phase 1.
 */
@Module({})
export class IdentityModule {}
