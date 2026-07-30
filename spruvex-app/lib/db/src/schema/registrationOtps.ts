import { pgTable, uuid, text, timestamp, integer, unique } from "drizzle-orm/pg-core";

// Short-lived email verification codes for the signup flow (register-company
// request-otp -> register-company) and for password reset. One row per
// (email, purpose); a new request overwrites the previous code for that
// purpose rather than accumulating rows.
export const registrationOtpsTable = pgTable(
  "registration_otps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    purpose: text("purpose").notNull().default("registration"), // registration | password_reset
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique().on(table.email, table.purpose)],
);

export type RegistrationOtp = typeof registrationOtpsTable.$inferSelect;
