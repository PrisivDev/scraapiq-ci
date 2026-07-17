/**
 * GET /api/scraper/website/jobs
 * Liste tous les jobs de scraping web
 */
import { listWebsiteJobs } from "@/lib/scraper/website-job-store"
import { jsonResponse } from "@/lib/auth/helpers"

export async function GET() {
  const jobs = listWebsiteJobs()
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
