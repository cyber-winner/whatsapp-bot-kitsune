# ============================================
#  🦊 Kitsune WhatsApp Bot — Docker Image
#  Multi-service container via PM2
#  Baileys Edition (no Chrome/Puppeteer)
# ============================================

# Stage 1: Build frontend (if needed)
FROM node:20-bookworm AS frontend-builder

WORKDIR /build/frontend
COPY frontend/package*.json ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install
COPY frontend/ ./
RUN npm run build 2>/dev/null || echo "Frontend build skipped (no build script or already built)"

# Stage 2: Main application
FROM node:20-bookworm

LABEL maintainer="cyber-winner"
LABEL description="Kitsune — Premium WhatsApp Bot with AI, Pokémon, moderation, and global message receiver"

# Set the working directory
WORKDIR /app

# Install minimal system dependencies (build tools for native modules only)
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    procps \
    zip \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    ENABLE_REMOTE_LOGGING=true

# Install PM2 globally for multi-process management
RUN npm install -g pm2

# Copy package files first for Docker layer caching
COPY package*.json ./

# Install Node.js dependencies (production + build native modules)
RUN npm ci --ignore-scripts

# Rebuild native modules (better-sqlite3 needs compilation)
RUN npm rebuild better-sqlite3 || true

# Copy application source code
COPY . .

# Copy built frontend from builder stage (overwrite with fresh build)
COPY --from=frontend-builder /build/frontend/dist ./frontend/dist

# Ensure required runtime directories exist
RUN mkdir -p \
    logs \
    data \
    scratch \
    db \
    baileys_auth \
    global-messages \
    store-data-for-use

# Expose ports:
#  3100 — Kitsune Brain API (internal AI)
#  3200 — Global Message Receiver (receives remote message logs)
#  3300 — Internal WhatsApp RPC API
#  8000 — Control Centre Web UI
EXPOSE 3100 3200 3300 8000

# Health check — verify the main bot process is running
HEALTHCHECK --interval=60s --timeout=10s --start-period=120s --retries=3 \
    CMD pm2 pid celestia-wa-bot > /dev/null 2>&1 || exit 1

# Use dumb-init to properly handle signals (PID 1 issues)
ENTRYPOINT ["dumb-init", "--"]

# Start all services via PM2 in foreground mode
CMD ["pm2-runtime", "ecosystem.config.js"]
