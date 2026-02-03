FROM node:20-alpine

WORKDIR /app

RUN corepack enable

ENV DATABASE_URL=postgresql://continuum:continuum@postgres:5432/continuum

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts

RUN pnpm install --filter @continuum/api... --frozen-lockfile

COPY apps/api ./apps/api

EXPOSE 3000

CMD ["pnpm", "--filter", "@continuum/api", "dev"]
