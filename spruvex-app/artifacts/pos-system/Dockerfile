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
COPY artifacts/pos-system ./artifacts/pos-system
ARG BASE_PATH=/
ENV BASE_PATH=${BASE_PATH}
RUN pnpm --filter @workspace/pos-system run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /workspace/artifacts/pos-system/dist/public /usr/share/nginx/html
# SPA fallback: any unmatched path serves index.html so client-side routing
# (wouter) handles it, instead of nginx 404ing on a deep-link refresh.
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
