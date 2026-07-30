import app from "./app";
import { env } from "./config/env";
import { logger } from "./core/logging/logger";
import { checkDatabaseConnection, closeDatabaseConnection } from "./core/database/connection";
import { ensureGlobalRbacSeeded } from "./modules/rbac/services/rbacSeedService";

export async function startServer(): Promise<void> {
  await checkDatabaseConnection();
  await ensureGlobalRbacSeeded();

  // Bind to "::" (dual-stack) rather than the default -- some hosts
  // (Fly.io) route external traffic over IPv4 but internal
  // machine-to-machine traffic exclusively over IPv6; binding to
  // IPv4-only leaves that internal path unreachable ("connection
  // refused" from sibling services) even though the public URL works.
  const server = app.listen(env.port, "::", () => {
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
