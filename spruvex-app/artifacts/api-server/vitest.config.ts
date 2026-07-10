import { defineConfig } from "vitest/config";

// Two projects, run separately:
// - "unit": pure functions only, zero DB/network dependency — safe to run
//   anywhere, anytime, no setup required. This is what `pnpm test` runs.
// - "integration": exercises real service functions against the actual
//   configured DATABASE_URL (each test creates and cleans up its own
//   throwaway company, same pattern as this project's live curl
//   verification passes) — opt-in via `pnpm run test:integration`, needs a
//   real database connection.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/**/*.unit.test.ts"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["src/**/*.integration.test.ts"],
          testTimeout: 30000,
        },
      },
    ],
  },
});
