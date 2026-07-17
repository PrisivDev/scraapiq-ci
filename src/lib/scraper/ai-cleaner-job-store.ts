/**
 * Store en mémoire des jobs de nettoyage IA
 */

import { AICleaner } from "./ai-cleaner"
import type { ScrapedPlace, CleanedEntity, AICleanerEvent, AICleanerConfig, CleaningReport } from "./ai-cleaner-types"

interface AICleanerJobState {
  id: string
  input: ScrapedPlace[]
  config: AICleanerConfig
  cleanedEntities: CleanedEntity[]
  report?: CleaningReport
  progress: {
    status: "queued" | "running" | "completed" | "failed" | "cancelled"
    progress: number
    phase: string
    processedCount: number
    errors: string[]
    startedAt: string
  }
  events: AICleanerEvent[]
  createdAt: string
}

const globalForAICleaner = globalThis as unknown as {
  __aiCleanerJobs?: Map<string, AICleanerJobState>
}

const jobs = globalForAICleaner.__aiCleanerJobs ?? new Map<string, AICleanerJobState>()

if (process.env.NODE_ENV !== "production") {
  globalForAICleaner.__aiCleanerJobs = jobs
}

const MAX_EVENTS_KEPT = 100

export function startAICleanerJob(
  jobId: string,
  entities: ScrapedPlace[],
  config: AICleanerConfig = {}
): AICleanerJobState {
  const cleaner = new AICleaner(config)

  const state: AICleanerJobState = {
    id: jobId,
    input: entities,
    config,
    cleanedEntities: [],
    events: [],
    createdAt: new Date().toISOString(),
    progress: {
      status: "queued",
      progress: 0,
      phase: "init",
      processedCount: 0,
      errors: [],
      startedAt: new Date().toISOString(),
    },
  }

  cleaner.on((event) => {
    state.events.push(event)
    if (state.events.length > MAX_EVENTS_KEPT) {
      state.events = state.events.slice(-MAX_EVENTS_KEPT)
    }

    switch (event.type) {
      case "ai-start":
        state.progress.status = "running"
        state.progress.phase = "dedup"
        state.progress.progress = 5
        break
      case "ai-progress":
        state.progress.progress = event.progress
        state.progress.phase = event.phase
        break
      case "ai-correct-start":
      case "ai-enrich-start":
        state.progress.processedCount++
        break
      case "ai-error":
        state.progress.errors.push(event.message)
        break
      case "ai-complete":
        state.progress.status = "completed"
        state.progress.phase = "done"
        state.progress.progress = 100
        state.report = event.report
        break
    }
  })

  jobs.set(jobId, state)

  // Lance le nettoyage asynchrone
  cleaner
    .clean(jobId, entities)
    .then(({ report, cleanedEntities: result }) => {
      state.report = report
      state.cleanedEntities = result
      state.progress.status = "completed"
      state.progress.phase = "done"
      state.progress.progress = 100
    })
    .catch((err) => {
      state.progress.status = "failed"
      state.progress.errors.push(err.message)
    })

  return state
}

export function getAICleanerJob(jobId: string): AICleanerJobState | undefined {
  return jobs.get(jobId)
}

export function listAICleanerJobs(): Array<{
  id: string
  inputCount: number
  status: string
  progress: number
  createdAt: string
}> {
  return Array.from(jobs.values()).map((j) => ({
    id: j.id,
    inputCount: j.input.length,
    status: j.progress.status,
    progress: j.progress.progress,
    createdAt: j.createdAt,
  }))
}

export function cancelAICleanerJob(jobId: string): boolean {
  const job = jobs.get(jobId)
  if (!job) return false
  if (job.progress.status !== "running" && job.progress.status !== "queued") return false
  job.progress.status = "cancelled"
  return true
}

export function deleteAICleanerJob(jobId: string): boolean {
  return jobs.delete(jobId)
}

export function serializeAICleanerJob(job: AICleanerJobState): {
  id: string
  input: ScrapedPlace[]
  cleanedEntities: CleanedEntity[]
  report?: CleaningReport
  progress: AICleanerJobState["progress"]
  events: AICleanerEvent[]
  createdAt: string
} {
  return {
    id: job.id,
    input: job.input,
    cleanedEntities: job.cleanedEntities,
    report: job.report,
    progress: job.progress,
    events: job.events,
    createdAt: job.createdAt,
  }
}
