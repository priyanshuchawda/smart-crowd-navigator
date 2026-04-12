FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json biome.json playwright.config.ts ./
COPY apps ./apps
COPY packages ./packages
COPY services ./services
COPY docs ./docs
COPY firebase.json firestore.rules README.md ./

RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/services/assistant-api/node_modules ./services/assistant-api/node_modules
COPY --from=build /app/services/assistant-api/dist ./services/assistant-api/dist

EXPOSE 8080

CMD ["node", "services/assistant-api/dist/index.js"]
