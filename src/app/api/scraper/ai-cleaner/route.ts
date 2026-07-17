/**
 * POST /api/scraper/ai-cleaner
 * Lance un job de nettoyage IA sur un jeu de données
 *
 * Body: {
 *   entities?: ScrapedPlace[],     // entités à nettoyer (si non fourni, utilise un échantillon)
 *   sourceJobId?: string,          // ID d'un job de scraping source
 *   source?: "google-maps" | "facebook" | "business" | "website",
 *   config?: AICleanerConfig,
 * }
 *
 * Si aucun entities/sourceJobId fourni, utilise un échantillon de démonstration.
 */
import { NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { startAICleanerJob } from "@/lib/scraper/ai-cleaner-job-store"
import { getJob as getGMJob } from "@/lib/scraper/job-store"
import { getFacebookJob } from "@/lib/scraper/facebook-job-store"
import { getBusinessJob } from "@/lib/scraper/business-job-store"
import { getWebsiteJob } from "@/lib/scraper/website-job-store"
import { getSampleEntities } from "@/lib/scraper/ai-cleaner-sample"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"

export const maxDuration = 300

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { entities, sourceJobId, source, config } = body

    let inputEntities = entities

    // Si sourceJobId fourni, récupère les entités du job source
    if (sourceJobId) {
      let sourceResult: { places?: unknown[] } | null = null

      if (source === "google-maps") {
        const job = getGMJob(sourceJobId)
        sourceResult = job?.result
      } else if (source === "facebook") {
        const job = getFacebookJob(sourceJobId)
        sourceResult = job?.result
      } else if (source === "business") {
        const job = getBusinessJob(sourceJobId)
        sourceResult = job?.result
      } else if (source === "website") {
        const job = getWebsiteJob(sourceJobId)
        sourceResult = job?.result
      } else {
        // Tente tous les stores
        const gm = getGMJob(sourceJobId)
        const fb = getFacebookJob(sourceJobId)
        const biz = getBusinessJob(sourceJobId)
        const ws = getWebsiteJob(sourceJobId)
        sourceResult = gm?.result || fb?.result || biz?.result || ws?.result
      }

      if (sourceResult?.places && Array.isArray(sourceResult.places)) {
        inputEntities = sourceResult.places
      }
    }

    // Si toujours pas d'entités, utilise l'échantillon de démo
    if (!inputEntities || !Array.isArray(inputEntities) || inputEntities.length === 0) {
      inputEntities = getSampleEntities()
    }

    if (inputEntities.length === 0) {
      return errorResponse("Aucune entité à nettoyer", 400)
    }

    const jobId = `ai-clean-${randomUUID().slice(0, 8)}`
    const cleanerConfig = {
      useLLM: config?.useLLM ?? true,
      minConfidence: config?.minConfidence ?? 0.7,
      detectClosed: config?.detectClosed ?? true,
      completeMissing: config?.completeMissing ?? true,
      detectSector: config?.detectSector ?? true,
      language: "fr",
      country: "ci",
    }

    const state = startAICleanerJob(jobId, inputEntities, cleanerConfig)

    return jsonResponse({
      jobId: state.id,
      status: "queued",
      inputCount: inputEntities.length,
      config: cleanerConfig,
      estimatedDurationMs: inputEntities.length * 3000, // ~3s par entité
      message: `Moteur IA lancé sur ${inputEntities.length} entité(s). Pipeline : déduplication → fusion → correction → enrichissement → score → détection fermetures.`,
    }, { status: 202 })
  } catch (err) {
    console.error("[ai-cleaner] POST error:", err)
    return errorResponse("Erreur lors du lancement du job IA", 500)
  }
}
