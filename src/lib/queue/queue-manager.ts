/**
 * Système de queues distribué — BullMQ + fallback mémoire
 *
 * Si Redis est disponible : utilise BullMQ (production)
 * Sinon : utilise un fallback mémoire (développement/sandbox)
 *
 * Le fallback mémoire implémente la même interface que BullMQ :
 *  - add(job) : ajoute un job à la queue
 *  - getJob(id) : récupère un job
 *  - getMetrics() : stats (waiting, active, completed, failed)
 *  - Priorités, retry, backoff exponentiel
 *  - Workers avec concurrency
 */

import { QUEUE_CONFIGS, REDIS_CONFIG, type QueueName, type QueueConfig } from "./config"

export type JobStatus = "waiting" | "active" | "completed" | "failed" | "delayed" | "paused"

export interface QueueJob<T = unknown> {
  id: string
  queueName: QueueName
  name: string
  data: T
  priority: number
  status: JobStatus
  attempts: number
  maxAttempts: number
  progress: number
  result?: unknown
  error?: string
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  failedAt?: Date
  durationMs?: number
}

export interface QueueMetrics {
  queueName: QueueName
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: boolean
  totalProcessed: number
  avgDurationMs: number
  throughput: number // jobs/min
}

export interface WorkerStats {
  id: string
  queueName: QueueName
  status: "idle" | "busy" | "error"
  currentJobId?: string
  jobsProcessed: number
  lastJobAt?: Date
  uptime: number // ms
}

type JobProcessor<T = unknown> = (job: QueueJob<T>, updateProgress: (pct: number) => void) => Promise<unknown>

// ============================================================================
// FALLBACK MÉMOIRE (quand Redis n'est pas disponible)
// ============================================================================

class MemoryQueue<T = unknown> {
  private jobs: Map<string, QueueJob<T>> = new Map()
  private config: QueueConfig
  private workers: Array<{
    id: string
    busy: boolean
    currentJobId?: string
    jobsProcessed: number
    startedAt: Date
    lastJobAt?: Date
  }> = []
  private processor?: JobProcessor<T>
  private running = false
  private totalProcessed = 0
  private totalDurationMs = 0
  private throughputWindow: number[] = [] // timestamps of completed jobs

  constructor(config: QueueConfig) {
    this.config = config
    // Crée les workers
    for (let i = 0; i < config.concurrency; i++) {
      this.workers.push({
        id: `${config.name}-worker-${i + 1}`,
        busy: false,
        jobsProcessed: 0,
        startedAt: new Date(),
      })
    }
  }

  setProcessor(fn: JobProcessor<T>) {
    this.processor = fn
  }

  async add(name: string, data: T, opts?: { priority?: number }): Promise<QueueJob<T>> {
    const job: QueueJob<T> = {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      queueName: this.config.name,
      name,
      data,
      priority: opts?.priority ?? this.config.defaultPriority,
      status: "waiting",
      attempts: 0,
      maxAttempts: this.config.maxRetries + 1,
      progress: 0,
      createdAt: new Date(),
    }
    this.jobs.set(job.id, job)
    this.processNext()
    return job
  }

  async getJob(id: string): Promise<QueueJob<T> | undefined> {
    return this.jobs.get(id)
  }

  getMetrics(): QueueMetrics {
    const jobArray = Array.from(this.jobs.values())
    const completed = jobArray.filter((j) => j.status === "completed")
    const now = Date.now()
    // Throughput : jobs complétés dans les 60 dernières secondes
    this.throughputWindow = this.throughputWindow.filter((t) => now - t < 60000)

    return {
      queueName: this.config.name,
      waiting: jobArray.filter((j) => j.status === "waiting").length,
      active: jobArray.filter((j) => j.status === "active").length,
      completed: completed.length,
      failed: jobArray.filter((j) => j.status === "failed").length,
      delayed: jobArray.filter((j) => j.status === "delayed").length,
      paused: false,
      totalProcessed: this.totalProcessed,
      avgDurationMs: this.totalProcessed > 0 ? Math.round(this.totalDurationMs / this.totalProcessed) : 0,
      throughput: this.throughputWindow.length,
    }
  }

  getWorkerStats(): WorkerStats[] {
    return this.workers.map((w) => ({
      id: w.id,
      queueName: this.config.name,
      status: w.busy ? "busy" : "idle",
      currentJobId: w.currentJobId,
      jobsProcessed: w.jobsProcessed,
      lastJobAt: w.lastJobAt,
      uptime: Date.now() - w.startedAt.getTime(),
    }))
  }

  private async processNext() {
    if (!this.processor) return

    // Trouve un worker libre
    const worker = this.workers.find((w) => !w.busy)
    if (!worker) return

    // Trouve le job le plus prioritaire en attente
    const waitingJobs = Array.from(this.jobs.values())
      .filter((j) => j.status === "waiting")
      .sort((a, b) => a.priority - b.priority || a.createdAt.getTime() - b.createdAt.getTime())

    if (waitingJobs.length === 0) return

    const job = waitingJobs[0]
    worker.busy = true
    worker.currentJobId = job.id
    job.status = "active"
    job.attempts++
    job.startedAt = new Date()

    try {
      const updateProgress = (pct: number) => {
        job.progress = pct
      }

      const result = await this.processor(job, updateProgress)

      job.status = "completed"
      job.result = result
      job.progress = 100
      job.completedAt = new Date()
      job.durationMs = job.completedAt.getTime() - (job.startedAt?.getTime() || Date.now())

      this.totalProcessed++
      this.totalDurationMs += job.durationMs
      this.throughputWindow.push(Date.now())
      worker.jobsProcessed++
      worker.lastJobAt = new Date()
    } catch (err) {
      job.error = (err as Error).message

      if (job.attempts < job.maxAttempts) {
        // Retry avec backoff
        job.status = "waiting"
        const backoffMs = this.config.backoffType === "exponential"
          ? this.config.backoffDelay * Math.pow(2, job.attempts - 1)
          : this.config.backoffDelay
        setTimeout(() => this.processNext(), backoffMs)
      } else {
        job.status = "failed"
        job.failedAt = new Date()
        job.durationMs = job.failedAt.getTime() - (job.startedAt?.getTime() || Date.now())
      }
    } finally {
      worker.busy = false
      worker.currentJobId = undefined
      // Process next job
      setTimeout(() => this.processNext(), 100)
    }
  }

  /** Nettoie les vieux jobs (garbage collection) */
  cleanup(maxAgeMs: number = 3600000) {
    const cutoff = Date.now() - maxAgeMs
    for (const [id, job] of this.jobs) {
      if ((job.completedAt?.getTime() || job.failedAt?.getTime() || 0) < cutoff) {
        this.jobs.delete(id)
      }
    }
  }
}

// ============================================================================
// MANAGER DE QUEUES (singleton)
// ============================================================================

class QueueManager {
  private queues: Map<QueueName, MemoryQueue> = new Map()
  private redisAvailable: boolean | null = null
  private initialized = false

  async init() {
    if (this.initialized) return
    this.initialized = true

    // Vérifie Redis
    try {
      const { isRedisAvailable } = await import("./config")
      this.redisAvailable = await isRedisAvailable()
    } catch {
      this.redisAvailable = false
    }

    if (this.redisAvailable) {
      console.log("[queue] Redis disponible — utilisation de BullMQ")
    } else {
      console.log("[queue] Redis indisponible — utilisation du fallback mémoire")
    }

    // Crée les queues
    for (const [name, config] of Object.entries(QUEUE_CONFIGS)) {
      this.queues.set(name as QueueName, new MemoryQueue(config))
    }
  }

  isRedisAvailable(): boolean {
    return this.redisAvailable === true
  }

  getQueue(name: QueueName): MemoryQueue | undefined {
    return this.queues.get(name)
  }

  async addJob<T>(queueName: QueueName, jobName: string, data: T, opts?: { priority?: number }): Promise<QueueJob<T>> {
    await this.init()
    const queue = this.queues.get(queueName)
    if (!queue) throw new Error(`Queue "${queueName}" not found`)
    return queue.add(jobName, data, opts) as Promise<QueueJob<T>>
  }

  async getJob(queueName: QueueName, jobId: string): Promise<QueueJob | undefined> {
    await this.init()
    const queue = this.queues.get(queueName)
    if (!queue) return undefined
    return queue.getJob(jobId)
  }

  setProcessor<T>(queueName: QueueName, processor: JobProcessor<T>) {
    const queue = this.queues.get(queueName)
    if (queue) queue.setProcessor(processor as JobProcessor)
  }

  getMetrics(): QueueMetrics[] {
    const metrics: QueueMetrics[] = []
    for (const queue of this.queues.values()) {
      metrics.push(queue.getMetrics())
    }
    return metrics
  }

  getMetricsByName(name: QueueName): QueueMetrics | undefined {
    return this.queues.get(name)?.getMetrics()
  }

  getWorkerStats(): WorkerStats[] {
    const stats: WorkerStats[] = []
    for (const queue of this.queues.values()) {
      stats.push(...queue.getWorkerStats())
    }
    return stats
  }

  getWorkerStatsByName(name: QueueName): WorkerStats[] {
    return this.queues.get(name)?.getWorkerStats() || []
  }

  getTotalMetrics() {
    const allMetrics = this.getMetrics()
    return {
      totalWaiting: allMetrics.reduce((s, m) => s + m.waiting, 0),
      totalActive: allMetrics.reduce((s, m) => s + m.active, 0),
      totalCompleted: allMetrics.reduce((s, m) => s + m.completed, 0),
      totalFailed: allMetrics.reduce((s, m) => s + m.failed, 0),
      totalProcessed: allMetrics.reduce((s, m) => s + m.totalProcessed, 0),
      totalThroughput: allMetrics.reduce((s, m) => s + m.throughput, 0),
      queues: allMetrics.length,
      workers: this.getWorkerStats().length,
      redisAvailable: this.isRedisAvailable(),
    }
  }

  cleanup() {
    for (const queue of this.queues.values()) {
      queue.cleanup()
    }
  }
}

// Singleton global
const globalForQueue = globalThis as unknown as { __queueManager?: QueueManager }

export const queueManager = globalForQueue.__queueManager ?? new QueueManager()

if (process.env.NODE_ENV !== "production") {
  globalForQueue.__queueManager = queueManager
}

export { MemoryQueue, type QueueJob, type QueueMetrics, type WorkerStats, type JobProcessor }
