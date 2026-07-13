import { execSync } from "node:child_process";
import * as path from "node:path";

import { applyTestEnvDefaults } from "./env-defaults";

/**
 * Applies migrations to the test database once before the test run.
 */
export default function globalSetup(): void {
  applyTestEnvDefaults();
  execSync("pnpm prisma migrate deploy", {
    cwd: path.resolve(__dirname, ".."),
    stdio: "inherit",
    env: process.env,
  });
}
