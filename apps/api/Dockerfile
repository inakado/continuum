FROM node:20-alpine AS base

WORKDIR /app
ENV BACKEND_BUILD_IN_DOCKER=1

RUN corepack enable

ARG TECTONIC_VERSION=0.15.0
RUN set -eux; \
    apk add --no-cache curl ca-certificates tar fontconfig ttf-dejavu; \
    curl -fsSL -o /tmp/tectonic.tar.gz "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz"; \
    tar -xzf /tmp/tectonic.tar.gz -C /tmp; \
    install -m 0755 /tmp/tectonic /usr/local/bin/tectonic; \
    rm -f /tmp/tectonic.tar.gz /tmp/tectonic; \
    fc-cache -f; \
    tectonic --version

FROM base AS deps

ENV DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts

RUN pnpm install --filter @continuum/api... --frozen-lockfile

FROM deps AS builder

COPY scripts ./scripts
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @continuum/shared build
RUN pnpm --filter @continuum/api exec prisma generate
RUN pnpm --filter @continuum/api build

FROM base AS runner

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY apps/api/package.json ./apps/api/package.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "apps/api/dist/main.js"]

FROM deps AS dev

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

CMD ["pnpm", "--filter", "@continuum/api", "dev"]
