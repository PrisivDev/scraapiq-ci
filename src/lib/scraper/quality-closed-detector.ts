/**
 * Score de qualité d'une fiche entreprise + détection de fermeture
 */

import type { CleanedEntity, QualityBreakdown, BusinessStatus } from "./ai-cleaner-types"
import { CLOSURE_INDICATORS } from "./ai-cleaner-types"

/**
 * Calcule le score de qualité global (0-100) avec détail par dimension
 */
export function calculateQualityScore(entity: CleanedEntity): {
  score: number
  breakdown: QualityBreakdown
} {
  const breakdown: QualityBreakdown = {
    completeness: 0,
    contactValidity: 0,
    nameQuality: 0,
    geoAccuracy: 0,
    sourceReliability: 0,
    freshness: 0,
    onlinePresence: 0,
  }

  // 1. Complétude (25%)
  const importantFields = [
    "name", "phone", "email", "address", "website",
    "sector", "gps", "description", "hours",
  ]
  const filledFields = importantFields.filter((f) => {
    const val = (entity as Record<string, unknown>)[f]
    if (val === undefined || val === null) return false
    if (typeof val === "string") return val.trim().length > 0
    if (Array.isArray(val)) return val.length > 0
    if (typeof val === "object") return Object.keys(val).length > 0
    return true
  })
  breakdown.completeness = Math.round((filledFields.length / importantFields.length) * 100)

  // 2. Validité des coordonnées (20%)
  let contactScore = 0
  if (entity.phone) contactScore += 25
  if (entity.phoneCorrected !== false) contactScore += 15
  if (entity.email) contactScore += 25
  if (entity.emailValid) contactScore += 15
  if (entity.website) contactScore += 10
  if (entity.cleanedPhone && entity.cleanedPhone.startsWith("+225")) contactScore += 10
  breakdown.contactValidity = Math.min(100, contactScore)

  // 3. Qualité du nom (10%)
  if (entity.cleanedName) {
    breakdown.nameQuality = 100
  } else if (entity.name && entity.name.length > 3) {
    breakdown.nameQuality = 70
  } else if (entity.name) {
    breakdown.nameQuality = 40
  }

  // 4. Précision géoloc (15%)
  if (entity.gps && entity.gps.lat && entity.gps.lng) {
    breakdown.geoAccuracy = 100
  } else if (entity.cleanedAddress || entity.address) {
    breakdown.geoAccuracy = 50
  }

  // 5. Fiabilité source (15%)
  const sources = entity.sources || []
  if (sources.includes("google_maps")) breakdown.sourceReliability += 40
  if (sources.includes("rccm")) breakdown.sourceReliability += 30
  if (sources.includes("linkedin")) breakdown.sourceReliability += 20
  if (sources.includes("website")) breakdown.sourceReliability += 15
  if (sources.includes("facebook")) breakdown.sourceReliability += 10
  breakdown.sourceReliability = Math.min(100, breakdown.sourceReliability)

  // 6. Fraîcheur (5%)
  if (entity.scrapedAt) {
    const scrapedDate = new Date(entity.scrapedAt)
    const daysSinceScraped = (Date.now() - scrapedDate.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceScraped < 7) breakdown.freshness = 100
    else if (daysSinceScraped < 30) breakdown.freshness = 80
    else if (daysSinceScraped < 90) breakdown.freshness = 60
    else if (daysSinceScraped < 180) breakdown.freshness = 40
    else breakdown.freshness = 20
  }

  // 7. Présence online (10%)
  if (entity.website) breakdown.onlinePresence += 40
  if (entity.socialLinks && entity.socialLinks.length > 0) {
    breakdown.onlinePresence += Math.min(60, entity.socialLinks.length * 15)
  } else if (sources.includes("facebook") || sources.includes("linkedin")) {
    breakdown.onlinePresence += 30
  }

  // Score global pondéré
  const weights = {
    completeness: 0.25,
    contactValidity: 0.20,
    nameQuality: 0.10,
    geoAccuracy: 0.15,
    sourceReliability: 0.15,
    freshness: 0.05,
    onlinePresence: 0.10,
  }

  const score = Math.round(
    breakdown.completeness * weights.completeness +
    breakdown.contactValidity * weights.contactValidity +
    breakdown.nameQuality * weights.nameQuality +
    breakdown.geoAccuracy * weights.geoAccuracy +
    breakdown.sourceReliability * weights.sourceReliability +
    breakdown.freshness * weights.freshness +
    breakdown.onlinePresence * weights.onlinePresence
  )

  return { score: Math.min(100, Math.max(0, score)), breakdown }
}

/**
 * Détecte les indicateurs de fermeture dans les textes de l'entreprise
 */
export function detectClosureIndicators(entity: CleanedEntity): {
  status: BusinessStatus
  indicators: string[]
  confidence: number
} {
  const texts = [
    entity.name || "",
    entity.description || "",
    entity.address || "",
    entity.category || "",
  ].filter(Boolean)

  const combinedText = texts.join(" ").toLowerCase()
  const foundIndicators: string[] = []

  for (const indicator of CLOSURE_INDICATORS) {
    if (combinedText.includes(indicator.toLowerCase())) {
      foundIndicators.push(indicator)
    }
  }

  // Note faible + avis négatifs nombreux = possible fermeture
  if (entity.rating && entity.rating < 2 && (entity.reviewCount || 0) > 5) {
    foundIndicators.push("very_low_rating")
  }

  // Pas de site + pas de tél + pas d'email = activité douteuse
  if (!entity.website && !entity.phone && !entity.email) {
    foundIndicators.push("no_contact_info")
  }

  if (foundIndicators.length === 0) {
    return { status: "active", indicators: [], confidence: 0.9 }
  }

  // Détermine le statut
  let status: BusinessStatus = "unknown"
  let confidence = 0.5

  if (foundIndicators.some((i) => i.includes("fermé") || i.includes("closed") || i.includes("out of business") || i.includes("ceased") || i.includes("plus en activité"))) {
    status = "closed"
    confidence = 0.85
  } else if (foundIndicators.some((i) => i.includes("relocated") || i.includes("déménagé"))) {
    status = "relocated"
    confidence = 0.8
  } else if (foundIndicators.some((i) => i.includes("faillite") || i.includes("liquidation") || i.includes("bankrupt"))) {
    status = "closed"
    confidence = 0.9
  } else if (foundIndicators.includes("no_contact_info")) {
    status = "unknown"
    confidence = 0.4
  }

  return { status, indicators: foundIndicators, confidence }
}

/**
 * Détection de fermeture par LLM (pour les cas ambigus)
 */
export async function detectClosureByLLM(entity: CleanedEntity): Promise<{
  status: BusinessStatus
  indicators: string[]
  confidence: number
}> {
  try {
    const ZAI = (await import("z-ai-web-dev-sdk")).default
    const zai = await ZAI.create()

    const entityInfo = JSON.stringify({
      name: entity.name,
      description: entity.description?.slice(0, 500),
      address: entity.address,
      rating: entity.rating,
      reviewCount: entity.reviewCount,
      isOpenNow: entity.isOpenNow,
    })

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: `Tu es un expert en analyse d'entreprises. À partir des informations fournies, détermine si cette entreprise est active, fermée définitivement, temporairement fermée, ou relocalisée.

Réponds UNIQUEMENT avec un JSON valide :
{"status": "active|closed|temporarily_closed|relocated|unknown", "indicators": ["indicateur1", "indicateur2"], "confidence": 0.85}

Status possibles :
- active : en activité normale
- closed : fermée définitivement
- temporarily_closed : fermée temporairement
- relocated : a déménagé
- unknown : impossible à déterminer`,
        },
        {
          role: "user",
          content: `Entreprise à analyser :\n${entityInfo}`,
        },
      ],
      thinking: { type: "disabled" },
    })

    const response = completion.choices[0]?.message?.content || ""
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return { status: "unknown", indicators: [], confidence: 0 }
    }

    const parsed = JSON.parse(jsonMatch[0])
    return {
      status: parsed.status as BusinessStatus,
      indicators: parsed.indicators || [],
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
    }
  } catch (err) {
    console.error("[ai] detectClosureByLLM error:", err)
    return { status: "unknown", indicators: [], confidence: 0 }
  }
}
