/**
 * POST /api/search
 * Moteur de recherche intelligent avec IA + Elasticsearch
 *
 * Body: {
 *   query: string,         // "Restaurant Cocody"
 *   useLLM?: boolean,      // défaut true
 *   size?: number,         // défaut 10
 *   from?: number,         // défaut 0
 *   filters?: Record<string, string>,  // filtres additionnels
 *   aggregations?: string[],
 * }
 *
 * Returns: {
 *   query, intent, results, aggregations, suggestions, took, total, stats
 * }
 */
import { NextRequest } from "next/server"
import { searchEngine, getSearchStats } from "@/lib/search/search-store"
import { analyzeIntentHybrid, type SearchIntent } from "@/lib/search/intent-analyzer"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      query,
      useLLM = true,
      size = 20,
      from = 0,
      filters: extraFilters = {},
      aggregations = ["sector", "city", "commune"],
    } = body

    if (!query || typeof query !== "string" || query.trim().length < 1) {
      return errorResponse("Requête requise", 400)
    }

    // 1. Analyse d'intention IA
    const intent: SearchIntent = await analyzeIntentHybrid(query.trim(), useLLM, 0.6)

    // 2. Fusionne les filtres (intent + extra)
    const mergedFilters: Record<string, string | string[]> = { ...extraFilters }
    if (intent.filters) {
      for (const [k, v] of Object.entries(intent.filters)) {
        if (!mergedFilters[k]) mergedFilters[k] = v
      }
    }

    // 3. Recherche Elasticsearch
    const searchResult = searchEngine.search({
      query: intent.searchQuery,
      filters: Object.keys(mergedFilters).length > 0 ? mergedFilters : undefined,
      fuzzy: true,
      fuzzyDistance: 2,
      size,
      from,
      aggregations,
    })

    return jsonResponse({
      query: query.trim(),
      intent,
      results: searchResult.hits,
      aggregations: searchResult.aggregations,
      suggestions: searchResult.suggestions,
      total: searchResult.total,
      took: searchResult.took,
      stats: getSearchStats(),
    })
  } catch (err) {
    console.error("[search] error:", err)
    return errorResponse("Erreur lors de la recherche", 500)
  }
}

/**
 * GET /api/search?q=restaurant+cocody
 * Variante GET pour usage simple
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get("q") || ""
  const size = parseInt(searchParams.get("size") || "20", 10)

  if (!query) {
    return errorResponse("Paramètre q requis", 400)
  }

  const intent = await analyzeIntentHybrid(query, true, 0.6)
  const searchResult = searchEngine.search({
    query: intent.searchQuery,
    filters: intent.filters,
    fuzzy: true,
    size,
    aggregations: ["sector", "city", "commune"],
  })

  return jsonResponse({
    query,
    intent,
    results: searchResult.hits,
    aggregations: searchResult.aggregations,
    total: searchResult.total,
    took: searchResult.took,
  })
}
