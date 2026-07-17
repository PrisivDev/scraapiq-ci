/**
 * Store en mémoire des jobs de scraping Facebook
 * (séparé du store Google Maps pour clarté, mais même structure)
 */

import { FacebookScraper, setSearchLocality } from "./facebook-scraper"
import type { FacebookSearchQuery, FacebookScrapeEvent } from "./facebook-types"
import type { ScrapeResult, ScrapeProgress, ScrapeEvent } from "./types"

interface FacebookJobState {
  id: string
  query: FacebookSearchQuery
  progress: ScrapeProgress
  result?: ScrapeResult
  scraper: FacebookScraper
  events: Array<FacebookScrapeEvent | ScrapeEvent>
  createdAt: string
}

const globalForFbScraper = globalThis as unknown as {
  __fbScraperJobs?: Map<string, FacebookJobState>
}

const jobs = globalForFbScraper.__fbScraperJobs ?? new Map<string, FacebookJobState>()

if (process.env.NODE_ENV !== "production") {
  globalForFbScraper.__fbScraperJobs = jobs
}

const MAX_EVENTS_KEPT = 50

/**
 * Lance un job de scraping Facebook
 */
export function startFacebookScrapeJob(jobId: string, query: FacebookSearchQuery): FacebookJobState {
  // Set la localité pour la construction du lien Google Maps
  const locality = [query.neighborhood, query.commune, query.city].filter(Boolean).join(" ")
  setSearchLocality(locality)

  const scraper = new FacebookScraper({
    headless: true,
    cookies: query.cookies,
    maxImages: query.maxResults && query.maxResults > 5 ? 2 : 3,
    pageTimeout: 30000,
    retries: 2,
    mobileVersion: true,
  })

  const state: FacebookJobState = {
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
      case "fb-extracted":
        state.progress.processedCount++
        state.progress.resultsCount = state.progress.processedCount
        state.progress.currentPlace = event.place.name
        break
      case "fb-search-loaded":
        state.progress.phase = "listing"
        state.progress.progress = 25
        break
      case "fb-login-required":
        state.progress.errors.push(event.message)
        break
      case "fb-error":
        state.progress.errors.push(event.message)
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

  // Lance le scraping asynchrone
  scraper
    .scrape(jobId, query)
    .then((result) => {
      state.result = result
      // Met à jour le statut final selon le résultat
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

export function getFacebookJob(jobId: string): FacebookJobState | undefined {
  return jobs.get(jobId)
}

export function listFacebookJobs(): Array<{
  id: string
  query: FacebookSearchQuery
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

export function cancelFacebookJob(jobId: string): boolean {
  const job = jobs.get(jobId)
  if (!job) return false
  if (job.progress.status !== "running" && job.progress.status !== "queued") return false
  job.scraper.cancel()
  job.progress.status = "cancelled"
  return true
}

export function deleteFacebookJob(jobId: string): boolean {
  return jobs.delete(jobId)
}

export function serializeFacebookJob(job: FacebookJobState): {
  id: string
  query: FacebookSearchQuery
  progress: ScrapeProgress
  result?: ScrapeResult
  events: Array<FacebookScrapeEvent | ScrapeEvent>
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
