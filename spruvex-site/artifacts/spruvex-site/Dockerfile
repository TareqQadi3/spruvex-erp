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
COPY tsconfig.base.json ./tsconfig.base.json
COPY lib ./lib
COPY attached_assets ./attached_assets
COPY artifacts/spruvex-site ./artifacts/spruvex-site
ARG BASE_PATH=/
# Defaults match the SpruVex ERP trial deployment's Render service names
# (see ../../../spruvex-app/render.yaml) — hosting platforms that build
# from a Blueprint (Render among them) don't support passing custom Docker
# build args, so these must be real, working defaults, not placeholders.
ARG VITE_API_URL=https://spruvex-api.onrender.com
ARG VITE_APP_URL=https://spruvex-pos.onrender.com
# Client-bundled (Vite bakes VITE_* into the public JS — view-source can
# always recover this), so it only gates casual access to the ?admin route,
# never a real secret. Trial-only default; change before any real use.
ARG VITE_ADMIN_PANEL_PASSWORD=spruvex-trial-2026
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
