FROM node:20-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/

RUN pnpm install --filter @continuum/api... --frozen-lockfile

COPY apps/api ./apps/api

EXPOSE 3000

CMD ["pnpm", "--filter", "@continuum/api", "dev"]
