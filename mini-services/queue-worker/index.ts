/**
 * Mini-service Worker — ScrapIQ CI Queue Worker
 * Port: 3003
 *
 * Service indépendant qui :
 *  1. Initialise les processors pour toutes les queues
 *  2. Surveille les jobs en temps réel
 *  3. Expose un endpoint de health check
 *  4. Auto-scaling : ajuste le nombre de workers selon la charge
 *
 * Démarrage : bun run dev (dans mini-services/queue-worker/)
 */

import { queueManager, type QueueMetrics } from "../../src/lib/queue/queue-manager"
import { initProcessors } from "../../src/lib/queue/processors"
import { QUEUE_CONFIGS, type QueueName } from "../../src/lib/queue/config"

const PORT = 3003

async function main() {
  console.log("🚀 ScrapIQ CI — Queue Worker Service")
  console.log(`📡 Port: ${PORT}`)
  console.log("")

  // Initialise les processors
  await initProcessors()
  console.log("✓ Processors initialisés")

  // Affiche la config
  console.log("")
  console.log("📋 Configuration des queues:")
  for (const config of Object.values(QUEUE_CONFIGS)) {
    console.log(`  ${config.label}:`)
    console.log(`    Workers: ${config.concurrency}`)
    console.log(`    Retry: ${config.maxRetries} (backoff: ${config.backoffType} ${config.backoffDelay}ms)`)
    console.log(`    Priorité défaut: ${config.defaultPriority}`)
    console.log(`    Max durée: ${config.maxJobDuration / 1000}s`)
  }
  console.log("")

  // Auto-scaling monitor
  let autoScaleEnabled = true
  const originalConcurrency: Record<string, number> = {}
  for (const [name, config] of Object.entries(QUEUE_CONFIGS)) {
    originalConcurrency[name] = config.concurrency
  }

  setInterval(() => {
    const metrics = queueManager.getMetrics()
    const total = queueManager.getTotalMetrics()

    // Log périodique
    console.log(`[${new Date().toISOString()}] Queue Status:`)
    console.log(`  Total: ${total.totalWaiting} waiting, ${total.totalActive} active, ${total.totalCompleted} completed, ${total.totalFailed} failed`)
    console.log(`  Throughput: ${total.totalThroughput} jobs/min`)

    for (const m of metrics) {
      const config = QUEUE_CONFIGS[m.queueName]
      if (m.waiting > 0 || m.active > 0) {
        console.log(`  ${config.label}: ${m.waiting} waiting, ${m.active} active, ${m.throughput} jobs/min`)
      }
    }

    // Auto-scaling : si une queue a beaucoup de jobs en attente, alerte
    if (autoScaleEnabled) {
      for (const m of metrics) {
        if (m.waiting > 10) {
          console.log(`  ⚠️ Auto-scale: ${m.queueName} a ${m.waiting} jobs en attente — considère ajouter des workers`)
        }
      }
    }

    // Cleanup
    queueManager.cleanup()
  }, 5000)

  // HTTP server (health check + metrics)
  const server = Bun.serve({
    port: PORT,
    async fetch(req) {
      const url = new URL(req.url)

      // Health check
      if (url.pathname === "/health") {
        return new Response(JSON.stringify({
          status: "ok",
          service: "queue-worker",
          port: PORT,
          uptime: process.uptime(),
          redis: queueManager.isRedisAvailable() ? "connected" : "fallback-memory",
          timestamp: new Date().toISOString(),
        }), {
          headers: { "Content-Type": "application/json" },
        })
      }

      // Metrics
      if (url.pathname === "/metrics") {
        const metrics = queueManager.getMetrics()
        const workers = queueManager.getWorkerStats()
        const total = queueManager.getTotalMetrics()
        return new Response(JSON.stringify({
          total,
          queues: metrics,
          workers,
          redis: {
            available: queueManager.isRedisAvailable(),
            mode: queueManager.isRedisAvailable() ? "bullmq" : "memory-fallback",
          },
        }, null, 2), {
          headers: { "Content-Type": "application/json" },
        })
      }

      // Workers detail
      if (url.pathname === "/workers") {
        const workers = queueManager.getWorkerStats()
        return new Response(JSON.stringify({
          workers,
          total: workers.length,
          byQueue: Object.values(QUEUE_CONFIGS).map((c) => ({
            queue: c.name,
            label: c.label,
            concurrency: c.concurrency,
            workers: workers.filter((w) => w.queueName === c.name),
          })),
        }, null, 2), {
          headers: { "Content-Type": "application/json" },
        })
      }

      return new Response("ScrapIQ CI Queue Worker\n\nEndpoints:\n  GET /health\n  GET /metrics\n  GET /workers", {
        headers: { "Content-Type": "text/plain" },
      })
    },
  })

  console.log(`✓ Worker service démarré sur http://localhost:${PORT}`)
  console.log(`  GET /health — Health check`)
  console.log(`  GET /metrics — Metrics détaillés`)
  console.log(`  GET /workers — Statut des workers`)
  console.log("")
  console.log("🔄 Auto-scaling monitor actif (vérification toutes les 5s)")
}

main().catch(console.error)
