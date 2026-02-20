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

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --filter @continuum/worker... --frozen-lockfile

FROM deps AS builder

COPY scripts ./scripts
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker

RUN pnpm --filter @continuum/shared build
RUN pnpm --filter @continuum/worker build

FROM base AS runner

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY apps/worker/package.json ./apps/worker/package.json

CMD ["node", "apps/worker/dist/main.js"]

FROM deps AS dev

COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker

CMD ["pnpm", "--filter", "@continuum/worker", "dev"]
