# Multi-stage Dockerfile for LLM Connector Hub
# Optimized for production with minimal image size and security hardening

# ===========================
# Stage 1: Builder
# ===========================
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files
COPY package*.json ./
COPY packages/core/package*.json ./packages/core/
COPY packages/providers/package*.json ./packages/providers/
COPY packages/middleware/package*.json ./packages/middleware/
COPY packages/hub/package*.json ./packages/hub/

# Install dependencies
RUN npm ci --only=production && \
    npm ci --workspace=packages/core --only=production && \
    npm ci --workspace=packages/providers --only=production && \
    npm ci --workspace=packages/middleware --only=production && \
    npm ci --workspace=packages/hub --only=production

# Copy source code
COPY . .

# Build all packages
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# ===========================
# Stage 2: Production
# ===========================
FROM node:18-alpine AS production

# Install security updates
RUN apk upgrade --no-cache && \
    apk add --no-cache \
    dumb-init \
    ca-certificates \
    tzdata

# Create non-root user
RUN addgroup -g 1001 -S llmhub && \
    adduser -S -D -H -u 1001 -h /app -s /sbin/nologin -G llmhub -g llmhub llmhub

# Set working directory
WORKDIR /app

# Copy built artifacts from builder
COPY --from=builder --chown=llmhub:llmhub /app/node_modules ./node_modules
COPY --from=builder --chown=llmhub:llmhub /app/packages ./packages
COPY --from=builder --chown=llmhub:llmhub /app/package*.json ./

# Create necessary directories
RUN mkdir -p /app/logs /app/config && \
    chown -R llmhub:llmhub /app

# Set environment variables
ENV NODE_ENV=production \
    PORT=8080 \
    LOG_LEVEL=info \
    TZ=UTC

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Switch to non-root user
USER llmhub

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "packages/hub/dist/index.js"]

# ===========================
# Stage 3: Development
# ===========================
FROM node:18-alpine AS development

# Install development dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    bash

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY . .

# Expose port and debugger port
EXPOSE 8080 9229

# Development command with debugging
CMD ["npm", "run", "dev"]

# ===========================
# Stage 4: Test
# ===========================
FROM node:18-alpine AS test

WORKDIR /app

# Install dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Run tests
CMD ["npm", "test"]
