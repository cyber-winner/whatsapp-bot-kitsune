# ============================================
#  🦊 Kitsune WhatsApp Bot — Docker Image
#  Multi-service container via PM2
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

# Install system dependencies for Puppeteer (Chromium), build tools for native modules
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    fonts-noto-color-emoji \
    libxss1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libasound2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    dumb-init \
    procps \
    zip \
    && rm -rf /var/lib/apt/lists/*

# Configure Puppeteer to use system Chromium (skip downloading its own)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    ENABLE_REMOTE_LOGGING=true

# Install PM2 globally for multi-process management
RUN npm install -g pm2

# Copy package files first for Docker layer caching
COPY package*.json ./

# Install Node.js dependencies (production + build native modules)
RUN npm ci --ignore-scripts && \
    npx puppeteer browsers install chrome 2>/dev/null || true

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
    .wwebjs_auth \
    .wwebjs_cache \
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
