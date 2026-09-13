import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { and, desc, eq } from "drizzle-orm";
import { userInvitesTable, companiesTable } from "@workspace/db";
import { db } from "../../../core/database/connection";
import { withTransaction } from "../../../core/database/transaction";
import { AppError } from "../../../core/errors/AppError";
import { logger } from "../../../core/logging/logger";
import { recordAuditEvent } from "../../../core/logging/auditLogger";
import { sendEmail } from "../../../core/email/resendService";
import { staffInviteEmail } from "../../../core/email/templates";
import { getEffectiveState, countCurrentUsersForCompany } from "../../subscriptions/services/planLimitsService";
import { UserAuthRepository } from "../repositories/userAuthRepository";
import { buildTenantContext, toAuthResult, dashboardUrl, BCRYPT_ROUNDS } from "./authService";
import type { TenantContext } from "../../../shared/types/tenantContext";
import type { AuthResult } from "../types/auth.types";

const INVITE_TTL_DAYS = 7;
const repo = new UserAuthRepository();

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface InviteSummary {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

export async function createInvite(
  tenant: TenantContext,
  input: { email: string; role: string },
): Promise<InviteSummary> {
  const email = input.email.trim().toLowerCase();

  const state = await getEffectiveState(tenant.companyId);
  if (["expired", "suspended", "cancelled"].includes(state.status)) {
    throw AppError.forbidden("Subscription inactive");
  }
  const maxUsers = state.effectiveLimits.maxUsers;
  if (typeof maxUsers === "number") {
    const current = await countCurrentUsersForCompany(tenant.companyId);
    if (current >= maxUsers) throw AppError.forbidden("Plan limit reached: maxUsers");
  }

  const existingUser = await repo.findUserByEmail(email);
  if (existingUser) throw AppError.conflict("An account with this email already exists");

  const [company] = await db.select({ name: companiesTable.name }).from(companiesTable)
    .where(eq(companiesTable.id, tenant.companyId)).limit(1);
  if (!company) throw AppError.internal("Company not found");

  const inviter = await repo.findUserById(tenant.userId);

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const [invite] = await db
    .insert(userInvitesTable)
    .values({
      companyId: tenant.companyId, email, role: input.role, tokenHash,
      status: "pending", invitedByUserId: tenant.userId, expiresAt,
    })
    .onConflictDoUpdate({
      target: [userInvitesTable.companyId, userInvitesTable.email],
      set: { role: input.role, tokenHash, status: "pending", invitedByUserId: tenant.userId, expiresAt, acceptedAt: null, createdAt: new Date() },
    })
    .returning();

  recordAuditEvent(tenant, { action: "invite_user", entityType: "user_invite", entityId: invite.id, details: { email, role: input.role } });

  const acceptUrl = `${dashboardUrl()}/accept-invite/${token}`;
  if (!process.env.RESEND_API_KEY) {
    logger.warn({ email }, `[DEV] Invite accept link for ${email}: ${acceptUrl}`);
  }
  const { subject, html } = staffInviteEmail(company.name, input.role, inviter?.username ?? "Admin", acceptUrl);
  await sendEmail(email, subject, html);

  return {
    id: invite.id, email: invite.email, role: invite.role, status: invite.status,
    expiresAt: invite.expiresAt, acceptedAt: invite.acceptedAt, createdAt: invite.createdAt,
  };
}

export async function listInvites(companyId: string): Promise<InviteSummary[]> {
  const rows = await db.select().from(userInvitesTable)
    .where(eq(userInvitesTable.companyId, companyId))
    .orderBy(desc(userInvitesTable.createdAt));
  return rows.map((r) => ({
    id: r.id, email: r.email, role: r.role, status: r.status,
    expiresAt: r.expiresAt, acceptedAt: r.acceptedAt, createdAt: r.createdAt,
  }));
}

export async function revokeInvite(companyId: string, inviteId: string): Promise<void> {
  const [updated] = await db
    .update(userInvitesTable)
    .set({ status: "revoked" })
    .where(and(eq(userInvitesTable.id, inviteId), eq(userInvitesTable.companyId, companyId), eq(userInvitesTable.status, "pending")))
    .returning({ id: userInvitesTable.id });
  if (!updated) throw AppError.notFound("Pending invite not found");
}

export interface InviteInfo {
  companyName: string;
  email: string;
  role: string;
}

export async function getInviteInfo(token: string): Promise<InviteInfo> {
  const tokenHash = hashToken(token);
  const [invite] = await db.select().from(userInvitesTable).where(eq(userInvitesTable.tokenHash, tokenHash)).limit(1);
  if (!invite || invite.status !== "pending") throw AppError.notFound("Invite not found or already used");
  if (invite.expiresAt.getTime() < Date.now()) throw AppError.validation("This invite has expired — ask an admin to send a new one");

  const [company] = await db.select({ name: companiesTable.name }).from(companiesTable)
    .where(eq(companiesTable.id, invite.companyId)).limit(1);

  return { companyName: company?.name ?? "", email: invite.email, role: invite.role };
}

export async function acceptInvite(
  input: { token: string; username: string; password: string },
): Promise<AuthResult> {
  const tokenHash = hashToken(input.token);
  const [invite] = await db.select().from(userInvitesTable).where(eq(userInvitesTable.tokenHash, tokenHash)).limit(1);
  if (!invite || invite.status !== "pending") throw AppError.notFound("Invite not found or already used");
  if (invite.expiresAt.getTime() < Date.now()) throw AppError.validation("This invite has expired — ask an admin to send a new one");

  const [existingUsername, existingEmail] = await Promise.all([
    repo.findUserByUsername(input.username),
    repo.findUserByEmail(invite.email),
  ]);
  if (existingUsername) throw AppError.conflict("Username is already taken");
  if (existingEmail) throw AppError.conflict("An account with this email already exists");

  // Re-checked at accept time (not just at invite-creation) — seats can fill
  // up in the days between an invite being sent and accepted.
  const state = await getEffectiveState(invite.companyId);
  if (["expired", "suspended", "cancelled"].includes(state.status)) {
    throw AppError.forbidden("Subscription inactive");
  }
  const maxUsers = state.effectiveLimits.maxUsers;
  if (typeof maxUsers === "number") {
    const current = await countCurrentUsersForCompany(invite.companyId);
    if (current >= maxUsers) throw AppError.forbidden("Plan limit reached: maxUsers");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  return withTransaction(async (tx) => {
    const user = await repo.createUser(
      { companyId: invite.companyId, username: input.username, email: invite.email, passwordHash, role: invite.role },
      tx,
    );

    const role = await repo.findGlobalRoleByName(invite.role, tx);
    if (!role) throw AppError.internal(`Role '${invite.role}' is not seeded`);
    await repo.assignUserRole({ companyId: invite.companyId, userId: user.id, roleId: role.id }, tx);

    await tx.update(userInvitesTable).set({ status: "accepted", acceptedAt: new Date() })
      .where(eq(userInvitesTable.id, invite.id));

    const tenant = await buildTenantContext(invite.companyId, user.id, tx);
    recordAuditEvent(tenant, { action: "accept_invite", entityType: "user", entityId: user.id });
    return toAuthResult(user, tenant, tx);
  });
}
