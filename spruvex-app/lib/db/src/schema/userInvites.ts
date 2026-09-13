import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";

// One row per (companyId, email) — a repeat invite to the same address
// overwrites the previous row (new token/expiry) instead of accumulating
// rows, same convention as registration_otps. tokenHash is sha256 (not
// bcrypt): the raw token from the accept-invite link IS the lookup key, so
// it needs a deterministic, indexable hash rather than a salted one.
export const userInvitesTable = pgTable(
  "user_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    status: text("status").notNull().default("pending"), // pending | accepted | revoked
    invitedByUserId: uuid("invited_by_user_id").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.companyId, table.email)],
);

export type UserInvite = typeof userInvitesTable.$inferSelect;
