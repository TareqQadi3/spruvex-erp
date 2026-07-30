import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";

// Short-lived email verification codes for the signup flow (register-company
// request-otp -> register-company). One row per email; a new request
// overwrites the previous code rather than accumulating rows.
export const registrationOtpsTable = pgTable("registration_otps", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type RegistrationOtp = typeof registrationOtpsTable.$inferSelect;
