/**
 * POST /api/scraper/facebook
 * Lance un job de scraping Facebook Pages
 *
 * Body: {
 *   keyword: string,            // "restaurant"
 *   city?: string,              // "Abidjan"
 *   commune?: string,           // "Cocody"
 *   neighborhood?: string,
 *   maxResults?: number,        // défaut 10
 *   cookies?: string,           // cookies Facebook (c_user=...; xs=...; datr=...; fr=...)
 *   pageUrl?: string,           // URL directe d'une page Facebook (skip recherche)
 * }
 *
 * Returns: { jobId, status: "queued", query, message }
 */
import { NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { startFacebookScrapeJob } from "@/lib/scraper/facebook-job-store"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      keyword,
      city,
      commune,
      neighborhood,
      maxResults,
      cookies,
      pageUrl,
    } = body

    // Soit keyword, soit pageUrl doit être fourni
    if (!keyword && !pageUrl) {
      return errorResponse("Mot-clé ou URL de page requis", 400)
    }

    if (keyword && typeof keyword !== "string" && keyword.trim().length < 2) {
      return errorResponse("Mots-clés trop courts (min 2 caractères)", 400)
    }

    const jobId = `fb-scrape-${randomUUID().slice(0, 8)}`
    const query = {
      keyword: keyword?.trim() || "",
      city: city?.trim() || undefined,
      commune: commune?.trim() || undefined,
      neighborhood: neighborhood?.trim() || undefined,
      country: "Côte d'Ivoire",
      maxResults: Math.min(maxResults || 10, 30), // hard cap 30 pour FB
      language: "fr",
      cookies: cookies?.trim() || undefined,
      pageUrl: pageUrl?.trim() || undefined,
    }

    const state = startFacebookScrapeJob(jobId, query)

    const hasCookies = !!cookies
    const estimatedDurationMs = (query.maxResults || 10) * 5000 // ~5s par page (FB plus lent)

    return jsonResponse({
      jobId: state.id,
      status: "queued",
      query: {
        ...query,
        cookies: query.cookies ? "***" : undefined, // ne pas renvoyer les cookies
      },
      authenticated: hasCookies,
      estimatedDurationMs,
      message: hasCookies
        ? "Job de scraping Facebook lancé avec cookies d'authentification."
        : "Job de scraping Facebook lancé SANS cookies. La plupart des pages nécessitent une authentification — fournissez des cookies (c_user, xs) pour de meilleurs résultats.",
    }, { status: 202 })
  } catch (err) {
    console.error("[scraper/facebook] POST error:", err)
    return errorResponse("Erreur lors du lancement du job", 500)
  }
}
