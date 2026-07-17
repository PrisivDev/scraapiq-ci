/**
 * Détection du secteur d'activité — hybride règles + LLM
 *
 * 1. Règles déterministes (rapides, fiables sur mots-clés évidents)
 * 2. LLM z-ai pour les cas ambigus (description longue, nom peu clair)
 */

import ZAI from "z-ai-web-dev-sdk"
import { SECTOR_REFERENCE } from "./ai-cleaner-types"
import type { CleanedEntity } from "./ai-cleaner-types"

/**
 * Détection déterministe par mots-clés
 */
export function detectSectorByRules(entity: CleanedEntity): {
  sector: string | null
  code: string | null
  keywords: string[]
  confidence: number
} {
  // Combine tous les textes possibles
  const texts = [
    entity.name || "",
    entity.category || "",
    entity.sector || "",
    entity.description || "",
  ].filter(Boolean)

  if (texts.length === 0) {
    return { sector: null, code: null, keywords: [], confidence: 0 }
  }

  const combinedText = texts.join(" ").toLowerCase()

  const scores: Array<{ ref: typeof SECTOR_REFERENCE[0]; score: number; matchedKeywords: string[] }> = []

  for (const ref of SECTOR_REFERENCE) {
    let score = 0
    const matchedKeywords: string[] = []
    for (const kw of ref.keywords) {
      const kwLower = kw.toLowerCase()
      if (combinedText.includes(kwLower)) {
        score += 1
        matchedKeywords.push(kw)
      }
    }
    if (score > 0) {
      scores.push({ ref, score, matchedKeywords })
    }
  }

  if (scores.length === 0) {
    return { sector: null, code: null, keywords: [], confidence: 0 }
  }

  // Trie par score
  scores.sort((a, b) => b.score - a.score)
  const best = scores[0]

  // Confiance basée sur le score et l'écart avec le 2e
  const confidence = Math.min(0.95, 0.5 + best.score * 0.15 + (scores.length === 1 ? 0.1 : 0))

  return {
    sector: best.ref.label,
    code: best.ref.code,
    keywords: best.matchedKeywords,
    confidence,
  }
}

/**
 * Détection par LLM (pour les cas ambigus)
 */
export async function detectSectorByLLM(entity: CleanedEntity): Promise<{
  sector: string | null
  code: string | null
  confidence: number
  method: string
}> {
  try {
    const zai = await ZAI.create()

    const entityInfo = JSON.stringify({
      name: entity.name,
      category: entity.category,
      description: entity.description?.slice(0, 500),
      sector: entity.sector,
    })

    const sectorsList = SECTOR_REFERENCE.map((s) => `- ${s.code}: ${s.label}`).join("\n")

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: `Tu es un expert en classification d'entreprises ivoiriennes. À partir du nom, de la catégorie et de la description d'une entreprise, identifie le secteur d'activité le plus probable parmi cette liste :

${sectorsList}

Réponds UNIQUEMENT avec un JSON valide de la forme :
{"code": "CODE_SECTEUR", "label": "Libellé du secteur", "confidence": 0.85}

Si aucune correspondance n'est trouvée, réponds :
{"code": null, "label": null, "confidence": 0}`,
        },
        {
          role: "user",
          content: `Entreprise à classifier :\n${entityInfo}`,
        },
      ],
      thinking: { type: "disabled" },
    })

    const response = completion.choices[0]?.message?.content || ""

    // Parse le JSON (parfois enveloppé dans ```json)
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { sector: null, code: null, confidence: 0, method: "llm_no_json" }
    }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      sector: parsed.label,
      code: parsed.code,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      method: "llm",
    }
  } catch (err) {
    console.error("[ai] detectSectorByLLM error:", err)
    return { sector: null, code: null, confidence: 0, method: "llm_error" }
  }
}

/**
 * Détection hybride : règles d'abord, LLM si confiance faible
 */
export async function detectSectorHybrid(
  entity: CleanedEntity,
  useLLM = true,
  minConfidence = 0.7
): Promise<{
  sector: string | null
  code: string | null
  keywords: string[]
  confidence: number
  method: string
}> {
  // 1. Règles
  const rules = detectSectorByRules(entity)

  if (rules.sector && rules.confidence >= minConfidence) {
    return { ...rules, method: "rules" }
  }

  // 2. LLM si règles insuffisantes
  if (useLLM) {
    const llm = await detectSectorByLLM(entity)
    if (llm.sector && llm.confidence > (rules.confidence || 0)) {
      return {
        sector: llm.sector,
        code: llm.code,
        keywords: rules.keywords,
        confidence: llm.confidence,
        method: "llm",
      }
    }
  }

  // 3. Fallback sur règles même si faible confiance
  if (rules.sector) {
    return { ...rules, method: "rules_low_confidence" }
  }

  return { sector: null, code: null, keywords: [], confidence: 0, method: "unknown" }
}
