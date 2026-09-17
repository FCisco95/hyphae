FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @hyphae/api build
# --legacy: pnpm 10 deploy otherwise requires inject-workspace-packages; workspace code is already bundled by tsup.
RUN pnpm --filter @hyphae/api --prod deploy --legacy /pruned

FROM node:22-slim AS run
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /pruned/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./package.json
CMD ["node", "dist/server.js"]
