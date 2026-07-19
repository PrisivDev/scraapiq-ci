/**
 * Store des jobs de scraping Google Maps.
 *
 * HYBRIDE : mémoire (live) + base de données (history).
 *
 * - L'in-memory store (Map<jobId, JobState>) conserve les éléments non-
 *   sérialisables : l'instance GoogleMapsScraper (Playwright/Chromium), les
 *   derniers événements pour replay SSE, et le `currentPlace` temps réel.
 *   Il est volontairement wiped au redémarrage du serveur.
 *
 * - La table `ScrapeJobRecord` (Prisma) conserve l'HISTORIQUE durable :
 *   status, progress, resultsCount, duration, errors, timestamps. Elle
 *   survit aux redémarrages et alimente :
 *     GET  /api/scraper/jobs        → listJobsFromDB()
 *     GET  /api/scraper/jobs/[id]   → getJobFromDB() + merge in-memory live
 *     POST /api/scraper/google-maps → startScrapeJob() (crée le record)
 *     DEL  /api/scraper/jobs/[id]   → cancelJob() + update DB
 *
 * Protection mémoire : limite à 1 job simultané (Chromium est gourmand).
 */

import type { SearchQuery, ScrapeResult, ScrapeProgress, ScrapeEvent, ScrapedPlace } from "./types"
import type { Prisma } from "@prisma/client"
import { db } from "@/lib/db"

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
} else {
  // En production, on garde aussi le Map sur globalThis pour survivre aux HMR
  // (qui ne devraient pas arriver en prod mais au cas où).
  globalForScraper.__scraperJobs = jobs
}

const MAX_EVENTS_KEPT = 50

// ============================================================================
// DB HELPERS — best-effort, non-bloquants
// ============================================================================

/**
 * Met à jour un ScrapeJobRecord en DB. Best-effort : log l'erreur mais ne
 * throw jamais, pour ne pas casser le scraping si la DB est momentanément
 // indisponible.
 */
async function updateJobRecord(jobId: string, data: Prisma.ScrapeJobRecordUpdateInput): Promise<void> {
  try {
    await db.scrapeJobRecord.update({ where: { jobId }, data })
  } catch (err) {
    console.error(`[job-store] Failed to update ScrapeJobRecord ${jobId}:`, err)
  }
}

/**
 * Debounce les updates de progress pour ne pas saturer la DB (1 update/s max).
 * Les changements de status (start/complete/fail/cancelled) passent en direct.
 */
const progressTimers = new Map<string, ReturnType<typeof setTimeout>>()
function debouncedProgressUpdate(
  jobId: string,
  progress: number,
  resultsCount: number,
  processedCount: number,
  duplicatesDetected: number,
): void {
  const existing = progressTimers.get(jobId)
  if (existing) clearTimeout(existing)
  const timer = setTimeout(() => {
    progressTimers.delete(jobId)
    void updateJobRecord(jobId, {
      progress,
      resultsCount,
      processedCount,
      duplicatesDetected,
    })
  }, 1000)
  progressTimers.set(jobId, timer)
}

/**
 * Sérialise les erreurs en JSON string pour la colonne `errors`.
 * Tronque à 20 entrées pour éviter un payload trop gros.
 */
function serializeErrors(errors: string[]): string {
  return JSON.stringify(errors.slice(-20))
}

// ============================================================================
// START JOB
// ============================================================================

/**
 * Lance un job de scraping.
 *
 * 1. Crée d'abord le ScrapeJobRecord en DB (status: queued) — c'est l'acte de
 *    persistance qui garantit que le job survivra à un redémarrage serveur.
 * 2. Monte l'instance GoogleMapsScraper (Playwright) en lazy-import.
 * 3. Branche les event listeners qui mettent à jour l'in-memory state ET la DB.
 * 4. Lance le scraping de façon asynchrone (non-bloquant).
 *
 * Protection mémoire : refuse si un job est déjà running (Chromium est gourmand).
 */
export async function startScrapeJob(jobId: string, query: SearchQuery): Promise<JobState> {
  // Protection : refuse si un job est déjà running (évite l'OOM)
  for (const [, existing] of jobs) {
    if (existing.progress.status === "running" || existing.progress.status === "queued") {
      throw new Error("Un job est déjà en cours. Attendez la fin avant d'en lancer un autre.")
    }
  }

  // ----- 1. Crée le ScrapeJobRecord en DB -----
  try {
    await db.scrapeJobRecord.create({
      data: {
        jobId,
        organizationId: query.organizationId ?? null,
        userId: query.userId ?? null,
        keyword: query.keyword,
        city: query.city ?? null,
        commune: query.commune ?? null,
        neighborhood: query.neighborhood ?? null,
        status: "queued",
        progress: 0,
        startedAt: new Date(),
      },
    })
  } catch (err) {
    console.error(`[job-store] Failed to create ScrapeJobRecord ${jobId}:`, err)
    // On continue quand même — l'in-memory store fonctionne encore, mais sans
    // persistance. Mieux vaut un job non-persistent qu'aucun job.
  }

  // ----- 2. Lazy import du scraper (Playwright/Chromium) -----
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

  // ----- 3. Event listeners -----
  scraper.on((event) => {
    state.events.push(event)
    if (state.events.length > MAX_EVENTS_KEPT) {
      state.events = state.events.slice(-MAX_EVENTS_KEPT)
    }

    // Update in-memory progress + DB record
    switch (event.type) {
      case "start":
        state.progress.status = "running"
        state.progress.phase = "init"
        state.progress.progress = 5
        void updateJobRecord(jobId, {
          status: "running",
          progress: 5,
          startedAt: new Date(),
        })
        break
      case "progress":
        state.progress.progress = event.progress
        state.progress.phase = event.phase
        debouncedProgressUpdate(
          jobId,
          event.progress,
          state.progress.resultsCount,
          state.progress.processedCount,
          state.progress.duplicatesDetected,
        )
        break
      case "place-extracted":
        state.progress.processedCount++
        state.progress.resultsCount = state.progress.processedCount
        state.progress.currentPlace = event.place.name
        debouncedProgressUpdate(
          jobId,
          state.progress.progress,
          state.progress.resultsCount,
          state.progress.processedCount,
          state.progress.duplicatesDetected,
        )
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
        void updateJobRecord(jobId, {
          status: "completed",
          progress: 100,
          resultsCount: event.results.length,
          processedCount: state.progress.processedCount,
          duplicatesDetected: event.duplicates,
          completedAt: new Date(),
          duration: event.durationMs,
          errors: serializeErrors(state.progress.errors),
        })
        break
      case "cancelled":
        state.progress.status = "cancelled"
        void updateJobRecord(jobId, {
          status: "cancelled",
          completedAt: new Date(),
        })
        break
    }
  })

  jobs.set(jobId, state)

  // ----- 4. Lance le scraping de façon asynchrone (non-bloquant) -----
  scraper
    .scrape(jobId, query)
    .then((result) => {
      state.result = result
      if (result.status === "failed") {
        state.progress.status = "failed"
        state.progress.phase = "done"
        void updateJobRecord(jobId, {
          status: "failed",
          errors: serializeErrors([...state.progress.errors, ...result.errors]),
          completedAt: new Date(),
          duration: result.stats.durationMs,
        })
      } else if (result.status === "completed") {
        state.progress.status = "completed"
        state.progress.phase = "done"
        state.progress.progress = 100
        // L'event "complete" a déjà mis à jour la DB, mais on re-confirme avec
        // les données finales du result (au cas où l'event n'aurait pas fini
        // d'être traité).
        void updateJobRecord(jobId, {
          status: "completed",
          progress: 100,
          resultsCount: result.places.length,
          processedCount: state.progress.processedCount,
          duplicatesDetected: result.duplicates.length,
          completedAt: new Date(),
          duration: result.stats.durationMs,
          errors: serializeErrors(result.errors),
        })
      }
    })
    .catch((err) => {
      state.progress.status = "failed"
      state.progress.errors.push(err.message)
      void updateJobRecord(jobId, {
        status: "failed",
        errors: serializeErrors([...state.progress.errors, err.message]),
        completedAt: new Date(),
      })
    })

  return state
}

// ============================================================================
// IN-MEMORY ACCESSORS (pour live progress, events, results)
// ============================================================================

/**
 * Récupère l'état live (in-memory) d'un job. Indéfini si le serveur a
 * redémarré ou si le job a été garbage-collected.
 */
export function getJob(jobId: string): JobState | undefined {
  return jobs.get(jobId)
}

/**
 * Liste tous les jobs en mémoire (live seulement). Pour l'historique complet,
 * utiliser listJobsFromDB().
 *
 * @deprecated Pour l'API publique, utiliser listJobsFromDB() qui inclut
 * l'historique persisté.
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
 * Annule un job en cours. Met à jour l'in-memory state ET la DB.
 */
export function cancelJob(jobId: string): boolean {
  const job = jobs.get(jobId)
  if (!job) return false
  if (job.progress.status !== "running" && job.progress.status !== "queued") return false
  try {
    job.scraper?.cancel()
  } catch (err) {
    console.error(`[job-store] Error cancelling scraper ${jobId}:`, err)
  }
  job.progress.status = "cancelled"
  void updateJobRecord(jobId, {
    status: "cancelled",
    completedAt: new Date(),
  })
  return true
}

/**
 * Supprime un job de l'in-memory store. Ne touche PAS à la DB (l'historique
 * est conservé). Utilisé pour libérer de la mémoire après qu'un job soit
 * terminé et que l'utilisateur l'ait explicitement purgé.
 */
export function deleteJob(jobId: string): boolean {
  // Nettoie aussi le timer de debounce si présent
  const timer = progressTimers.get(jobId)
  if (timer) {
    clearTimeout(timer)
    progressTimers.delete(jobId)
  }
  return jobs.delete(jobId)
}

/**
 * Nettoie les jobs terminés de plus de N minutes (in-memory seulement).
 * La DB conserve l'historique complet.
 */
export function cleanupOldJobs(maxAgeMinutes = 60): number {
  const cutoff = Date.now() - maxAgeMinutes * 60 * 1000
  let deleted = 0
  for (const [id, job] of jobs) {
    if (
      (job.progress.status === "completed" || job.progress.status === "failed" || job.progress.status === "cancelled") &&
      new Date(job.createdAt).getTime() < cutoff
    ) {
      // Nettoie le timer de debounce si présent
      const timer = progressTimers.get(id)
      if (timer) {
        clearTimeout(timer)
        progressTimers.delete(id)
      }
      jobs.delete(id)
      deleted++
    }
  }
  return deleted
}

// ============================================================================
// DB ACCESSORS (pour list/detail API — survive aux redémarrages)
// ============================================================================

export interface JobListItemFromDB {
  id: string
  query: {
    keyword: string
    city?: string | null
    commune?: string | null
    neighborhood?: string | null
    organizationId?: string | null
    userId?: string | null
  }
  status: string
  progress: number
  resultsCount: number
  processedCount: number
  duplicatesDetected: number
  duration: number | null
  startedAt: string
  completedAt: string | null
  createdAt: string
  /** Live state if the job is currently in memory (running/recently finished). */
  live?: {
    phase: string
    currentPlace?: string
    errors: string[]
    eventsCount: number
  } | null
}

/**
 * Liste les jobs depuis la DB (history). Si un job est également en mémoire
 * (live), on ajoute un champ `live` avec la phase courante et le lieu en cours.
 *
 * @param filters.organizationId  Si fourni (y compris null), filtre par org.
 *                                Si non fourni (undefined), ne filtre pas.
 * @param filters.userId           Si fourni, filtre par user.
 * @param filters.limit            Défaut 100.
 */
export async function listJobsFromDB(filters?: {
  organizationId?: string | null
  userId?: string
  limit?: number
}): Promise<JobListItemFromDB[]> {
  const where: Prisma.ScrapeJobRecordWhereInput = {}
  if (filters && "organizationId" in filters && filters.organizationId !== undefined) {
    where.organizationId = filters.organizationId
  }
  if (filters?.userId) {
    where.userId = filters.userId
  }

  const records = await db.scrapeJobRecord.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: filters?.limit ?? 100,
  })

  return records.map((r) => {
    const live = jobs.get(r.jobId)
    return {
      id: r.jobId,
      query: {
        keyword: r.keyword,
        city: r.city,
        commune: r.commune,
        neighborhood: r.neighborhood,
        organizationId: r.organizationId,
        userId: r.userId,
      },
      status: r.status,
      progress: r.progress,
      resultsCount: r.resultsCount,
      processedCount: r.processedCount,
      duplicatesDetected: r.duplicatesDetected,
      duration: r.duration,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      live: live
        ? {
            phase: live.progress.phase,
            currentPlace: live.progress.currentPlace,
            errors: live.progress.errors,
            eventsCount: live.events.length,
          }
        : null,
    }
  })
}

export interface JobDetailFromDB extends JobListItemFromDB {
  errors: string[]
  /** Live events (in-memory, max 50). Vide si le serveur a redémarré. */
  events: ScrapeEvent[]
  /** Live result (places scraped). Indéfini si le serveur a redémarré ou si le job a échoué. */
  result?: ScrapeResult
}

/**
 * Récupère un job unique depuis la DB, et fusionne avec l'état live in-memory
 * si disponible (events, result, currentPlace).
 */
export async function getJobFromDB(jobId: string): Promise<JobDetailFromDB | null> {
  const record = await db.scrapeJobRecord.findUnique({ where: { jobId } })
  if (!record) return null

  const live = jobs.get(jobId)
  let errors: string[] = []
  try {
    errors = JSON.parse(record.errors || "[]")
  } catch {
    errors = []
  }

  return {
    id: record.jobId,
    query: {
      keyword: record.keyword,
      city: record.city,
      commune: record.commune,
      neighborhood: record.neighborhood,
      organizationId: record.organizationId,
      userId: record.userId,
    },
    status: record.status,
    progress: record.progress,
    resultsCount: record.resultsCount,
    processedCount: record.processedCount,
    duplicatesDetected: record.duplicatesDetected,
    duration: record.duration,
    startedAt: record.startedAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    errors,
    events: live?.events ?? [],
    result: live?.result,
    live: live
      ? {
          phase: live.progress.phase,
          currentPlace: live.progress.currentPlace,
          errors: live.progress.errors,
          eventsCount: live.events.length,
        }
      : null,
  }
}

/**
 * Marque un job comme "cancelled" en DB. Utilisé par DELETE /api/scraper/jobs/[id]
 * quand le job n'est plus en mémoire (serveur redémarré) mais qu'on veut quand
 * même marquer l'historique comme annulé.
 */
export async function cancelJobInDB(jobId: string): Promise<boolean> {
  try {
    await db.scrapeJobRecord.update({
      where: { jobId },
      data: { status: "cancelled", completedAt: new Date() },
    })
    return true
  } catch (err) {
    console.error(`[job-store] Failed to cancel ScrapeJobRecord ${jobId}:`, err)
    return false
  }
}

// ============================================================================
// SERIALIZERS (legacy — toujours utilisés par les anciennes routes)
// ============================================================================

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
