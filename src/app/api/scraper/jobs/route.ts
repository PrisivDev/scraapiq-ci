/**
 * GET /api/scraper/jobs
 * Liste tous les jobs de scraping — depuis la DB (history) pour survivre aux
 * redémarrages. Si le job est également en mémoire (live), on ajoute un champ
 * `live` avec la phase courante.
 *
 * Multi-tenant :
 *   - OWNER → voit TOUS les jobs (toutes orgs + global null)
 *   - autres rôles → ne voient QUE les jobs de leur org
 */
import { NextRequest } from "next/server"
import { listJobsFromDB } from "@/lib/scraper/job-store"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"
import { requireApiAuth } from "@/lib/api/auth-middleware"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  // Auth required — captures orgId/role for tenant scoping
  const auth = await requireApiAuth(req)
  if (!auth.user) {
    return errorResponse(auth.error || "Unauthorized", auth.status)
  }

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10) || 100, 500)

  // Multi-tenant scoping:
  //   - OWNER sees everything (including organizationId = null = global)
  //   - non-OWNER sees only their org's jobs
  const filters: { organizationId?: string | null; limit: number } = { limit }
  if (auth.user.role !== "OWNER") {
    filters.organizationId = auth.user.orgId ?? null
  }

  const jobs = await listJobsFromDB(filters)

  return jsonResponse({
    jobs: jobs.map((j) => ({
      id: j.id,
      query: j.query,
      status: j.status,
      progress: j.progress,
      resultsCount: j.resultsCount,
      processedCount: j.processedCount,
      duplicatesDetected: j.duplicatesDetected,
      duration: j.duration,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
      createdAt: j.createdAt,
      live: j.live,
    })),
    total: jobs.length,
  })
}
