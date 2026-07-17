/**
 * Store en mémoire des jobs de scraping de sites web
 */

import { WebsiteScraper } from "./website-scraper"
import type { WebsiteSearchQuery, WebsiteScrapeEvent } from "./website-types"
import type { ScrapeResult, ScrapeProgress, ScrapeEvent } from "./types"

interface WebsiteJobState {
  id: string
  query: WebsiteSearchQuery
  progress: ScrapeProgress
  result?: ScrapeResult
  scraper: WebsiteScraper
  events: Array<WebsiteScrapeEvent | ScrapeEvent>
  createdAt: string
}

const globalForWsScraper = globalThis as unknown as {
  __wsScraperJobs?: Map<string, WebsiteJobState>
}

const jobs = globalForWsScraper.__wsScraperJobs ?? new Map<string, WebsiteJobState>()

if (process.env.NODE_ENV !== "production") {
  globalForWsScraper.__wsScraperJobs = jobs
}

const MAX_EVENTS_KEPT = 50

export function startWebsiteScrapeJob(jobId: string, query: WebsiteSearchQuery): WebsiteJobState {
  const scraper = new WebsiteScraper({
    headless: true,
    pageTimeout: 25000,
    retries: 2,
    blockResources: true,
    extractImages: true,
  })

  const state: WebsiteJobState = {
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
      case "ws-page-visit":
        state.progress.processedCount++
        state.progress.currentPlace = event.url
        break
      case "ws-page-loaded":
        state.progress.resultsCount = state.progress.processedCount
        break
      case "ws-contacts-found":
        state.progress.phase = "extraction-done"
        break
      case "ws-error":
        state.progress.errors.push(event.message)
        break
      case "error":
        state.progress.errors.push(event.message)
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

export function getWebsiteJob(jobId: string): WebsiteJobState | undefined {
  return jobs.get(jobId)
}

export function listWebsiteJobs(): Array<{
  id: string
  query: WebsiteSearchQuery
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

export function cancelWebsiteJob(jobId: string): boolean {
  const job = jobs.get(jobId)
  if (!job) return false
  if (job.progress.status !== "running" && job.progress.status !== "queued") return false
  job.scraper.cancel()
  job.progress.status = "cancelled"
  return true
}

export function deleteWebsiteJob(jobId: string): boolean {
  return jobs.delete(jobId)
}

export function serializeWebsiteJob(job: WebsiteJobState): {
  id: string
  query: WebsiteSearchQuery
  progress: ScrapeProgress
  result?: ScrapeResult
  events: Array<WebsiteScrapeEvent | ScrapeEvent>
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
