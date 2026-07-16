/**
 * Rate limiting simple en mémoire (par IP + par email)
 * En production : utiliser Redis pour distribuer le compteur
 */
import { NextRequest } from "next/server"

interface RateLimitEntry {
  count: number
  resetAt: number
  lockedUntil?: number
}

const store = new Map<string, RateLimitEntry>()
const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 5

/**
 * Vérifie et incrémente le compteur de rate limit
 * Retourne { allowed, remaining, resetAt, locked }
 */
export function checkRateLimit(
  key: string,
  opts?: { max?: number; windowMs?: number }
): {
  allowed: boolean
  remaining: number
  resetAt: number
  locked: boolean
} {
  const max = opts?.max || MAX_ATTEMPTS
  const windowMs = opts?.windowMs || WINDOW_MS
  const now = Date.now()

  // Cleanup périodique
  if (store.size > 10000) {
    for (const [k, v] of store) {
      if (v.resetAt < now) store.delete(k)
    }
  }

  const entry = store.get(key)

  // Locked
  if (entry?.lockedUntil && entry.lockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.lockedUntil,
      locked: true,
    }
  }

  // Reset window
  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs, locked: false }
  }

  // Increment
  entry.count++
  store.set(key, entry)

  if (entry.count > max) {
    entry.lockedUntil = now + windowMs
    store.set(key, entry)
    return { allowed: false, remaining: 0, resetAt: entry.lockedUntil, locked: true }
  }

  return {
    allowed: true,
    remaining: max - entry.count,
    resetAt: entry.resetAt,
    locked: false,
  }
}

/**
 * Reset le compteur après succès
 */
export function resetRateLimit(key: string): void {
  store.delete(key)
}

/**
 * Extrait une clé de rate limit depuis la request (IP + endpoint)
 */
export function getRateLimitKey(req: NextRequest, suffix?: string): string {
  const forwarded = req.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip") || "unknown"
  return `rl:${ip}${suffix ? ":" + suffix : ""}`
}
