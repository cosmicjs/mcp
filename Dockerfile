FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
RUN npm install --global bun@1.1.42
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
COPY tsconfig.json tsup.config.ts ./
COPY src ./src
RUN bun run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache curl tini

COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/http.js"]
