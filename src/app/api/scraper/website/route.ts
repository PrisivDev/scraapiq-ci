/**
 * POST /api/scraper/website
 * Lance un robot qui visite un site et extrait les contacts
 *
 * Body: {
 *   url: string,                      // "https://www.orange.ci"
 *   pageTypes?: string[],             // défaut ["contact", "about", "legal"]
 *   maxPages?: number,                // défaut 8
 *   pageTimeout?: number,             // défaut 25000
 * }
 */
import { NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { startWebsiteScrapeJob } from "@/lib/scraper/website-job-store"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, pageTypes, maxPages, pageTimeout } = body

    if (!url || typeof url !== "string") {
      return errorResponse("URL requise", 400)
    }

    // Valide l'URL
    try {
      let urlToCheck = url
      if (!/^https?:\/\//i.test(urlToCheck)) urlToCheck = "https://" + urlToCheck
      new URL(urlToCheck)
    } catch {
      return errorResponse("URL invalide", 400)
    }

    const jobId = `ws-scrape-${randomUUID().slice(0, 8)}`
    const query = {
      url: url.trim(),
      pageTypes: Array.isArray(pageTypes) ? pageTypes : ["contact", "about", "legal"],
      maxPages: Math.min(maxPages || 8, 15),
      pageTimeout: Math.min(pageTimeout || 25000, 60000),
      followFooterLinks: true,
      maxDepth: 1,
    }

    const state = startWebsiteScrapeJob(jobId, query)

    return jsonResponse({
      jobId: state.id,
      status: "queued",
      query,
      estimatedDurationMs: query.maxPages! * 5000, // ~5s par page
      message: `Robot lancé sur ${url}. Visite automatique : Accueil, Contact, À propos, Mentions légales, Footer.`,
    }, { status: 202 })
  } catch (err) {
    console.error("[scraper/website] POST error:", err)
    return errorResponse("Erreur lors du lancement du job", 500)
  }
}
