/**
 * GET /api/scraper/business/jobs
 * Liste tous les jobs d'identification business
 */
import { listBusinessJobs } from "@/lib/scraper/business-job-store"
import { jsonResponse } from "@/lib/auth/helpers"

export async function GET() {
  const jobs = listBusinessJobs()
  return jsonResponse({
    jobs: jobs.map((j) => ({
      id: j.id,
      query: {
        ...j.query,
        cookies: j.query.cookies ? "***" : undefined,
      },
      status: j.progress.status,
      progress: j.progress.progress,
      resultsCount: j.progress.resultsCount,
      createdAt: j.createdAt,
    })),
    total: jobs.length,
  })
}
