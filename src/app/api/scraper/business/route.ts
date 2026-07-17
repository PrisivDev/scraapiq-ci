/**
 * POST /api/scraper/business
 * Identifie une entreprise (LinkedIn + fallbacks)
 *
 * Body: {
 *   query: string,                  // nom ou mot-clé
 *   location?: string,              // "Abidjan, CI"
 *   linkedinSlug?: string,          // "orange" (skip recherche)
 *   linkedinUrl?: string,           // URL directe
 *   cookies?: string,               // cookies LinkedIn (li_at=...)
 *   maxPeople?: number,             // défaut 20
 *   extractEmployees?: boolean,     // défaut true
 * }
 */
import { NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { startBusinessScrapeJob } from "@/lib/scraper/business-job-store"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      query,
      location,
      linkedinSlug,
      linkedinUrl,
      cookies,
      maxPeople,
      extractEmployees,
    } = body

    if (!query && !linkedinSlug && !linkedinUrl) {
      return errorResponse("Requête (nom), linkedinSlug ou linkedinUrl requis", 400)
    }

    const jobId = `biz-scrape-${randomUUID().slice(0, 8)}`
    const searchQuery = {
      query: query?.trim() || "",
      location: location?.trim() || undefined,
      linkedinSlug: linkedinSlug?.trim() || undefined,
      linkedinUrl: linkedinUrl?.trim() || undefined,
      cookies: cookies?.trim() || undefined,
      maxPeople: Math.min(maxPeople || 20, 50),
      extractEmployees: extractEmployees !== false,
      country: "ci",
      language: "fr",
    }

    const state = startBusinessScrapeJob(jobId, searchQuery)

    const hasCookies = !!cookies
    const estimatedDurationMs = 30000 // ~30s pour une entreprise LinkedIn

    return jsonResponse({
      jobId: state.id,
      status: "queued",
      query: {
        ...searchQuery,
        cookies: searchQuery.cookies ? "***" : undefined,
      },
      authenticated: hasCookies,
      estimatedDurationMs,
      message: hasCookies
        ? "Job d'identification lancé avec cookies LinkedIn. Extraction complète des dirigeants et employés."
        : "Job d'identification lancé SANS cookies. Fonctionne pour les grandes entreprises publiques (Orange, MTN, etc.). Pour les PME, fournissez des cookies LinkedIn (li_at).",
    }, { status: 202 })
  } catch (err) {
    console.error("[scraper/business] POST error:", err)
    return errorResponse("Erreur lors du lancement du job", 500)
  }
}
