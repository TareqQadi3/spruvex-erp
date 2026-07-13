# Generic production image for the Vite React SPAs (dashboard / pos / kds).
# Parameterized by APP_DIR so one Dockerfile serves all three.
#
# Build from the REPO ROOT, e.g.:
#   docker build -f infra/docker/spa.Dockerfile --build-arg APP_DIR=dashboard -t spruvex-r-dashboard .
#   docker build -f infra/docker/spa.Dockerfile --build-arg APP_DIR=pos       -t spruvex-r-pos .
#   docker build -f infra/docker/spa.Dockerfile --build-arg APP_DIR=kds       -t spruvex-r-kds .
#
# NOTE: not build-verified in this sandbox (no Docker daemon here) — validate
# with a real `docker build` in CI before a production deploy.

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
ARG APP_DIR
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY apps/${APP_DIR}/package.json apps/${APP_DIR}/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG APP_DIR
COPY packages/ui packages/ui
COPY packages/types packages/types
COPY packages/config packages/config
COPY apps/${APP_DIR} apps/${APP_DIR}
RUN pnpm --filter @spruvex-r/types build
RUN pnpm --filter @spruvex-r/ui build
RUN pnpm --filter @spruvex-r/${APP_DIR} build

FROM nginx:1.27-alpine AS runtime
ARG APP_DIR
COPY infra/docker/spa.nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/${APP_DIR}/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1
