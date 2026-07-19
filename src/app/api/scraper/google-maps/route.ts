/**
 * POST /api/scraper/google-maps
 * Lance un nouveau job de scraping Google Maps
 *
 * Body: {
 *   keyword: string,        // "restaurant", "pharmacie"
 *   city?: string,          // "Abidjan"
 *   commune?: string,       // "Cocody"
 *   neighborhood?: string,  // "Riviera 2"
 *   maxResults?: number,    // défaut 20
 *   language?: string,      // défaut "fr"
 * }
 *
 * Multi-tenant: the authenticated user's orgId/userId are threaded into the
 * SearchQuery so that any future persistence (Company.create from scraped
 * places) can attach the right organizationId. OWNER jobs are global (null).
 *
 * Returns: { jobId: string, status: "queued", estimatedDurationMs }
 */
import { NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { startScrapeJob } from "@/lib/scraper/job-store"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"
import { requireApiAuth } from "@/lib/api/auth-middleware"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const maxDuration = 300 // 5 minutes max pour Vercel (en local, pas de limite)

export async function POST(req: NextRequest) {
  try {
    // Auth required — captures orgId/userId for tenant scoping of scraped
    // companies when they're eventually persisted to DB.
    const auth = await requireApiAuth(req)
    if (!auth.user) {
      return errorResponse(auth.error || "Unauthorized", auth.status)
    }

    const body = await req.json()
    const { keyword, city, commune, neighborhood, maxResults, language } = body

    if (!keyword || typeof keyword !== "string" || keyword.trim().length < 2) {
      return errorResponse("Mots-clés requis (min 2 caractères)", 400)
    }

    const jobId = `scrape-${randomUUID().slice(0, 8)}`
    const query = {
      keyword: keyword.trim(),
      city: city?.trim() || undefined,
      commune: commune?.trim() || undefined,
      neighborhood: neighborhood?.trim() || undefined,
      maxResults: Math.min(maxResults || 20, 100), // hard cap 100
      language: language || "fr",
      country: "ci",
      // Multi-tenant: thread the caller's org/user into the job so any
      // future Company.create from scraped places will be scoped correctly.
      organizationId: auth.user.orgId,
      userId: auth.user.id,
    }

    let state
    try {
      state = startScrapeJob(jobId, query)
    } catch (jobErr) {
      // Job déjà en cours → 429 Too Many Requests
      const msg = jobErr instanceof Error ? jobErr.message : "Job déjà en cours"
      return errorResponse(msg, 429)
    }

    const estimatedDurationMs = (query.maxResults || 20) * 3000 // ~3s par lieu

    return jsonResponse({
      jobId: state.id,
      status: "queued",
      query,
      estimatedDurationMs,
      message: "Job de scraping lancé. Utilisez GET /api/scraper/jobs/[id] pour suivre la progression.",
    }, { status: 202 })
  } catch (err) {
    console.error("[scraper/google-maps] POST error:", err)
    return errorResponse("Erreur lors du lancement du job", 500)
  }
}
