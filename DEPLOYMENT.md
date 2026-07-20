# ScrapIQ CI — Deployment Guide

This guide covers deploying the ScrapIQ CI SaaS platform to production. The
stack consists of **Next.js 16** (standalone server), **PostgreSQL 16** (with
pgvector), **Redis 7** (BullMQ queues), and a **scraper worker** (Playwright /
Chromium).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Option A — Docker Compose on a VPS (recommended)](#2-option-a--docker-compose-on-a-vps-recommended)
3. [Option B — Kubernetes (for scaling)](#3-option-b--kubernetes-for-scaling)
4. [Option C — Vercel (frontend only)](#4-option-c--vercel-frontend-only)
5. [Environment Variables](#5-environment-variables)
6. [Database Setup](#6-database-setup)
7. [Redis Setup](#7-redis-setup)
8. [Domain + TLS (Caddy / Nginx + Let's Encrypt)](#8-domain--tls-caddy--nginx--lets-encrypt)
9. [First Admin User](#9-first-admin-user)
10. [Backup Strategy](#10-backup-strategy)
11. [Monitoring (Sentry)](#11-monitoring-sentry)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

### Minimum hardware

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU       | 2 vCPU  | 4 vCPU      |
| RAM       | 4 GB    | 8 GB        |
| Disk      | 40 GB   | 80 GB SSD   |
| Network   | 10 Mbps | 100 Mbps    |

> The scraper worker runs Chromium, which is memory-heavy (~500 MB per tab).
> On a 4 GB VPS, keep `WORKER_CONCURRENCY=1`. On 8 GB+, you can safely set it
> to `2` or `3`.

### Software

- **Docker Engine** 24+ → [install docs](https://docs.docker.com/engine/install/)
- **Docker Compose** v2+ (bundled with Docker Engine on most platforms)
- **Git** (to clone the repo)
- **OpenSSL** (to generate secrets — preinstalled on all Linux distros)

### Required accounts / API keys

- **z-ai-web-dev-sdk** API key (the LLM / VLM / embeddings provider)
- **Domain name** + DNS access (for TLS)
- *(Optional)* Google + Microsoft OAuth credentials
- *(Optional)* Stripe / Orange Money / MTN MoMo (for billing)
- *(Optional)* Sentry DSN (for error monitoring)
- *(Optional)* SMTP provider (Resend, SendGrid, SES, etc.)

---

## 2. Option A — Docker Compose on a VPS (recommended)

Best for: single-server deployments, small teams, predictable load.

### Step 1 — Provision a VPS

Recommended providers: Hetzner (best value), DigitalOcean, OVH, Vultr, AWS
Lightsail. Pick **Ubuntu 22.04 LTS** or **Debian 12**.

```bash
# SSH into your VPS
ssh root@your-server-ip

# Update the system
apt update && apt upgrade -y

# Install Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Create a non-root user for the app
adduser --gecos "" scraapiq
usermod -aG docker scraapiq
su - scraapiq
```

### Step 2 — Clone the repository

```bash
cd /home/scraapiq
git clone https://github.com/your-org/scraapiq-ci.git
cd scraapiq-ci
```

### Step 3 — Generate secrets and create `.env.production`

```bash
# Generate all cryptographic secrets at once
bash scripts/generate-secrets.sh > /tmp/secrets.txt

# Create the production env file
cp .env.example .env.production

# Edit .env.production:
#   1. Paste the secrets from /tmp/secrets.txt over the <replace: ...> placeholders
#   2. Set NEXT_PUBLIC_APP_URL to your domain (https://app.scraapiq.ci)
#   3. Set DATABASE_URL to: postgresql://scraapiq:CHANGE_ME@postgres:5432/scraapiq?schema=public
#   4. Set REDIS_URL to: redis://redis:6379
#   5. Set ZAI_API_KEY to your actual key
#   6. Set ADMIN_EMAIL + ADMIN_PASSWORD (for the first admin user)
nano .env.production

# Secure the file
chmod 600 .env.production

# Shred the temporary secrets file
shred -u /tmp/secrets.txt
```

### Step 4 — Set the PostgreSQL password

In `.env.production`, set a strong password:

```bash
POSTGRES_DB=scraapiq
POSTGRES_USER=scraapiq
POSTGRES_PASSWORD=your-strong-password-here
```

Make sure `DATABASE_URL` uses the same password:

```
DATABASE_URL=postgresql://scraapiq:your-strong-password-here@postgres:5432/scraapiq?schema=public
```

### Step 5 — Build and start the stack

```bash
# Build the images and start all services in detached mode
docker compose --env-file .env.production up -d --build

# Watch the logs (Ctrl+C to exit, services keep running)
docker compose logs -f app

# Check that all services are healthy
docker compose ps
```

Expected output:

```
NAME                       STATUS                   PORTS
scraapiq-postgres          Up (healthy)             127.0.0.1:5432->5432/tcp
scraapiq-redis             Up (healthy)             127.0.0.1:6379->6379/tcp
scraapiq-app               Up (healthy)             0.0.0.0:3000->3000/tcp
scraapiq-scraper-worker    Up                       -
```

### Step 6 — Initialize the database

```bash
# Create all tables (idempotent — safe to re-run)
docker compose exec app npx prisma db push

# Create the first admin user + organization
docker compose exec app node scripts/seed-prod.ts
```

### Step 7 — Verify

```bash
# Health check (should return JSON with status: "healthy")
curl http://localhost:3000/api/health

# Readiness check (verifies DB + Redis + ZAI API)
curl http://localhost:3000/api/ready
```

### Step 8 — Set up the reverse proxy (TLS)

See [Section 8 — Domain + TLS](#8-domain--tls-caddy--nginx--lets-encrypt).

---

## 3. Option B — Kubernetes (for scaling)

Best for: multi-region deployments, auto-scaling, blue-green deploys.

### Prerequisites

- A Kubernetes cluster (EKS, GKE, AKS, or self-managed with kubeadm)
- `kubectl` configured
- A container registry (GHCR, ECR, GCR)
- Helm 3+ (for installing Postgres / Redis operators)

### Step 1 — Build and push the image

```bash
# Build for linux/amd64 (or arm64 if your nodes are ARM)
docker buildx build --platform linux/amd64 -t ghcr.io/your-org/scraapiq-ci:latest --push .
```

### Step 2 — Create Kubernetes manifests

Create `k8s/` directory with:

- `namespace.yaml` — `scraapiq` namespace
- `secret.yaml` — Kubernetes Secret from `.env.production`
- `postgres.yaml` — StatefulSet + Service + PersistentVolumeClaim
- `redis.yaml` — StatefulSet + Service
- `app-deployment.yaml` — Deployment + Service + Ingress
- `scraper-worker.yaml` — Deployment (no Service — it's a worker)
- `hpa.yaml` — HorizontalPodAutoscaler for the app

Example `app-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: scraapiq-app
  namespace: scraapiq
spec:
  replicas: 2
  selector:
    matchLabels:
      app: scraapiq-app
  template:
    metadata:
      labels:
        app: scraapiq-app
    spec:
      containers:
        - name: app
          image: ghcr.io/your-org/scraapiq-ci:latest
          ports:
            - containerPort: 3000
          envFrom:
            - secretRef:
                name: scraapiq-secrets
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 40
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /api/ready
              port: 3000
            initialDelaySeconds: 20
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: scraapiq-app
  namespace: scraapiq
spec:
  selector:
    app: scraapiq-app
  ports:
    - port: 80
      targetPort: 3000
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: scraapiq-ingress
  namespace: scraapiq
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"
spec:
  tls:
    - hosts: [app.scraapiq.ci]
      secretName: scraapiq-tls
  rules:
    - host: app.scraapiq.ci
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: scraapiq-app
                port:
                  number: 80
```

### Step 3 — Deploy

```bash
kubectl apply -f k8s/
kubectl -n scraapiq rollout status deployment/scraapiq-app
```

### Recommended: managed Postgres + Redis

For production, use **managed** Postgres (RDS, Cloud SQL, Neon) and Redis
(Elasticache, Upstash) instead of running them in Kubernetes. They handle
backups, replication, and failover automatically.

---

## 4. Option C — Vercel (frontend only)

Best for: getting the frontend online quickly without managing a server.

> ⚠️ **Limitation**: Vercel does not support Playwright / Chromium in serverless
> functions (memory + time limits). The scraper must run on a separate service
> (VPS, Railway, Fly.io, or a dedicated container).

### Step 1 — Deploy the frontend to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Set these environment variables in the Vercel dashboard:

- `DATABASE_URL` — your managed Postgres URL (Neon, Supabase, RDS)
- `REDIS_URL` — your managed Redis URL (Upstash, Elasticache)
- `ZAI_API_KEY` — your ZAI API key
- `JWT_SECRET`, `JWT_ACCESS_SECRET`, `ENCRYPTION_KEY` — from `generate-secrets.sh`
- `NEXT_PUBLIC_APP_URL` — `https://your-app.vercel.app`

### Step 2 — Deploy the scraper worker separately

Use **Railway**, **Fly.io**, or a small VPS to run the scraper worker:

```bash
# On Railway / Fly.io / VPS:
docker run -d \
  --name scraapiq-worker \
  -e REDIS_URL=redis://your-redis:6379 \
  -e APP_URL=https://your-app.vercel.app \
  -e ZAI_API_KEY=... \
  -e DATABASE_URL=... \
  ghcr.io/your-org/scraapiq-ci:latest \
  node scripts/scraper-worker.js
```

---

## 5. Environment Variables

All variables are documented in [`.env.example`](.env.example). The critical
ones for production:

### Required (app won't start without these)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://scraapiq:pass@postgres:5432/scraapiq?schema=public` |
| `REDIS_URL` | Redis connection string | `redis://redis:6379` |
| `JWT_SECRET` | JWT signing secret (≥32 bytes) | (from `generate-secrets.sh`) |
| `JWT_ACCESS_SECRET` | Access token signing secret | (from `generate-secrets.sh`) |
| `ENCRYPTION_KEY` | AES-256-GCM key (exactly 32 bytes) | (from `generate-secrets.sh`) |
| `ZAI_API_KEY` | z-ai-web-dev-sdk API key | `zai-xxxxx` |
| `NEXT_PUBLIC_APP_URL` | Public app URL | `https://app.scraapiq.ci` |

### Required for first admin bootstrap

| Variable | Description |
|----------|-------------|
| `ADMIN_EMAIL` | First admin user's email |
| `ADMIN_PASSWORD` | First admin's password (≥8 chars, 1 upper + 1 lower + 1 digit + 1 special) |

### Optional (feature-specific)

| Variable | Feature |
|----------|---------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth login |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth login |
| `STRIPE_SECRET_KEY` | Card payments |
| `ORANGE_MONEY_*` | Orange Money CI payments |
| `MTN_MOMO_*` | MTN MoMo CI payments |
| `SMTP_URL` | Email notifications |
| `SENTRY_DSN` | Error monitoring |
| `SCRAPER_PROXY_POOL` | Rotating proxies for scraping |

### Generating secrets

```bash
bash scripts/generate-secrets.sh
```

This outputs all the cryptographic secrets you need to paste into `.env.production`.

---

## 6. Database Setup

### PostgreSQL 16 + pgvector

The `pgvector/pgvector:pg16` Docker image (used in `docker-compose.yml`) ships
with the pgvector extension pre-installed. To enable it:

```bash
docker compose exec postgres psql -U scraapiq -d scraapiq -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

### Running migrations

The project uses Prisma. To create/update the schema:

```bash
# Push the Prisma schema to the DB (creates all tables)
docker compose exec app npx prisma db push

# (Alternative) Create a migration and apply it
docker compose exec app npx prisma migrate deploy
```

### Managed Postgres (RDS / Neon / Supabase)

If you use managed Postgres instead of the Docker container:

1. Create a `scraapiq` database and user
2. Enable the pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Update `DATABASE_URL` in `.env.production` to point to the managed instance
4. Remove the `postgres` service from `docker-compose.yml` (or comment it out)

### Connection pooling (PgBouncer)

For serverless deployments (Vercel), use a connection pooler (PgBouncer or
Neon's pooled endpoint) to avoid exhausting Postgres connections:

- `DATABASE_URL` → pooled connection string (port 6432)
- `DIRECT_URL` → direct connection string (port 5432, for migrations)

---

## 7. Redis Setup

### Docker (default in docker-compose.yml)

Redis 7 Alpine with AOF persistence and 256 MB max memory (LRU eviction).

### Managed Redis (Elasticache / Upstash)

For production with multiple app replicas, use managed Redis:

1. Create a Redis 7+ instance
2. Enable AOF persistence
3. Set `REDIS_URL` in `.env.production`:
   ```
   REDIS_URL=rediss://default:your-password@your-redis.upstash.io:6379
   ```
   (`rediss://` = TLS — recommended for managed Redis)

### BullMQ requirements

- `maxRetriesPerRequest: null` (required by BullMQ — handled by the app)
- Memory: 256 MB minimum, 1 GB recommended for high-traffic queues

---

## 8. Domain + TLS (Caddy / Nginx + Let's Encrypt)

### Option A — Caddy (recommended — automatic HTTPS)

Caddy automatically provisions and renews Let's Encrypt certificates.

**Install Caddy** on the VPS:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

**Configure Caddy** — create `/etc/caddy/Caddyfile`:

```caddyfile
app.scraapiq.ci {
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # Compression
    encode gzip zstd

    # Static file caching (optional — Next.js already handles /_next/static)
    @static path /_next/static/*
    header @static Cache-Control "public, max-age=31536000, immutable"

    # Upload size limit (for file imports)
    request_body {
        max_size 50MB
    }

    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=(self)"
    }

    # Logging
    log {
        output file /var/log/caddy/scraapiq.log
        format json
    }
}
```

**Reload Caddy**:

```bash
sudo systemctl reload caddy
```

Make sure port 80 + 443 are open in your firewall:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

Update `NEXT_PUBLIC_APP_URL` in `.env.production` to `https://app.scraapiq.ci`,
then restart the app:

```bash
docker compose --env-file .env.production up -d app
```

### Option B — Nginx + Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

Create `/etc/nginx/sites-available/scraapiq`:

```nginx
server {
    listen 80;
    server_name app.scraapiq.ci;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s; # 5 min for long-running scraper requests
    }
}
```

Enable + get TLS:

```bash
sudo ln -s /etc/nginx/sites-available/scraapiq /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.scraapiq.ci --redirect --agree-tos -m admin@scraapiq.ci
```

---

## 9. First Admin User

After the stack is up and the database is initialized, create the first admin:

```bash
docker compose exec app node scripts/seed-prod.ts
```

This creates:

1. One **OWNER** user (email from `ADMIN_EMAIL`, password from `ADMIN_PASSWORD`)
2. One **Organization** (owned by that user, Starter plan)
3. One **Workspace** (default workspace inside the org)
4. One **Member** record (links OWNER ↔ Organization)
5. One **License** (Starter plan, active)
6. One **QuotaUsage** (current month counters at 0)

The script is **idempotent** — re-running it detects the existing user and
aborts without creating duplicates.

Log in at `https://app.scraapiq.ci/auth/login` with the admin credentials.

---

## 10. Backup Strategy

### PostgreSQL backups (daily)

Create `/home/scraapiq/backup-postgres.sh`:

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/home/scraapiq/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

# Dump the database (password from .env.production)
source /home/scraapiq/scraapiq-ci/.env.production
docker compose -f /home/scraapiq/scraapiq-ci/docker-compose.yml \
  exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip > "$BACKUP_DIR/scraapiq_${TIMESTAMP}.sql.gz"

# Delete backups older than RETENTION_DAYS
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "[$(date)] Backup created: scraapiq_${TIMESTAMP}.sql.gz"
```

```bash
chmod +x /home/scraapiq/backup-postgres.sh

# Add to crontab — daily at 3 AM
(crontab -l 2>/dev/null; echo "0 3 * * * /home/scraapiq/backup-postgres.sh >> /home/scraapiq/backups/postgres.log 2>&1") | crontab -
```

### Redis backups

Redis AOF persistence is enabled in `docker-compose.yml` (`--appendonly yes`).
For periodic RDB snapshots, add to the Redis command:

```yaml
command: >
  redis-server
  --maxmemory 256mb
  --maxmemory-policy allkeys-lru
  --appendonly yes
  --appendfsync everysec
  --save 300 10
  --save 60 10000
```

The RDB files are stored in the `redis_data` volume.

### Upload backups to off-site storage (S3 / B2)

```bash
# Install rclone and configure your remote
curl https://rclone.org/install.sh | sudo bash
rclone config  # set up S3 / Backblaze B2

# Add to backup-postgres.sh (after the pg_dump line):
rclone copy "$BACKUP_DIR" remote:scraapiq-backups/postgres/ --progress
```

### Restore

```bash
# Stop the app to prevent writes during restore
docker compose stop app scraper-worker

# Restore PostgreSQL
gunzip -c /home/scraapiq/backups/postgres/scraapiq_20250115_030000.sql.gz \
  | docker compose exec -T postgres psql -U scraapiq -d scraapiq

# Restart
docker compose up -d
```

---

## 11. Monitoring (Sentry)

### Step 1 — Create a Sentry project

1. Sign up at [sentry.io](https://sentry.io) (or self-host)
2. Create a new project → Platform: **Next.js**
3. Copy the DSN (looks like `https://xxx@oXXX.ingest.sentry.io/XXX`)

### Step 2 — Set the DSN

In `.env.production`:

```bash
SENTRY_DSN=https://your-dsn@o12345.ingest.sentry.io/67890
```

Restart the app:

```bash
docker compose --env-file .env.production up -d app
```

### Step 3 — Verify

```bash
# Trigger a test error
curl http://localhost:3000/api/health
# (Sentry auto-captures unhandled errors in API routes and React components)
```

### Optional: Sentry Performance Monitoring

To enable traces, set:

```bash
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% of transactions sampled
```

### Other monitoring tools

- **Uptime monitoring**: [UptimeRobot](https://uptimerobot.com) (free) — ping
  `https://app.scraapiq.ci/api/health` every 5 min
- **Log aggregation**: [Better Stack](https://betterstack.com) or
  [Loki](https://grafana.com/oss/loki/) via Docker logging driver
- **Container monitoring**: [cAdvisor](https://github.com/google/cadvisor) +
  [Grafana](https://grafana.com)

---

## 12. Troubleshooting

### App won't start — `Cannot find module '@prisma/client'`

The Next.js standalone build doesn't bundle Prisma. The Dockerfile copies
`node_modules/.prisma` and `node_modules/@prisma` explicitly (Stage 3). If you
see this error, make sure:

1. `next.config.ts` has `output: "standalone"` (re-enabled in Task 47-a)
2. The Dockerfile copies the Prisma modules (lines with `COPY --from=builder ... .prisma`)
3. `npx prisma generate` ran during the build (it's in the Dockerfile)

### Chromium fails to launch — `sandbox crash` / `missing libs`

```bash
# Check that the Playwright browser binary is present
docker compose exec app ls -la /home/nextjs/.cache/ms-playwright/

# Verify the runtime libs are installed
docker compose exec app ldd /home/nextjs/.cache/ms-playwright/chromium-*/chrome-linux/chrome | grep "not found"
```

If any libs are missing, add them to the `apt-get install` list in the
Dockerfile's runner stage and rebuild.

### OOM kills (app or worker crashes with signal 9)

```bash
# Check dmesg for OOM events
dmesg | grep -i "killed process"

# Check container memory usage
docker stats
```

Fixes:

- Increase the memory limit in `docker-compose.yml` (`deploy.resources.limits.memory`)
- Reduce `WORKER_CONCURRENCY` to 1
- Set `NODE_OPTIONS="--max-old-space-size=2048"` (or lower) in the app env

### Database connection errors — `Too many connections`

The app uses Prisma's connection pool. Default pool size is `num_cpus * 2 + 1`.
For serverless (Vercel), use PgBouncer or Neon's pooled endpoint:

```bash
DATABASE_URL=postgresql://scraapiq:pass@db.neon.tech/scraapiq?schema=public&pgbouncer=true&connection_limit=1
```

### Redis connection errors — `ECONNREFUSED`

```bash
# Check Redis is running
docker compose ps redis

# Test connectivity from the app container
docker compose exec app node -e "const net = require('net'); const s = net.connect(6379, 'redis'); s.on('connect', () => { console.log('OK'); process.exit(0); }); s.on('error', (e) => { console.log('FAIL', e.message); process.exit(1); });"
```

### Scraper worker is idle (no jobs processed)

This is expected if no jobs have been pushed to the Redis queue
(`scraapiq:scraper:queue`). The current app processes scraper jobs inline via
API routes. The worker is ready to consume jobs as soon as the app is
refactored to push them to Redis (see `scripts/scraper-worker.js` for the
expected job format).

To verify the worker is alive:

```bash
docker compose logs -f scraper-worker
# Should see periodic "Worker metrics" logs every 60s
```

### Need to run a one-off command

```bash
# Run a Prisma migration
docker compose exec app npx prisma migrate deploy

# Open a psql shell
docker compose exec postgres psql -U scraapiq -d scraapiq

# Open a Redis CLI
docker compose exec redis redis-cli

# Run a Node.js script
docker compose exec app node scripts/check-user.ts
```

---

## Quick reference — common commands

```bash
# Start everything
docker compose --env-file .env.production up -d --build

# Stop everything
docker compose down

# Stop + delete volumes (DESTRUCTIVE — loses all data!)
docker compose down -v

# View logs
docker compose logs -f app
docker compose logs -f scraper-worker
docker compose logs -f --tail=100 postgres

# Restart a single service
docker compose restart app

# Rebuild after code changes
docker compose --env-file .env.production up -d --build app

# Update to the latest code
git pull
docker compose --env-file .env.production up -d --build

# Scale the app (multiple replicas — only works with a load balancer)
docker compose up -d --scale app=2
```

---

## Appendix — Architecture diagram

```
                    ┌──────────────────────────────┐
                    │         Internet              │
                    └──────────────┬───────────────┘
                                   │
                          ┌────────▼────────┐
                          │   Caddy / Nginx  │  (TLS termination, reverse proxy)
                          │   (Let's Encrypt) │
                          └────────┬────────┘
                                   │ :443
                    ┌──────────────▼───────────────┐
                    │      Docker network           │
                    │      (scraapiq-net)            │
                    │                                │
                    │  ┌─────────────────────────┐  │
                    │  │  scraapiq-app  :3000     │  │  (Next.js standalone)
                    │  │  - Web UI                 │  │
                    │  │  - API routes             │  │
                    │  │  - NextAuth + JWT + 2FA   │  │
                    │  └────┬──────────────┬──────┘  │
                    │       │              │          │
                    │       │              │ RPUSH    │
                    │       │              │ job      │
                    │       │              ▼          │
                    │  ┌────▼─────┐  ┌─────────────┐  │
                    │  │ Postgres │  │   Redis :6379│  │
                    │  │  +vector │  │  (BullMQ)    │  │
                    │  │  :5432   │  └──────┬──────┘  │
                    │  └──────────┘         │ BRPOP   │
                    │                       ▼         │
                    │              ┌─────────────────┐│
                    │              │ scraper-worker  ││ (Playwright/Chromium)
                    │              │ - consumes jobs ││
                    │              │ - calls app API ││
                    │              └─────────────────┘│
                    └────────────────────────────────┘
```

---

*Last updated: Task 47-a — Deployment Infrastructure Builder*
