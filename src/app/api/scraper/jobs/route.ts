/**
 * GET /api/scraper/jobs
 * Liste tous les jobs de scraping
 *
 * GET /api/scraper/jobs/[id]
 * Récupère l'état + résultats d'un job spécifique
 *
 * DELETE /api/scraper/jobs/[id]
 * Annule un job en cours
 */
import { NextRequest } from "next/server"
import { getJob, listJobs, serializeJob, cancelJob, deleteJob, placesToCSV } from "@/lib/scraper/job-store"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"

export async function GET() {
  const jobs = listJobs()
  return jsonResponse({
    jobs: jobs.map((j) => ({
      id: j.id,
      query: j.query,
      status: j.progress.status,
      progress: j.progress.progress,
      resultsCount: j.progress.resultsCount,
      createdAt: j.createdAt,
    })),
    total: jobs.length,
  })
}
