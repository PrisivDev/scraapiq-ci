/**
 * POST /api/assistant
 * Assistant IA — traduit le langage naturel en recherche
 *
 * Body: { query: string }
 * Returns: { query, analysis, results, total, naturalResponse, took, suggestions }
 */
import { NextRequest } from "next/server"
import { processAssistantQuery } from "@/lib/assistant/assistant-engine"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { query } = body

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return errorResponse("Requête requise (min 2 caractères)", 400)
    }

    const response = await processAssistantQuery(query.trim())

    return jsonResponse(response)
  } catch (err) {
    console.error("[assistant] error:", err)
    return errorResponse("Erreur lors du traitement de la requête", 500)
  }
}
