FROM node:22-slim AS base

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source
COPY . .

# Build
RUN npm run build

# Production
FROM node:22-slim AS runner
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3003
ENV HOSTNAME=0.0.0.0

# Copy standalone build
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/public ./public
COPY --from=base /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

# Create data directory for SQLite volume mount
RUN mkdir -p /data

EXPOSE 3003

CMD ["node", "server.js"]
