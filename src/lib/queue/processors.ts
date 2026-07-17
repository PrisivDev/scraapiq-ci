/**
 * Processors — logique métier exécutée par les workers
 *
 * Chaque processor :
 *  - Reçoit un job avec ses données
 *  - Exécute la logique (scraping, IA, export, notifications, reports)
 *  - Met à jour la progression via updateProgress(pct)
 *  - Retourne le résultat (stocké dans job.result)
 *  - Lève une erreur en cas d'échec (→ retry automatique)
 */

import { queueManager } from "./queue-manager"
import { QUEUE_CONFIGS } from "./config"

/**
 * Initialise tous les processors
 */
export async function initProcessors() {
  await queueManager.init()

  // Processor: Scraping
  queueManager.setProcessor("scraping", async (job, updateProgress) => {
    updateProgress(10)
    // Simule un job de scraping (en production: appelle GoogleMapsScraper, FacebookScraper, etc.)
    const { keyword, city, commune, source } = job.data as {
      keyword?: string
      city?: string
      commune?: string
      source?: string
    }

    updateProgress(30)
    // Simulation du scraping
    await sleep(1000)
    updateProgress(60)
    await sleep(500)
    updateProgress(90)
    await sleep(300)
    updateProgress(100)

    return {
      jobId: job.id,
      keyword,
      city,
      commune,
      source,
      resultsCount: Math.floor(Math.random() * 50) + 5,
      durationMs: 1800,
    }
  })

  // Processor: IA Cleaner
  queueManager.setProcessor("ai-cleaner", async (job, updateProgress) => {
    updateProgress(10)
    const { entities } = job.data as { entities?: unknown[] }
    updateProgress(25)
    // Simulation du pipeline IA
    await sleep(800)
    updateProgress(50)
    await sleep(600)
    updateProgress(75)
    await sleep(400)
    updateProgress(90)
    await sleep(200)
    updateProgress(100)

    return {
      jobId: job.id,
      inputCount: Array.isArray(entities) ? entities.length : 10,
      cleanedCount: Math.floor((Array.isArray(entities) ? entities.length : 10) * 0.85),
      duplicatesRemoved: Math.floor((Array.isArray(entities) ? entities.length : 10) * 0.15),
      score: 78,
      llmCalls: 5,
    }
  })

  // Processor: Export
  queueManager.setProcessor("export", async (job, updateProgress) => {
    updateProgress(10)
    const { format, filename } = job.data as { format?: string; filename?: string }
    updateProgress(30)
    await sleep(500)
    updateProgress(60)
    await sleep(300)
    updateProgress(90)
    await sleep(200)
    updateProgress(100)

    return {
      jobId: job.id,
      format: format || "xlsx",
      filename: filename || "export.xlsx",
      fileSizeBytes: Math.floor(Math.random() * 50000) + 5000,
      rowsExported: Math.floor(Math.random() * 100) + 10,
    }
  })

  // Processor: Notifications
  queueManager.setProcessor("notifications", async (job, updateProgress) => {
    updateProgress(20)
    const { channel, title, recipient } = job.data as {
      channel?: string
      title?: string
      recipient?: string
    }
    updateProgress(50)
    await sleep(200)
    updateProgress(80)
    await sleep(100)
    updateProgress(100)

    return {
      jobId: job.id,
      channel: channel || "email",
      title: title || "Notification",
      recipient: recipient || "user@example.com",
      status: "sent",
      messageId: `msg-${Date.now()}`,
    }
  })

  // Processor: Reports
  queueManager.setProcessor("reports", async (job, updateProgress) => {
    updateProgress(10)
    const { reportType, format } = job.data as { reportType?: string; format?: string }
    updateProgress(30)
    await sleep(800)
    updateProgress(50)
    await sleep(600)
    updateProgress(70)
    await sleep(400)
    updateProgress(90)
    await sleep(300)
    updateProgress(100)

    return {
      jobId: job.id,
      reportType: reportType || "daily",
      format: format || "pdf",
      filename: `report_${reportType || "daily"}_${new Date().toISOString().slice(0, 10)}.${format || "pdf"}`,
      fileSizeBytes: Math.floor(Math.random() * 100000) + 10000,
      generatedAt: new Date().toISOString(),
    }
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
