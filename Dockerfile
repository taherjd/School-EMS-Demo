# syntax=docker/dockerfile:1
# Multi-stage build for the Dubai School Manager (Next.js 16 + Prisma 7 + PostgreSQL)

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --ignore-scripts

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# DATABASE_URL is only needed for `prisma generate` type generation here, not for a live connection
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN mkdir -p public && npx prisma generate && npx next build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
# Runtime needs: built app, production deps (incl. prisma CLI for migrations), schema + migrations
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/src/generated ./src/generated
COPY --from=build /app/public ./public
COPY package.json prisma.config.ts next.config.ts ./
COPY prisma ./prisma
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN chmod +x ./docker/entrypoint.sh && chown -R app:app /app
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s CMD wget -qO- http://localhost:3000/api/health || exit 1
ENTRYPOINT ["./docker/entrypoint.sh"]
CMD ["npx", "next", "start"]
