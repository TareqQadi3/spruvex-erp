# Production image for the customer ordering app (Next.js SSR).
#
# Build from the REPO ROOT:
#   docker build -f apps/ordering/Dockerfile -t spruvex-r-ordering .
#
# NOTE: not build-verified in this sandbox (no Docker daemon here) — validate
# with a real `docker build` in CI before a production deploy.

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/ordering/package.json apps/ordering/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
# PUBLIC_API_ORIGIN (the order-tracking socket's target) is read server-side
# at request time (see app/order/[orderId]/page.tsx), not inlined at build
# time — no build ARG needed, this image is configured purely via runtime
# environment variables and deploys identically on any container platform.
COPY packages/ui packages/ui
COPY packages/types packages/types
COPY packages/config packages/config
COPY apps/ordering apps/ordering
RUN pnpm --filter @spruvex-r/types build
RUN pnpm --filter @spruvex-r/ui build
RUN pnpm --filter @spruvex-r/ordering build

FROM base AS runtime
ENV NODE_ENV=production
RUN groupadd --system --gid 1001 spruvex \
  && useradd --system --uid 1001 --gid spruvex spruvex

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/ordering ./apps/ordering

USER spruvex
WORKDIR /repo/apps/ordering
EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:3002/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node_modules/.bin/next", "start", "-p", "3002"]
