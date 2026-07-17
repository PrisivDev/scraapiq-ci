/**
 * Configuration du système de queues distribué
 * — BullMQ + Redis (ou fallback mémoire si Redis indisponible)
 *
 * Architecture :
 *  ┌──────────┐     ┌─────────┐     ┌──────────┐
 *  │ Producer │ ──▶ │  Redis  │ ──▶ │  Worker  │
 *  │ (API)    │     │ (Queue) │     │ (Processor)│
 *  └──────────┘     └─────────┘     └──────────┘
 *                        │
 *                   ┌────┴────┐
 *                   │ Metrics │
 *                   │ (BullMQ)│
 *                   └─────────┘
 *
 * Queues :
 *  - scraping : jobs de scraping (Google Maps, Facebook, LinkedIn, Web)
 *  - ai-cleaner : nettoyage IA (dédup, enrichissement, scoring)
 *  - export : génération d'exports (xlsx, csv, pdf, json, zip)
 *  - notifications : envoi multi-canal (email, SMS, WhatsApp, push, webhook)
 *  - reports : rapports automatiques planifiés
 *
 * Priorités :
 *  - 1 (critical) : alertes, notifications critiques
 *  - 5 (high) : scraping IA, nettoyage
 *  - 10 (normal) : scraping standard, exports
 *  - 20 (low) : rapports planifiés, maintenance
 *
 * Retry :
 *  - Tentatives : 3 (configurable par job)
 *  - Backoff : exponentiel (1s, 4s, 16s)
 *  - Max durée : 5 min par job
 *
 * Parallélisme :
 *  - scraping : 3 workers concurrents
 *  - ai-cleaner : 2 workers
 *  - export : 2 workers
 *  - notifications : 5 workers
 *  - reports : 1 worker
 */

export type QueueName = "scraping" | "ai-cleaner" | "export" | "notifications" | "reports"

export interface QueueConfig {
  name: QueueName
  label: string
  concurrency: number
  maxRetries: number
  backoffType: "exponential" | "fixed"
  backoffDelay: number // ms
  maxJobDuration: number // ms
  defaultPriority: number
  description: string
  color: string
}

export const QUEUE_CONFIGS: Record<QueueName, QueueConfig> = {
  scraping: {
    name: "scraping",
    label: "Scraping",
    concurrency: 3,
    maxRetries: 3,
    backoffType: "exponential",
    backoffDelay: 2000,
    maxJobDuration: 300000, // 5 min
    defaultPriority: 10,
    description: "Jobs de scraping Google Maps, Facebook, LinkedIn, Sites web",
    color: "#10b981",
  },
  "ai-cleaner": {
    name: "ai-cleaner",
    label: "IA Cleaner",
    concurrency: 2,
    maxRetries: 2,
    backoffType: "exponential",
    backoffDelay: 3000,
    maxJobDuration: 180000, // 3 min
    defaultPriority: 5,
    description: "Nettoyage IA : dédup, enrichissement, scoring, détection fermetures",
    color: "#8b5cf6",
  },
  export: {
    name: "export",
    label: "Export",
    concurrency: 2,
    maxRetries: 2,
    backoffType: "fixed",
    backoffDelay: 1000,
    maxJobDuration: 120000, // 2 min
    defaultPriority: 10,
    description: "Génération d'exports Excel, CSV, PDF, JSON, ZIP",
    color: "#f97316",
  },
  notifications: {
    name: "notifications",
    label: "Notifications",
    concurrency: 5,
    maxRetries: 3,
    backoffType: "exponential",
    backoffDelay: 500,
    maxJobDuration: 30000, // 30s
    defaultPriority: 1,
    description: "Envoi multi-canal : email, SMS, WhatsApp, push, webhook",
    color: "#3b82f6",
  },
  reports: {
    name: "reports",
    label: "Rapports",
    concurrency: 1,
    maxRetries: 1,
    backoffType: "fixed",
    backoffDelay: 5000,
    maxJobDuration: 300000, // 5 min
    defaultPriority: 20,
    description: "Rapports automatiques planifiés (daily, weekly, monthly)",
    color: "#ec4899",
  },
}

/** Priorités BullMQ (1 = plus prioritaire) */
export const PRIORITY = {
  CRITICAL: 1,
  HIGH: 5,
  NORMAL: 10,
  LOW: 20,
} as const

/** Connexion Redis — utilise ioredis si disponible, sinon fallback mémoire */
export const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // requis par BullMQ
  enableReadyCheck: true,
  retryStrategy: (times: number) => Math.min(times * 500, 5000),
}

/** Tente de se connecter à Redis, retourne true si disponible */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const Redis = (await import("ioredis")).default
    const redis = new Redis({
      ...REDIS_CONFIG,
      retryStrategy: () => null, // pas de retry pour le check
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    })
    await redis.connect()
    const pong = await redis.ping()
    await redis.disconnect()
    return pong === "PONG"
  } catch {
    return false
  }
}
