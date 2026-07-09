import { existsSync } from "node:fs";
import path from "node:path";

// Loads the workspace-root .env into process.env before anything else in
// this package runs. Walks up from wherever this module physically executes
// from (package src/ in dev via tsx, or a bundler's dist/ output when
// bundled into a consumer like @workspace/api-server) until it finds
// pnpm-workspace.yaml, so it works regardless of cwd or bundling depth.
// Values already present in process.env (e.g. real deployment secrets) are
// never overwritten — see Node's process.loadEnvFile semantics.
function findWorkspaceRoot(startDir: string): string {
  let dir = startDir;
  for (;;) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not locate workspace root (pnpm-workspace.yaml) above ${startDir}`);
    }
    dir = parent;
  }
}

// import.meta.dirname is unavailable when this module is bundled to CJS
// (e.g. drizzle-kit bundling drizzle.config.ts with esbuild before running
// it) — fall back to CJS __dirname, which is defined in that situation.
const currentDir = import.meta.dirname ?? (typeof __dirname !== "undefined" ? __dirname : undefined);
if (!currentDir) {
  throw new Error("Could not determine current directory to load .env from.");
}
const envPath = path.join(findWorkspaceRoot(currentDir), ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
