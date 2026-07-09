import "./loadEnv";
import { startServer } from "./server";
import { logger } from "./core/logging/logger";

startServer().catch((err) => {
  logger.error({ err }, "Failed to start server");
  process.exit(1);
});
