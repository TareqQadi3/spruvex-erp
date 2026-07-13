# Production image for the SpruVex R API (NestJS modular monolith).
#
# Build from the REPO ROOT (needs the pnpm workspace context to resolve
# @spruvex-r/types):
#   docker build -f apps/api/Dockerfile -t spruvex-r-api .
#
# NOTE: this Dockerfile follows standard pnpm-workspace multi-stage
# conventions but has not been build-verified in this sandbox (no Docker
# daemon available here) — run a real `docker build` in CI before relying
# on it for a production deploy. See docs/DEPLOYMENT.md.

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

# ---- install every workspace dependency (dev deps included — needed to build) ----
FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

# ---- build the shared types package, generate the Prisma client, build the API ----
FROM deps AS build
COPY packages/types packages/types
COPY packages/config packages/config
COPY apps/api apps/api
RUN pnpm --filter @spruvex-r/types build
RUN pnpm --filter @spruvex-r/api prisma:generate
RUN pnpm --filter @spruvex-r/api build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 spruvex \
  && useradd --system --uid 1001 --gid spruvex spruvex

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages/types ./packages/types
COPY --from=build /repo/apps/api ./apps/api

USER spruvex
WORKDIR /repo/apps/api
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
