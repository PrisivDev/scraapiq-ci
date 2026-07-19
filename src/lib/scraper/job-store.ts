/**
 * Store en mémoire des jobs de scraping
 * (en production : Redis ou PostgreSQL)
 *
 * Permet :
 *  - Lancer un job asynchrone
 *  - Suivre sa progression (SSE ou polling)
 *  - Annuler un job
 *  - Récupérer les résultats
 */

import type { SearchQuery, ScrapeResult, ScrapeProgress, ScrapeEvent, ScrapedPlace } from "./types"

// Lazy import : GoogleMapsScraper (qui importe Playwright/Chromium) n'est chargé
// qu'au moment de lancer un job, pas quand on liste les jobs.
// Cela évite l'OOM quand l'API GET /api/scraper/jobs compile ce module.
type GoogleMapsScraperType = InstanceType<typeof import("./google-maps-scraper").GoogleMapsScraper>

interface JobState {
  id: string
  query: SearchQuery
  progress: ScrapeProgress
  result?: ScrapeResult
  scraper?: GoogleMapsScraperType // optionnel car lazy-loaded
  events: ScrapeEvent[] // derniers N events pour replay
  createdAt: string
}

// Utilise une variable globale pour persister entre les rechargements du dev server
// (même pattern que PrismaClient dans lib/db.ts)
const globalForScraper = globalThis as unknown as {
  __scraperJobs?: Map<string, JobState>
}

const jobs = globalForScraper.__scraperJobs ?? new Map<string, JobState>()

if (process.env.NODE_ENV !== "production") {
  globalForScraper.__scraperJobs = jobs
}

const MAX_EVENTS_KEPT = 50

/**
 * Lance un job de scraping
 *
 * Protection mémoire : limite à 1 job simultané (Chromium est gourmand).
 * Si un job est déjà en cours, on refuse (429).
 */
export async function startScrapeJob(jobId: string, query: SearchQuery): Promise<JobState> {
  // Protection : refuse si un job est déjà running (évite l'OOM)
  for (const [, existing] of jobs) {
    if (existing.progress.status === "running" || existing.progress.status === "queued") {
      throw new Error("Un job est déjà en cours. Attendez la fin avant d'en lancer un autre.")
    }
  }

  // Lazy import du scraper (Playwright/Chromium) — seulement au lancement d'un job
  const { GoogleMapsScraper } = await import("./google-maps-scraper")
  const scraper = new GoogleMapsScraper({
    headless: true,
    maxResults: query.maxResults || 20,
    maxScrolls: 5,
    extractReviews: false,
    extractPhotos: false,
    maxPhotos: 0,
    pageTimeout: 25000,
    retries: 1,
  })

  const state: JobState = {
    id: jobId,
    query,
    scraper,
    events: [],
    createdAt: new Date().toISOString(),
    progress: {
      jobId,
      status: "queued",
      phase: "init",
      progress: 0,
      resultsCount: 0,
      processedCount: 0,
      duplicatesDetected: 0,
      errors: [],
      startedAt: new Date().toISOString(),
    },
  }

  // Listen events
  scraper.on((event) => {
    state.events.push(event)
    if (state.events.length > MAX_EVENTS_KEPT) {
      state.events = state.events.slice(-MAX_EVENTS_KEPT)
    }

    // Update progress
    switch (event.type) {
      case "start":
        state.progress.status = "running"
        state.progress.phase = "init"
        state.progress.progress = 5
        break
      case "progress":
        state.progress.progress = event.progress
        state.progress.phase = event.phase
        break
      case "place-extracted":
        state.progress.processedCount++
        state.progress.resultsCount = state.progress.processedCount
        state.progress.currentPlace = event.place.name
        break
      case "duplicate-detected":
        state.progress.duplicatesDetected++
        break
      case "error":
        state.progress.errors.push(event.message)
        break
      case "block-detected":
        state.progress.errors.push(`Blocage: ${event.reason}`)
        break
      case "complete":
        state.progress.status = "completed"
        state.progress.phase = "done"
        state.progress.progress = 100
        state.progress.resultsCount = event.results.length
        break
      case "cancelled":
        state.progress.status = "cancelled"
        break
    }
  })

  jobs.set(jobId, state)

  // Lance le scraping de façon asynchrone (non-bloquant)
  scraper
    .scrape(jobId, query)
    .then((result) => {
      state.result = result
      if (result.status === "failed") {
        state.progress.status = "failed"
        state.progress.phase = "done"
      } else if (result.status === "completed") {
        state.progress.status = "completed"
        state.progress.phase = "done"
        state.progress.progress = 100
      }
    })
    .catch((err) => {
      state.progress.status = "failed"
      state.progress.errors.push(err.message)
    })

  return state
}

/**
 * Récupère l'état d'un job
 */
export function getJob(jobId: string): JobState | undefined {
  return jobs.get(jobId)
}

/**
 * Liste tous les jobs
 */
export function listJobs(): Array<{
  id: string
  query: SearchQuery
  progress: ScrapeProgress
  createdAt: string
}> {
  return Array.from(jobs.values()).map((j) => ({
    id: j.id,
    query: j.query,
    progress: j.progress,
    createdAt: j.createdAt,
  }))
}

/**
 * Annule un job
 */
export function cancelJob(jobId: string): boolean {
  const job = jobs.get(jobId)
  if (!job) return false
  if (job.progress.status !== "running" && job.progress.status !== "queued") return false
  job.scraper.cancel()
  job.progress.status = "cancelled"
  return true
}

/**
 * Supprime un job (cleanup)
 */
export function deleteJob(jobId: string): boolean {
  return jobs.delete(jobId)
}

/**
 * Nettoie les jobs terminés de plus de N minutes
 */
export function cleanupOldJobs(maxAgeMinutes = 60): number {
  const cutoff = Date.now() - maxAgeMinutes * 60 * 1000
  let deleted = 0
  for (const [id, job] of jobs) {
    if (
      (job.progress.status === "completed" || job.progress.status === "failed" || job.progress.status === "cancelled") &&
      new Date(job.createdAt).getTime() < cutoff
    ) {
      jobs.delete(id)
      deleted++
    }
  }
  return deleted
}

/**
 * Format pour API (sans l'instance scraper)
 */
export function serializeJob(job: JobState): {
  id: string
  query: SearchQuery
  progress: ScrapeProgress
  result?: ScrapeResult
  events: ScrapeEvent[]
  createdAt: string
} {
  return {
    id: job.id,
    query: job.query,
    progress: job.progress,
    result: job.result,
    events: job.events,
    createdAt: job.createdAt,
  }
}

/**
 * Helper pour formater les lieux extraits en CSV/JSON
 */
export function placesToJSON(places: ScrapedPlace[]): string {
  return JSON.stringify(places, null, 2)
}

export function placesToCSV(places: ScrapedPlace[]): string {
  if (places.length === 0) return ""
  const headers = [
    "name", "category", "address", "phone", "phoneNormalized",
    "email", "website", "lat", "lng", "rating", "reviewCount",
    "isOpenNow", "placeId", "scrapedAt",
  ]
  const rows = places.map((p) =>
    headers.map((h) => {
      const val = (p as Record<string, unknown>)[h]
      if (val === undefined || val === null) return ""
      if (h === "lat" || h === "lng") {
        return p.gps ? (h === "lat" ? p.gps.lat : p.gps.lng) : ""
      }
      const s = String(val).replace(/"/g, '""')
      return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s}"` : s
    }).join(",")
  )
  return [headers.join(","), ...rows].join("\n")
}
