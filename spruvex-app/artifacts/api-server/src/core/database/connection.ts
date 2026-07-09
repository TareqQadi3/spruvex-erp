import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../logging/logger";

export { db, pool };

export async function checkDatabaseConnection(): Promise<void> {
  await db.execute(sql`select 1`);
}

export async function closeDatabaseConnection(): Promise<void> {
  await pool.end();
  logger.info("Database pool closed");
}
