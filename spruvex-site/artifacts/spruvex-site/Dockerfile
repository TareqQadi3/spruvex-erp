# syntax=docker/dockerfile:1
#
# Static build served by nginx. Build from the spruvex-site WORKSPACE ROOT
# (spruvex-site/, a separate pnpm workspace from spruvex-app by design):
#   docker build -f artifacts/spruvex-site/Dockerfile \
#     --build-arg VITE_API_URL=https://api.spruvex.com \
#     --build-arg VITE_APP_URL=https://app.spruvex.com \
#     -t spruvex-site:latest .
#
# VITE_* vars are compiled into the static bundle at build time (Vite
# convention) — a runtime .env has no effect on an already-built static
# site, so these must be supplied as build args pointing at the right
# environment's API/app URLs before building.

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /workspace

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY artifacts/spruvex-site/package.json ./artifacts/spruvex-site/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY artifacts/spruvex-site ./artifacts/spruvex-site
ARG BASE_PATH=/
ARG VITE_API_URL
ARG VITE_APP_URL
ARG VITE_ADMIN_PANEL_PASSWORD
ENV BASE_PATH=${BASE_PATH} \
    VITE_API_URL=${VITE_API_URL} \
    VITE_APP_URL=${VITE_APP_URL} \
    VITE_ADMIN_PANEL_PASSWORD=${VITE_ADMIN_PANEL_PASSWORD}
RUN pnpm --filter @workspace/spruvex-site run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /workspace/artifacts/spruvex-site/dist/public /usr/share/nginx/html
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
