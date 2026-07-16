/**
 * Store en mémoire des jobs d'identification business
 */

import { BusinessScraper } from "./business-scraper"
import type { BusinessSearchQuery, BusinessScrapeEvent } from "./business-types"
import type { ScrapeResult, ScrapeProgress, ScrapeEvent } from "./types"

interface BusinessJobState {
  id: string
  query: BusinessSearchQuery
  progress: ScrapeProgress
  result?: ScrapeResult
  scraper: BusinessScraper
  events: Array<BusinessScrapeEvent | ScrapeEvent>
  createdAt: string
}

const globalForBizScraper = globalThis as unknown as {
  __bizScraperJobs?: Map<string, BusinessJobState>
}

const jobs = globalForBizScraper.__bizScraperJobs ?? new Map<string, BusinessJobState>()

if (process.env.NODE_ENV !== "production") {
  globalForBizScraper.__bizScraperJobs = jobs
}

const MAX_EVENTS_KEPT = 50

export function startBusinessScrapeJob(jobId: string, query: BusinessSearchQuery): BusinessJobState {
  const scraper = new BusinessScraper({
    headless: true,
    cookies: query.cookies,
    pageTimeout: 30000,
    retries: 2,
    mobileVersion: false, // desktop fonctionne mieux pour les pages company publiques
    enableFallbacks: true,
  })

  const state: BusinessJobState = {
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

  scraper.on((event) => {
    state.events.push(event)
    if (state.events.length > MAX_EVENTS_KEPT) {
      state.events = state.events.slice(-MAX_EVENTS_KEPT)
    }

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
      case "biz-extracted":
        state.progress.processedCount++
        state.progress.resultsCount = state.progress.processedCount
        state.progress.currentPlace = event.entity.name
        break
      case "biz-search-loaded":
        state.progress.phase = "listing"
        state.progress.progress = 25
        break
      case "biz-error":
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

export function getBusinessJob(jobId: string): BusinessJobState | undefined {
  return jobs.get(jobId)
}

export function listBusinessJobs(): Array<{
  id: string
  query: BusinessSearchQuery
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

export function cancelBusinessJob(jobId: string): boolean {
  const job = jobs.get(jobId)
  if (!job) return false
  if (job.progress.status !== "running" && job.progress.status !== "queued") return false
  job.scraper.cancel()
  job.progress.status = "cancelled"
  return true
}

export function deleteBusinessJob(jobId: string): boolean {
  return jobs.delete(jobId)
}

export function serializeBusinessJob(job: BusinessJobState): {
  id: string
  query: BusinessSearchQuery
  progress: ScrapeProgress
  result?: ScrapeResult
  events: Array<BusinessScrapeEvent | ScrapeEvent>
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
