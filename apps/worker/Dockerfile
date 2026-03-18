# syntax=docker/dockerfile:1.7

ARG TEXLIVE_BASE_IMAGE=continuum-texlive-base:texlive-2022-node20-bookworm

FROM ${TEXLIVE_BASE_IMAGE} AS base

WORKDIR /app
ENV BACKEND_BUILD_IN_DOCKER=1
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

FROM base AS deps

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/worker/package.json apps/worker/
COPY packages/latex-runtime/package.json packages/latex-runtime/
COPY packages/shared/package.json packages/shared/

RUN --mount=type=cache,target=/pnpm/store,sharing=locked \
    pnpm config set store-dir /pnpm/store && pnpm install --filter @continuum/worker... --frozen-lockfile

FROM deps AS builder

COPY scripts ./scripts
COPY packages/latex-runtime ./packages/latex-runtime
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker

RUN pnpm --filter @continuum/latex-runtime build
RUN pnpm --filter @continuum/shared build
RUN pnpm --filter @continuum/worker build

FROM base AS runner

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/packages/latex-runtime/dist ./packages/latex-runtime/dist
COPY packages/latex-runtime/package.json ./packages/latex-runtime/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY apps/worker/package.json ./apps/worker/package.json

CMD ["node", "apps/worker/dist/main.js"]

FROM deps AS dev

COPY packages/latex-runtime ./packages/latex-runtime
COPY packages/shared ./packages/shared
COPY apps/worker ./apps/worker

CMD ["pnpm", "--filter", "@continuum/worker", "dev"]
