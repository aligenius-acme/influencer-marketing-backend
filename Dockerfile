# ================================
# Backend Production Dockerfile
# ================================

# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Install dependencies for native modules and Prisma
RUN apt-get update && apt-get install -y \
    openssl \
    libssl-dev \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Prune dev dependencies for production
RUN npm prune --production

# ================================
# Stage 2: Production
FROM node:20-slim AS production

WORKDIR /app

# Install runtime dependencies including OpenSSL
RUN apt-get update && apt-get install -y \
    openssl \
    dumb-init \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -m nodejs

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Copy pruned node_modules from builder (includes production deps only)
COPY --from=builder /app/node_modules ./node_modules

# Regenerate Prisma client for this platform
RUN npx prisma generate

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Start with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
