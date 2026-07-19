# =============================================================================
# ScrapIQ CI — Multi-stage Dockerfile (production-ready)
# =============================================================================
# Produces a minimal image containing:
#   - Next.js standalone server (.next/standalone/server.js)
#   - Static assets (.next/static, public/)
#   - Prisma client + generated queries (node_modules/.prisma, @prisma)
#   - Playwright Chromium binary + runtime shared libraries
#   - ioredis (for scripts/scraper-worker.js — Redis-based job consumer)
#
# Build:
#   docker build -t scraapiq-ci:latest .
#
# Run (see docker-compose.yml for full stack):
#   docker run -p 3000:3000 --env-file .env.production scraapiq-ci:latest
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Dependencies
# -----------------------------------------------------------------------------
FROM node:20-slim AS deps
WORKDIR /app

# libc6 needed by some native addons (sharp, bcrypt, Prisma engines)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libc6 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lock* package-lock.json* ./

# Install with npm (more compatible in Docker than bun).
# Try `npm ci` first (frozen install from package-lock.json if present),
# fall back to `npm install` (resolves from package.json, creates lockfile).
RUN npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund

# -----------------------------------------------------------------------------
# Stage 2: Builder
# -----------------------------------------------------------------------------
FROM node:20-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install Playwright Chromium browser + OS dependencies (build-time only)
RUN npx playwright install --with-deps chromium

# Build Next.js with increased memory (Prisma + Next.js 16 + Turbopack)
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=true

# `next build` produces:
#   - .next/standalone/  (minimal server.js + bundled node_modules)
#   - .next/static/      (JS/CSS chunks)
# Requires `output: "standalone"` in next.config.ts (re-enabled in Task 47-a).
RUN npx prisma generate && npx next build

# -----------------------------------------------------------------------------
# Stage 3: Runner (minimal production image)
# -----------------------------------------------------------------------------
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Playwright Chromium runtime shared libraries (the browser binary is copied
# from the builder stage; these system libs are needed to actually launch it).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libc6 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libxshmfence1 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    fonts-liberation \
    fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (UID/GID 1001 — matches common VPS user)
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs --create-home --shell /bin/bash nextjs

# --- Next.js standalone server + static assets ---
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# --- Prisma client (NOT bundled by Next.js standalone — must be copied explicitly) ---
# Without these, the server crashes silently on the first DB query (Task 44 root cause).
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma

# --- Playwright Chromium binary + playwright-core (for the scraper) ---
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/playwright-core ./node_modules/playwright-core
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/playwright ./node_modules/playwright
COPY --from=builder --chown=nextjs:nodejs /root/.cache/ms-playwright /home/nextjs/.cache/ms-playwright

# --- ioredis (for scripts/scraper-worker.js — Redis-based job consumer) ---
# Usually included in standalone output via dynamic import in src/lib/queue/config.ts,
# but copied explicitly to guarantee availability for the worker process.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/ioredis ./node_modules/ioredis
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/cluster-key-slot ./node_modules/cluster-key-slot
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/redis-errors ./node_modules/redis-errors
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/redis-parser ./node_modules/redis-parser
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/redis-commands ./node_modules/redis-commands
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/standard-as-callback ./node_modules/standard-as-callback
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/yamlparser ./node_modules/yamlparser

# --- Prisma schema + scripts (seed-prod, scraper-worker, etc.) ---
COPY --chown=nextjs:nodejs prisma ./prisma
COPY --chown=nextjs:nodejs scripts ./scripts

# Ensure the Playwright cache is readable by the nextjs user
RUN chown -R nextjs:nodejs /home/nextjs/.cache

USER nextjs

EXPOSE 3000

# Healthcheck: hits /api/health (liveness probe — see src/app/api/health/route.ts).
# If this fails 3 times in a row, Docker restarts the container.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# Start the standalone Next.js server (NOT `next start` — the standalone
# server.js is a pre-bundled, minimal Node HTTP server).
CMD ["node", "server.js"]
