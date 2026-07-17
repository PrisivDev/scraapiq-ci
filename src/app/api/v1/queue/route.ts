/**
 * API routes pour le monitoring des queues
 *
 * GET  /api/v1/queue          — metrics globaux + par queue
 * GET  /api/v1/queue/workers  — stats workers
 * POST /api/v1/queue/jobs     — ajoute un job à une queue
 * GET  /api/v1/queue/jobs/[id] — statut d'un job
 * POST /api/v1/queue/test     — envoie des jobs de test sur toutes les queues
 */

import { NextRequest } from "next/server"
import { queueManager } from "@/lib/queue/queue-manager"
import { initProcessors } from "@/lib/queue/processors"
import { QUEUE_CONFIGS, type QueueName } from "@/lib/queue/config"
import { jsonResponse, errorResponse } from "@/lib/auth/helpers"

// Initialise les processors au premier appel
let processorsInitialized = false
async function ensureInit() {
  if (!processorsInitialized) {
    await initProcessors()
    processorsInitialized = true
  }
}

/** GET /api/v1/queue — metrics globaux */
export async function GET(req: NextRequest) {
  await ensureInit()
  const { searchParams } = new URL(req.url)
  const view = searchParams.get("view")

  if (view === "workers") {
    return jsonResponse({
      workers: queueManager.getWorkerStats(),
      total: queueManager.getWorkerStats().length,
    })
  }

  const metrics = queueManager.getMetrics()
  const total = queueManager.getTotalMetrics()
  const configs = Object.values(QUEUE_CONFIGS)

  return jsonResponse({
    total,
    queues: metrics.map((m) => ({
      ...m,
      config: configs.find((c) => c.name === m.queueName),
    })),
    redis: {
      available: queueManager.isRedisAvailable(),
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
    },
  })
}

/** POST /api/v1/queue — ajoute un job ou lance un test */
export async function POST(req: NextRequest) {
  await ensureInit()
  const body = await req.json()
  const { action } = body

  // Test : envoie des jobs sur toutes les queues
  if (action === "test") {
    const jobs: Array<{ id: string; queue: QueueName; name: string; priority: number }> = []
    const testJobs: Array<{ queue: QueueName; name: string; data: Record<string, unknown>; priority: number }> = [
      { queue: "scraping", name: "test-scrape", data: { keyword: "restaurant", city: "Abidjan", source: "google-maps" }, priority: 10 },
      { queue: "ai-cleaner", name: "test-clean", data: { entities: [{ id: "1", name: "Test" }] }, priority: 5 },
      { queue: "export", name: "test-export", data: { format: "xlsx", filename: "test.xlsx" }, priority: 10 },
      { queue: "notifications", name: "test-notif", data: { channel: "email", title: "Test", recipient: "test@example.com" }, priority: 1 },
      { queue: "reports", name: "test-report", data: { reportType: "daily", format: "pdf" }, priority: 20 },
    ]

    for (const testJob of testJobs) {
      const job = await queueManager.addJob(testJob.queue, testJob.name, testJob.data, {
        priority: testJob.priority,
      })
      jobs.push({
        id: job.id,
        queue: testJob.queue,
        name: testJob.name,
        priority: testJob.priority,
      })
    }

    return jsonResponse({
      success: true,
      message: "5 jobs de test envoyés sur 5 queues",
      jobs,
    }, { status: 202 })
  }

  // Ajout d'un job standard
  const { queue: queueName, name: jobName, data, priority } = body
  if (!queueName || !jobName) {
    return errorResponse("queue et name requis", 400)
  }
  if (!QUEUE_CONFIGS[queueName as QueueName]) {
    return errorResponse(`Queue "${queueName}" invalide`, 400)
  }

  const job = await queueManager.addJob(
    queueName as QueueName,
    jobName,
    data || {},
    { priority: priority ?? QUEUE_CONFIGS[queueName as QueueName].defaultPriority }
  )

  return jsonResponse({
    success: true,
    jobId: job.id,
    queue: queueName,
    name: jobName,
    priority: job.priority,
    status: job.status,
    message: `Job ajouté à la queue "${queueName}"`,
  }, { status: 202 })
}
