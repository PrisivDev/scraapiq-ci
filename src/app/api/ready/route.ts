/**
 * Readiness probe — GET /api/ready
 *
 * Confirms that ALL critical dependencies are reachable:
 *   1. Database (Prisma)  — `SELECT 1` with a 3s timeout
 *   2. Redis (optional)   — ping if REDIS_URL or REDIS_HOST is set,
 *                           otherwise marked as "skipped" (dev mode)
 *   3. z-ai SDK config    — verify ZAI_API_KEY env var is present
 *                           (no API call — too slow / rate-limited)
 *
 * Returns 200 if every check is OK, 503 if any fails.
 *
 * Used by load balancers (Caddy / Kubernetes / Cloudflare) as the
 * "readiness" probe — if this fails, the LB stops sending traffic
 * but does NOT restart the pod.
 *
 * Target response time: < 3.5s (gated by TIMEOUT_MS).
 */
import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const TIMEOUT_MS = 3000

interface CheckResult {
  ok: boolean
  latencyMs: number
  error?: string
  [k: string]: unknown
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<CheckResult> {
  const start = Date.now()
  try {
    await Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`${label} timeout after ${ms}ms`)),
          ms
        )
      ),
    ])
    return { ok: true, latencyMs: Date.now() - start }
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

/**
 * Pings Redis using ioredis. Supports both REDIS_URL (full URL) and
 * REDIS_HOST/REDIS_PORT/REDIS_PASSWORD (separate env vars) — this mirrors
 * the dual configuration documented in .env.example.
 *
 * Dynamic import so the route does not break if ioredis is missing.
 */
async function pingRedis(): Promise<CheckResult> {
  const start = Date.now()
  let redis: import("ioredis").default | null = null
  try {
    const Redis = (await import("ioredis")).default
    const url = process.env.REDIS_URL
    redis = url
      ? new Redis(url, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          connectTimeout: TIMEOUT_MS,
          retryStrategy: () => null,
        })
      : new Redis({
          host: process.env.REDIS_HOST || "localhost",
          port: parseInt(process.env.REDIS_PORT || "6379", 10),
          password: process.env.REDIS_PASSWORD || undefined,
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          connectTimeout: TIMEOUT_MS,
          retryStrategy: () => null,
        })

    await redis.connect()
    const pong = await redis.ping()
    return {
      ok: pong === "PONG",
      latencyMs: Date.now() - start,
    }
  } catch (e) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    }
  } finally {
    if (redis) {
      try {
        redis.disconnect()
      } catch {
        /* noop */
      }
    }
  }
}

export async function GET() {
  const checks: Record<string, CheckResult> = {}
  let allOk = true

  // 1. Database (Prisma) — `SELECT 1`
  const dbCheck = await withTimeout(
    db.$queryRaw`SELECT 1` as Promise<unknown>,
    TIMEOUT_MS,
    "database"
  )
  checks.database = dbCheck
  if (!dbCheck.ok) allOk = false

  // 2. Redis (optional in dev)
  const hasRedisConfig = !!process.env.REDIS_URL || !!process.env.REDIS_HOST
  if (hasRedisConfig) {
    const redisCheck = await pingRedis()
    checks.redis = redisCheck
    if (!redisCheck.ok) allOk = false
  } else {
    checks.redis = {
      ok: true,
      latencyMs: 0,
      skipped: true,
      reason: "REDIS_URL / REDIS_HOST not set (dev mode)",
    }
  }

  // 3. z-ai SDK config — env var presence only (no API call)
  if (process.env.ZAI_API_KEY && process.env.ZAI_API_KEY.trim().length > 0) {
    checks.zai = { ok: true, latencyMs: 0, configured: true }
  } else {
    checks.zai = {
      ok: false,
      latencyMs: 0,
      configured: false,
      error: "ZAI_API_KEY not set",
    }
    allOk = false
  }

  const status = allOk ? 200 : 503
  return NextResponse.json(
    {
      status: allOk ? "ready" : "not_ready",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status }
  )
}
