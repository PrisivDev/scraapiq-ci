/**
 * GET /api/scraper/facebook/jobs
 * Liste tous les jobs de scraping Facebook
 */
import { listFacebookJobs } from "@/lib/scraper/facebook-job-store"
import { jsonResponse } from "@/lib/auth/helpers"

export async function GET() {
  const jobs = listFacebookJobs()
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
