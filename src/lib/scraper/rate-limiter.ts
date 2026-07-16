/**
 * Rate limiter & proxies — gestion polie des requêtes et rotation d'IP
 */

export interface ProxyConfig {
  server: string // http://host:port
  username?: string
  password?: string
}

/**
 * Rate limiter token bucket par domaine
 * - Permet des bursts limités
 * - Garantit un délai minimum entre requêtes
 */
export class RateLimiter {
  private lastRequestAt = 0
  private requestCount = 0

  constructor(
    private minIntervalMs: number = 1500, // 1.5s entre requêtes par défaut
    private maxRequestsPerMinute: number = 20
  ) {}

  async waitForNextSlot(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequestAt
    const wait = this.minIntervalMs - elapsed
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait))
    }
    this.lastRequestAt = Date.now()
    this.requestCount++
  }

  get count(): number {
    return this.requestCount
  }
}

/**
 * Pool de proxies rotatifs
 * - Round-robin avec retry sur échec
 * - Marque un proxy comme défaillant après N échecs consécutifs
 */
export class ProxyPool {
  private proxies: ProxyConfig[]
  private index = 0
  private failures = new Map<string, number>()
  private maxFailures = 3
  private cooldownMs = 5 * 60 * 1000 // 5 min de cooldown après échecs
  private cooldowns = new Map<string, number>()

  constructor(proxies: ProxyConfig[] = []) {
    this.proxies = proxies
  }

  /**
   * Retourne le prochain proxy disponible
   */
  next(): ProxyConfig | null {
    if (this.proxies.length === 0) return null

    const now = Date.now()
    for (let i = 0; i < this.proxies.length; i++) {
      const proxy = this.proxies[this.index]
      this.index = (this.index + 1) % this.proxies.length
      const key = this.proxyKey(proxy)
      const cooldownUntil = this.cooldowns.get(key) || 0
      if (now > cooldownUntil) {
        return proxy
      }
    }
    return null // tous en cooldown
  }

  /**
   * Signale un échec sur un proxy
   */
  markFailure(proxy: ProxyConfig): void {
    const key = this.proxyKey(proxy)
    const count = (this.failures.get(key) || 0) + 1
    this.failures.set(key, count)
    if (count >= this.maxFailures) {
      this.cooldowns.set(key, Date.now() + this.cooldownMs)
      this.failures.set(key, 0)
    }
  }

  /**
   * Signale un succès sur un proxy
   */
  markSuccess(proxy: ProxyConfig): void {
    const key = this.proxyKey(proxy)
    this.failures.delete(key)
  }

  private proxyKey(proxy: ProxyConfig): string {
    return `${proxy.server}|${proxy.username || ""}`
  }

  get size(): number {
    return this.proxies.length
  }
}

/**
 * Liste de User-Agents réalistes pour rotation
 */
export const USER_AGENTS = [
  // Chrome 131 Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  // Chrome 131 macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  // Firefox 133 Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  // Edge 131 Windows
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
  // Safari macOS
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
]

/**
 * Retourne un user-agent aléatoire
 */
export function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

/**
 * Délai aléatoire human-like
 */
export async function humanDelay(minMs = 800, maxMs = 2500): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs
  await new Promise((r) => setTimeout(r, delay))
}

/**
 * Backoff exponentiel avec jitter
 */
export async function exponentialBackoff(
  attempt: number,
  baseMs = 1000,
  maxMs = 30000
): Promise<void> {
  const exp = Math.min(baseMs * Math.pow(2, attempt), maxMs)
  const jitter = Math.random() * 1000
  await new Promise((r) => setTimeout(r, exp + jitter))
}
