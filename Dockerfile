# This Dockerfile should be run from the monorepo root
# Docker build context should be: /path/to/monorepo
# Build command: docker build -f loaders/loader-ccxt-ohlcv/Dockerfile .

FROM node:18-alpine

# Install required packages
RUN apk add --no-cache curl unzip bash

# Install pnpm globally
RUN npm install -g pnpm

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Set working directory
WORKDIR /app

# Copy monorepo package files (for workspace resolution)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./

# Copy workspace packages that this loader depends on
COPY packages/ ./packages/

# Copy the specific loader package
COPY loaders/loader-ccxt-ohlcv ./loaders/loader-ccxt-ohlcv/

# Install all dependencies (including workspace deps)
RUN pnpm install --frozen-lockfile

# Set working directory to the loader
WORKDIR /app/loaders/loader-ccxt-ohlcv

# Type check (optional - will continue even if it fails)
RUN pnpm run tsc --noEmit || echo "TypeScript check completed"

# Expose port (match the port your app uses)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["pnpm", "start"]