FROM node:20-alpine

WORKDIR /app

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

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/worker/package.json apps/worker/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --filter @continuum/worker... --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker

CMD ["pnpm", "--filter", "@continuum/worker", "dev"]
