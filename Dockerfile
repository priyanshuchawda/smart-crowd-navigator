FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json biome.json playwright.config.ts ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services

RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm --filter @smart-crowd-navigator/assistant-api --prod deploy /app/.deploy/assistant-api

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/.deploy/assistant-api ./services/assistant-api

EXPOSE 8080

CMD ["node", "services/assistant-api/dist/index.js"]
