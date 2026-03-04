# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base

WORKDIR /app
ENV BACKEND_BUILD_IN_DOCKER=1
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends ca-certificates wget && rm -rf /var/lib/apt/lists/*

FROM base AS deps

ENV DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts

RUN --mount=type=cache,target=/pnpm/store,sharing=locked \
    pnpm config set store-dir /pnpm/store && pnpm install --filter @continuum/api... --frozen-lockfile

FROM deps AS builder

COPY scripts ./scripts
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @continuum/shared build
RUN pnpm --filter @continuum/api exec prisma generate
RUN pnpm --filter @continuum/api build

FROM base AS runner

ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=builder /app/apps/api/scripts ./apps/api/scripts
COPY apps/api/package.json ./apps/api/package.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

CMD ["node", "apps/api/dist/main.js"]

FROM deps AS dev

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

CMD ["pnpm", "--filter", "@continuum/api", "dev"]
