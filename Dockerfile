ARG PNPM_VERSION=9.15.3

FROM node:20-bookworm-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

FROM base AS pnpm
ARG PNPM_VERSION
RUN corepack disable \
  && npm install -g pnpm@${PNPM_VERSION} --registry=https://registry.npmjs.org --no-audit --no-fund

FROM pnpm AS deps

COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma

RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .

RUN pnpm build

FROM pnpm AS runner

ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000 \
  HOSTNAME=0.0.0.0

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/src ./src
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma

EXPOSE 3000

CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm prisma db seed || true && pnpm start"]
