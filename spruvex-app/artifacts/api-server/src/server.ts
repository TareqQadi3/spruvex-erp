import app from "./app";
import { env } from "./config/env";
import { logger } from "./core/logging/logger";
import { checkDatabaseConnection, closeDatabaseConnection } from "./core/database/connection";
import { ensureGlobalRbacSeeded } from "./modules/rbac/services/rbacSeedService";

export async function startServer(): Promise<void> {
  await checkDatabaseConnection();
  await ensureGlobalRbacSeeded();

  const server = app.listen(env.port, () => {
    logger.info({ port: env.port }, "Server listening");
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Shutting down");
    server.close(async () => {
      await closeDatabaseConnection();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}
