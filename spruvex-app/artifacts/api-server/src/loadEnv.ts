import { existsSync } from "node:fs";
import path from "node:path";

// Loads the workspace-root .env into process.env before anything else in
// this package runs. Walks up from wherever this module physically executes
// from (src/ in dev, or dist/ once esbuild bundles it) until it finds
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

const envPath = path.join(findWorkspaceRoot(import.meta.dirname), ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
