import "./src/loadEnv";
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

// Relative paths (resolved by drizzle-kit against this config file's directory) —
// pre-resolving to an absolute path here used to double-join with cwd on Windows
// (drizzle-kit bug), producing an invalid path and an ENOENT when reading snapshots.
export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
