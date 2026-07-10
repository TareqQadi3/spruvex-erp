# syntax=docker/dockerfile:1
#
# Multi-stage build for @workspace/api-server. Two runtime targets share this
# same image (see docker-compose.yml): `api` runs dist/index.mjs (the HTTP
# server), `worker` runs dist/worker.mjs (background jobs) — same build, two
# different CMDs, so there is exactly one image to build/scan/patch.
#
# Build from the MONOREPO ROOT (spruvex-app/), not this directory, since the
# workspace needs lib/db and lib/api-zod alongside api-server:
#   docker build -f artifacts/api-server/Dockerfile -t spruvex-api:latest .

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /workspace

# --- deps: install once, cached as long as lockfile/package.json don't change ---
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY artifacts/api-server/package.json ./artifacts/api-server/package.json
COPY lib ./lib
COPY scripts ./scripts
# --frozen-lockfile: never silently resolve a different dependency tree than
# what's committed — a production build must fail loudly on lockfile drift,
# not paper over it.
RUN pnpm install --frozen-lockfile

# --- build: bundle to a handful of self-contained .mjs files via esbuild ---
FROM deps AS build
COPY artifacts/api-server ./artifacts/api-server
RUN pnpm --filter @workspace/api-server run build

# --- runtime: slim image, non-root, only the bundled output + prod deps ---
FROM node:22-slim AS runtime
RUN corepack enable
WORKDIR /app

# A handful of pino transport workers spawn their own worker_threads context
# that re-resolves modules from disk rather than the parent's bundled memory
# — keep a real (production-only) node_modules for api-server so those
# workers never fail to resolve at runtime, even though the bulk of the app
# is already bundled by esbuild into dist/.
COPY --from=deps /workspace/pnpm-workspace.yaml /workspace/pnpm-lock.yaml /workspace/package.json ./
COPY --from=deps /workspace/artifacts/api-server/package.json ./artifacts/api-server/package.json
RUN pnpm install --prod --frozen-lockfile --filter @workspace/api-server

COPY --from=build /workspace/artifacts/api-server/dist ./artifacts/api-server/dist

RUN groupadd --system spruvex && useradd --system --gid spruvex --create-home spruvex
USER spruvex

ENV NODE_ENV=production
WORKDIR /app/artifacts/api-server
EXPOSE 5000

# Liveness only (see routes/health.ts) — a slow/failing DB should not make
# Docker restart an otherwise-healthy process; that's what /readyz (checked
# by the reverse proxy / orchestrator's readiness probe, not this) is for.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
