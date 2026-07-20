#!/usr/bin/env node
/**
 * =============================================================================
 * scraper-worker.js — ScrapIQ CI Scraper Worker (standalone Node.js process)
 * =============================================================================
 *
 * Purpose:
 *   Consumes scraping jobs from a Redis queue and dispatches them to the
 *   Next.js app's scraper API endpoints. Runs in a separate Docker container
 *   (see docker-compose.yml → `scraper-worker` service) so that Chromium /
 *   Playwright memory usage is isolated from the web server.
 *
 * Architecture:
 *
 *   ┌──────────────┐   RPUSH    ┌─────────┐   BRPOP    ┌─────────────────┐
 *   │  Next.js API │ ─────────▶ │  Redis  │ ─────────▶ │  this worker    │
 *   │  (producer)  │            │ (queue) │            │  (consumer)     │
 *   └──────────────┘            └─────────┘            └────────┬────────┘
 *                                                                │ HTTP POST
 *                                                                ▼
 *                                                        ┌──────────────┐
 *                                                        │ Next.js API  │
 *                                                        │ /api/scraper │
 *                                                        └──────────────┘
 *
 * Job format (JSON, pushed to Redis list "scraapiq:scraper:queue"):
 *   {
 *     "id":        "job-uuid",
 *     "type":      "google-maps" | "facebook" | "website" | "business" | "ai-cleaner",
 *     "params":    { "keyword": "...", "city": "...", "commune": "..." },
 *     "callbackUrl": "http://app:3000/api/scraper/jobs/job-uuid/complete",
 *     "createdAt": "2025-01-15T10:30:00.000Z"
 *   }
 *
 * Fallback mode:
 *   If ioredis is unavailable (e.g. the module wasn't bundled into the
 *   standalone output), the worker falls back to HTTP polling: every
 *   POLL_INTERVAL_SECONDS it calls GET {APP_URL}/api/scraper/jobs?status=queued
 *   and processes any queued jobs it finds.
 *
 * Usage:
 *   node scripts/scraper-worker.js
 *
 * Environment variables:
 *   REDIS_URL              — Redis connection string (e.g. redis://redis:6379)
 *   APP_URL                — Base URL of the Next.js app (default: http://localhost:3000)
 *   WORKER_ID              — Unique worker identifier (default: worker-{hostname}-{pid})
 *   WORKER_CONCURRENCY     — Number of concurrent jobs (default: 1; Chromium is memory-heavy)
 *   BRPOP_TIMEOUT_SECONDS  — BRPOP block timeout (default: 30)
 *   POLL_INTERVAL_SECONDS  — Fallback polling interval (default: 15)
 *   LOG_LEVEL              — debug | info | warn | error (default: info)
 *
 * Graceful shutdown:
 *   On SIGTERM / SIGINT the worker stops accepting new jobs, waits for
 *   in-flight jobs to finish (up to 60s), then exits cleanly.
 * =============================================================================
 */

'use strict';

const http = require('http');
const https = require('https');
const { URL } = require('url');
const os = require('os');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const REDIS_URL = process.env.REDIS_URL || '';
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const WORKER_ID = process.env.WORKER_ID || `worker-${os.hostname()}-${process.pid}`;
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '1', 10);
const BRPOP_TIMEOUT = parseInt(process.env.BRPOP_TIMEOUT_SECONDS || '30', 10);
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_SECONDS || '15', 10);
const LOG_LEVEL = (process.env.LOG_LEVEL || 'info').toLowerCase();
const QUEUE_KEY = 'scraapiq:scraper:queue';

const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

function log(level, message, extra) {
  if (LOG_LEVELS[level] < LOG_LEVELS[LOG_LEVEL]) return;
  const ts = new Date().toISOString();
  const line = JSON.stringify({
    ts,
    level,
    worker: WORKER_ID,
    msg: message,
    ...(extra || {}),
  });
  console.log(line);
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let ioredisClient = null;
let isShuttingDown = false;
let activeJobs = 0;
let jobsProcessed = 0;
let jobsFailed = 0;
let startTime = Date.now();

// ---------------------------------------------------------------------------
// HTTP helper — calls the Next.js app API
// ---------------------------------------------------------------------------
function httpPost(targetUrl, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const lib = url.protocol === 'https:' ? https : http;
    const payload = JSON.stringify(body);
    const options = {
      method: 'POST',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-Worker-Id': WORKER_ID,
      },
      timeout: 120000, // 2 min — Chromium jobs can be slow
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ raw: data });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Request timeout (120s)'));
    });
    req.write(payload);
    req.end();
  });
}

function httpGet(targetUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetUrl);
    const lib = url.protocol === 'https:' ? https : http;
    const options = {
      method: 'GET',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: { 'X-Worker-Id': WORKER_ID },
      timeout: 30000,
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ raw: data });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Request timeout (30s)'));
    });
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Job processing
// ---------------------------------------------------------------------------
const SCRAPER_ENDPOINTS = {
  'google-maps': '/api/scraper/google-maps',
  facebook: '/api/scraper/facebook',
  website: '/api/scraper/website',
  business: '/api/scraper/business',
  'ai-cleaner': '/api/scraper/ai-cleaner',
};

async function processJob(job) {
  const jobType = job.type || 'unknown';
  const endpoint = SCRAPER_ENDPOINTS[jobType];

  if (!endpoint) {
    log('warn', `Unknown job type: ${jobType}`, { jobId: job.id });
    throw new Error(`Unknown job type: ${jobType}`);
  }

  const targetUrl = `${APP_URL}${endpoint}`;
  log('info', `Processing job`, { jobId: job.id, type: jobType, endpoint });

  const response = await httpPost(targetUrl, {
    ...job.params,
    jobId: job.id,
    workerId: WORKER_ID,
  });

  // Notify completion callback if provided
  if (job.callbackUrl) {
    try {
      await httpPost(job.callbackUrl, {
        jobId: job.id,
        status: 'completed',
        result: response,
        workerId: WORKER_ID,
      });
    } catch (err) {
      log('warn', `Callback failed (non-fatal)`, { jobId: job.id, callbackUrl: job.callbackUrl, error: err.message });
    }
  }

  jobsProcessed++;
  log('info', `Job completed`, { jobId: job.id, type: jobType });
  return response;
}

// ---------------------------------------------------------------------------
// Redis-based consumer (primary mode)
// ---------------------------------------------------------------------------
async function startRedisConsumer() {
  let Redis;
  try {
    // ioredis is bundled in the Next.js standalone output (dynamic import
    // in src/lib/queue/config.ts). We require it synchronously here.
    Redis = require('ioredis');
  } catch (err) {
    log('warn', `ioredis module not available — falling back to HTTP polling`, { error: err.message });
    return false;
  }

  if (!REDIS_URL) {
    log('warn', 'REDIS_URL not set — falling back to HTTP polling');
    return false;
  }

  log('info', 'Connecting to Redis', { redisUrl: REDIS_URL.replace(/:[^:@]+@/, ':***@') });

  ioredisClient = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ / BRPOP
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  });

  return new Promise((resolve) => {
    ioredisClient.on('ready', () => {
      log('info', 'Connected to Redis — starting BRPOP consumer loop', { queueKey: QUEUE_KEY });
      resolve(true);
      brpopLoop();
    });

    ioredisClient.on('error', (err) => {
      log('error', 'Redis error', { error: err.message });
    });

    ioredisClient.on('reconnecting', (delay) => {
      log('warn', `Redis reconnecting in ${delay}ms`);
    });

    // If connection doesn't establish within 10s, fall back to polling.
    setTimeout(() => {
      if (!ioredisClient || ioredisClient.status !== 'ready') {
        log('warn', 'Redis connection timeout — falling back to HTTP polling');
        resolve(false);
        startHttpPolling();
      }
    }, 10000);
  });
}

async function brpopLoop() {
  while (!isShuttingDown) {
    if (activeJobs >= CONCURRENCY) {
      await sleep(1000);
      continue;
    }

    try {
      // BRPOP blocks for BRPOP_TIMEOUT seconds, then returns null if no job.
      const result = await ioredisClient.brpop(QUEUE_KEY, BRPOP_TIMEOUT);

      if (!result) {
        // Timeout — no job available, loop again.
        continue;
      }

      const [, jobJson] = result;
      let job;
      try {
        job = JSON.parse(jobJson);
      } catch (err) {
        log('error', 'Failed to parse job JSON', { raw: jobJson.slice(0, 200), error: err.message });
        continue;
      }

      // Process concurrently (don't await — allows multiple jobs in parallel)
      activeJobs++;
      processJob(job)
        .catch((err) => {
          jobsFailed++;
          log('error', `Job failed`, { jobId: job.id, type: job.type, error: err.message });
        })
        .finally(() => {
          activeJobs--;
        });
    } catch (err) {
      log('error', 'BRPOP error', { error: err.message });
      await sleep(5000); // back off before retrying
    }
  }

  log('info', 'BRPOP consumer loop stopped (shutdown)');
}

// ---------------------------------------------------------------------------
// HTTP polling fallback (when Redis is unavailable)
// ---------------------------------------------------------------------------
async function startHttpPolling() {
  log('info', `Starting HTTP polling consumer`, { appUrl: APP_URL, intervalSec: POLL_INTERVAL });

  while (!isShuttingDown) {
    try {
      if (activeJobs < CONCURRENCY) {
        const response = await httpGet(`${APP_URL}/api/scraper/jobs?status=queued&limit=${CONCURRENCY - activeJobs}`);

        if (response && Array.isArray(response.jobs) && response.jobs.length > 0) {
          for (const job of response.jobs) {
            activeJobs++;
            processJob(job)
              .catch((err) => {
                jobsFailed++;
                log('error', `Job failed`, { jobId: job.id, error: err.message });
              })
              .finally(() => {
                activeJobs--;
              });
          }
        }
      }
    } catch (err) {
      log('warn', `Polling failed`, { error: err.message });
    }

    await sleep(POLL_INTERVAL * 1000);
  }

  log('info', 'HTTP polling consumer stopped (shutdown)');
}

// ---------------------------------------------------------------------------
// Health metrics (logged periodically)
// ---------------------------------------------------------------------------
function startMetricsLogger() {
  setInterval(() => {
    const uptimeSec = Math.floor((Date.now() - startTime) / 1000);
    const memUsage = process.memoryUsage();
    log('info', 'Worker metrics', {
      uptimeSec,
      activeJobs,
      jobsProcessed,
      jobsFailed,
      rssMb: Math.round(memUsage.rss / 1024 / 1024),
      heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMb: Math.round(memUsage.heapTotal / 1024 / 1024),
      redisConnected: ioredisClient ? ioredisClient.status === 'ready' : false,
    });
  }, 60000); // every 60s
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log('warn', `Received ${signal} — shutting down gracefully`, {
    activeJobs,
    jobsProcessed,
    jobsFailed,
  });

  // Wait up to 60s for in-flight jobs to finish.
  const shutdownDeadline = Date.now() + 60000;
  while (activeJobs > 0 && Date.now() < shutdownDeadline) {
    log('info', `Waiting for ${activeJobs} in-flight job(s) to finish...`);
    await sleep(2000);
  }

  if (activeJobs > 0) {
    log('error', `${activeJobs} job(s) still running after 60s — forcing exit`);
  }

  if (ioredisClient) {
    try {
      await ioredisClient.quit();
      log('info', 'Redis connection closed');
    } catch (err) {
      log('warn', `Error closing Redis: ${err.message}`);
    }
  }

  log('info', 'Shutdown complete — exiting');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  log('error', 'Uncaught exception', { error: err.message, stack: err.stack });
});
process.on('unhandledRejection', (reason) => {
  log('error', 'Unhandled rejection', { reason: String(reason) });
});

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  log('info', 'ScrapIQ CI — Scraper Worker starting', {
    workerId: WORKER_ID,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    concurrency: CONCURRENCY,
    appUrl: APP_URL,
    redisUrlSet: !!REDIS_URL,
  });

  // Sanity check: can we reach the Next.js app?
  try {
    await httpGet(`${APP_URL}/api/health`);
    log('info', 'App health check OK');
  } catch (err) {
    log('warn', `App not reachable at ${APP_URL} — will retry`, { error: err.message });
  }

  startMetricsLogger();

  // Try Redis first; fall back to HTTP polling if unavailable.
  const redisStarted = await startRedisConsumer();
  if (!redisStarted) {
    await startHttpPolling();
  }
}

main().catch((err) => {
  log('error', 'Fatal startup error', { error: err.message, stack: err.stack });
  process.exit(1);
});
