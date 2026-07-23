# syntax=docker/dockerfile:1
#
# Static build served by nginx. Build from the MONOREPO ROOT (spruvex-app/):
#   docker build -f artifacts/pos-system/Dockerfile \
#     --build-arg VITE_PORT=5173 -t spruvex-pos:latest .
#
# PORT/BASE_PATH are build-time Vite env vars (see vite.config.ts) — pass
# them via --build-arg, not a runtime .env, since a static build has no
# runtime process to read one from.

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /workspace

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY artifacts/pos-system/package.json ./artifacts/pos-system/package.json
COPY lib ./lib
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.base.json ./tsconfig.base.json
COPY artifacts/pos-system ./artifacts/pos-system
ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}
RUN pnpm --filter @workspace/pos-system run build

FROM nginx:1.27-alpine AS runtime
# Default matches the docker-compose service alias; override on platforms
# without Compose-style service-name DNS (e.g. Render) with that platform's
# internal address for the api service. The frontend only ever calls
# relative `/api/...` paths (see src/lib/api.ts), so this proxy is what
# makes the SPA reachable-and-functional as a standalone deployment.
ENV API_INTERNAL_ORIGIN=api:5000
COPY deploy/nginx/pos-system.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/artifacts/pos-system/dist/public /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
