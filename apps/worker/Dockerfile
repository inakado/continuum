FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/worker/package.json apps/worker/

RUN pnpm install --filter @continuum/worker... --frozen-lockfile

COPY apps/worker ./apps/worker

CMD ["pnpm", "--filter", "@continuum/worker", "dev"]
