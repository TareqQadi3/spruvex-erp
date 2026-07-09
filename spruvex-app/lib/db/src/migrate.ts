import "./loadEnv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

// fileURLToPath (not new URL(...).pathname) — pathname keeps a leading slash
// in front of Windows drive letters (e.g. "/C:/Users/...") that breaks
// fs.existsSync; fileURLToPath normalizes for the current platform.
const migrationsFolder = path.join(fileURLToPath(new URL(".", import.meta.url)), "../drizzle");

// Non-interactive migration runner for CI/CD and container startup — this is
// the "safe deploy" path, replacing `drizzle-kit push` (which requires an
// interactive TTY to resolve rename ambiguity and must never run in
// production). Applies only migrations newer than what's already recorded in
// drizzle.__drizzle_migrations; safe to run on every deploy, including when
// there is nothing new to apply.
async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set to run migrations.");
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("Running database migrations...");
  await migrate(db, { migrationsFolder });
  console.log("Migrations complete.");

  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
