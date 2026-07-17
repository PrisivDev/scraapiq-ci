/**
 * GET /api/scraper/ai-cleaner/jobs
 * Liste tous les jobs de nettoyage IA
 */
import { listAICleanerJobs } from "@/lib/scraper/ai-cleaner-job-store"
import { jsonResponse } from "@/lib/auth/helpers"

export async function GET() {
  const jobs = listAICleanerJobs()
  return jsonResponse({
    jobs,
    total: jobs.length,
  })
}
