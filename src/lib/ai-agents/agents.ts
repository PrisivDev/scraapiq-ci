/**
 * 10 Agents spécialisés — implémentation des processors
 *
 * Chaque agent reçoit l'état partagé (PipelineState) et la config,
 * exécute sa logique métier, et retourne ses résultats qui seront
 * fusionnés dans le shared data pour les agents suivants.
 */

import { PipelineOrchestrator, registerProcessor, type PipelineState, type PipelineConfig } from "./orchestrator"

// ============================================================================
// AGENT 1 : RECHERCHE DE SOURCES
// ============================================================================

registerProcessor("sources", async (state, config) => {
  const sources: Array<{ id: string; name: string; priority: number; expectedResults: number }> = []
  const queries: Record<string, string> = {}

  // Analyse la requête pour déterminer les sources
  const query = config.query.toLowerCase()

  if (query.includes("restaurant") || query.includes("pharmacie") || query.includes("hôtel") || query.includes("clinique")) {
    sources.push({ id: "google-maps", name: "Google Maps", priority: 1, expectedResults: 50 })
    queries["google-maps"] = `${config.query} ${config.commune || ""} ${config.city || "Abidjan"}`
  }

  sources.push({ id: "facebook", name: "Facebook Pages", priority: 2, expectedResults: 30 })
  queries["facebook"] = `${config.query} ${config.city || "Abidjan"}`

  if (query.includes("entreprise") || query.includes("btp") || query.includes("banque")) {
    sources.push({ id: "linkedin", name: "LinkedIn", priority: 3, expectedResults: 20 })
    queries["linkedin"] = `${config.query} ${config.city || "Côte d'Ivoire"}`
  }

  sources.push({ id: "website", name: "Sites Web", priority: 4, expectedResults: 15 })
  sources.push({ id: "rccm", name: "RCCM CI", priority: 5, expectedResults: 10 })

  await sleep(800) // simulation

  return {
    selectedSources: sources,
    searchQueries: queries,
    collectionPlan: {
      totalSources: sources.length,
      estimatedResults: sources.reduce((s, src) => s + src.expectedResults, 0),
      estimatedDuration: sources.length * 3000,
      parallel: true,
    },
  }
})

// ============================================================================
// AGENT 2 : SCRAPING
// ============================================================================

registerProcessor("scraping", async (state, config) => {
  const sources = (state.sharedData.selectedSources as Array<Record<string, unknown>>) || []
  const queries = (state.sharedData.searchQueries as Record<string, string>) || {}

  const rawData: Record<string, unknown[]> = {}
  let totalCollected = 0

  for (const source of sources) {
    const sourceId = source.id as string
    const count = (source.expectedResults as number) || 10

    // Simule la collecte
    const items = Array.from({ length: Math.min(count, 15) }, (_, i) => ({
      id: `${sourceId}-${i}`,
      source: sourceId,
      name: `Entreprise ${String.fromCharCode(65 + i)} (${sourceId})`,
      sector: config.query,
      city: config.city || "Abidjan",
      commune: config.commune || "Cocody",
      phone: `+225 0${Math.floor(Math.random() * 9) + 1} ${Math.floor(Math.random() * 90 + 10)} ${Math.floor(Math.random() * 90 + 10)} ${Math.floor(Math.random() * 90 + 10)} ${Math.floor(Math.random() * 90 + 10)}`,
      email: Math.random() > 0.4 ? `contact@entreprise-${i}.ci` : null,
      website: Math.random() > 0.5 ? `entreprise-${i}.ci` : null,
      address: `${Math.floor(Math.random() * 100)} Rue, ${config.commune || "Cocody"}`,
      lat: 5.3 + Math.random() * 0.2,
      lng: -4.0 + Math.random() * 0.1,
      rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
      reviewCount: Math.floor(Math.random() * 200) + 5,
      scrapedAt: new Date().toISOString(),
    }))

    rawData[sourceId] = items
    totalCollected += items.length
    await sleep(300)
  }

  return {
    rawData,
    scrapingStats: {
      totalCollected,
      sourcesUsed: sources.length,
      successRate: 94.2,
      blocksEncountered: 0,
      durationMs: sources.length * 300,
    },
  }
})

// ============================================================================
// AGENT 3 : NETTOYAGE
// ============================================================================

registerProcessor("cleaning", async (state) => {
  const rawData = (state.sharedData.rawData as Record<string, Array<Record<string, unknown>>>) || {}
  const allItems: Array<Record<string, unknown>> = []
  const corrections: Array<Record<string, unknown>> = []

  for (const items of Object.values(rawData)) {
    for (const item of items) {
      const cleaned = { ...item }

      // Normalise téléphone
      if (cleaned.phone) {
        const phone = String(cleaned.phone).replace(/[^\d+]/g, "")
        if (phone.startsWith("+225") && phone.length === 14) {
          cleaned.phone = `+225 ${phone.slice(4, 6)} ${phone.slice(6, 8)} ${phone.slice(8, 10)} ${phone.slice(10, 12)} ${phone.slice(12, 14)}`
          corrections.push({ id: cleaned.id, field: "phone", type: "normalized" })
        }
      }

      // Normalise email
      if (cleaned.email) {
        cleaned.email = String(cleaned.email).toLowerCase().trim()
      }

      // Nettoie nom
      if (cleaned.name) {
        cleaned.name = String(cleaned.name).replace(/\s+(SARL|SA|EURL|SAS)\s*$/i, "").trim()
      }

      allItems.push(cleaned)
    }
  }

  await sleep(600)

  return {
    cleanedData: allItems,
    cleaningStats: {
      totalProcessed: allItems.length,
      correctionsApplied: corrections.length,
      phoneNormalized: corrections.filter((c) => c.type === "normalized").length,
      invalidFields: Math.floor(allItems.length * 0.05),
    },
  }
})

// ============================================================================
// AGENT 4 : DÉDUPLICATION
// ============================================================================

registerProcessor("dedup", async (state) => {
  const items = (state.sharedData.cleanedData as Array<Record<string, unknown>>) || []

  // Simule la déduplication (regroupe par nom similaire)
  const seen = new Map<string, Array<Record<string, unknown>>>()
  for (const item of items) {
    const name = String(item.name || "").toLowerCase().slice(0, 10)
    if (!seen.has(name)) seen.set(name, [])
    seen.get(name)!.push(item)
  }

  const unique: Array<Record<string, unknown>> = []
  const duplicates: Array<Record<string, unknown>> = []

  for (const [key, group] of seen) {
    if (group.length > 1) {
      // Fusionne : garde le premier, marque les autres comme doublons
      unique.push({ ...group[0], mergedFrom: group.length })
      duplicates.push({
        canonical: group[0].name,
        duplicates: group.slice(1).map((g) => g.name),
        similarity: 0.92,
        reason: "name+gps_match",
      })
    } else {
      unique.push(group[0])
    }
  }

  await sleep(500)

  return {
    uniqueEntities: unique,
    dedupStats: {
      inputCount: items.length,
      uniqueCount: unique.length,
      duplicatesRemoved: items.length - unique.length,
      duplicateGroups: duplicates.length,
      avgConfidence: 0.91,
    },
  }
})

// ============================================================================
// AGENT 5 : ENRICHISSEMENT (parallèle avec validation)
// ============================================================================

registerProcessor("enrichment", async (state) => {
  const entities = (state.sharedData.uniqueEntities as Array<Record<string, unknown>>) || []

  const enriched = entities.map((e) => ({
    ...e,
    description: e.description || `Entreprise spécialisée dans ${e.sector || "son secteur"} à ${e.city || "Abidjan"}.`,
    website: e.website || `${String(e.name || "").toLowerCase().replace(/[^a-z0-9]/g, "")}.ci`,
    email: e.email || `contact@${String(e.name || "entreprise").toLowerCase().replace(/[^a-z0-9]/g, "")}.ci`,
    hours: [
      { day: "Lundi", hours: "08:00-18:00" },
      { day: "Mardi", hours: "08:00-18:00" },
    ],
    aiCompletions: [
      { field: "description", confidence: 0.8, source: "llm_inference" },
      { field: "website", confidence: 0.6, source: "rule_guess" },
      { field: "email", confidence: 0.5, source: "rule_guess" },
    ],
  }))

  await sleep(700)

  return {
    enrichedEntities: enriched,
    enrichmentStats: {
      totalEnriched: enriched.length,
      fieldsCompleted: enriched.length * 3,
      llmCalls: Math.ceil(enriched.length / 5),
      avgConfidence: 0.63,
    },
  }
})

// ============================================================================
// AGENT 6 : VALIDATION (parallèle avec enrichissement)
// ============================================================================

registerProcessor("validation", async (state) => {
  const entities = (state.sharedData.uniqueEntities as Array<Record<string, unknown>>) || []

  const validated = entities.map((e) => ({
    ...e,
    emailValid: e.email ? /\S+@\S+\.\S+/.test(String(e.email)) : false,
    phoneValid: e.phone ? String(e.phone).startsWith("+225") : false,
    websiteValid: e.website ? true : false,
    closureIndicators: [],
    businessStatus: "active",
  }))

  await sleep(500)

  return {
    validatedEntities: validated,
    validationStats: {
      totalValidated: validated.length,
      emailsValid: validated.filter((v) => v.emailValid).length,
      phonesValid: validated.filter((v) => v.phoneValid).length,
      websitesValid: validated.filter((v) => v.websiteValid).length,
      closedDetected: 0,
    },
  }
})

// ============================================================================
// AGENT 7 : GÉOCODAGE
// ============================================================================

registerProcessor("geocoding", async (state) => {
  const entities = (state.sharedData.enrichedEntities as Array<Record<string, unknown>>) || []

  const geocoded = entities.map((e) => ({
    ...e,
    gps: {
      lat: (e.lat as number) || 5.36 + Math.random() * 0.1,
      lng: (e.lng as number) || -4.01 + Math.random() * 0.05,
    },
    googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(e.name || ""))}+${encodeURIComponent(String(e.city || "Abidjan"))}`,
    geocodeAccuracy: "commune",
  }))

  await sleep(400)

  return {
    geocodedEntities: geocoded,
    geocodingStats: {
      totalGeocoded: geocoded.length,
      successRate: 96.5,
      avgAccuracy: "commune",
      osmCalls: geocoded.length,
    },
  }
})

// ============================================================================
// AGENT 8 : CLASSIFICATION
// ============================================================================

registerProcessor("classification", async (state) => {
  const entities = (state.sharedData.geocodedEntities as Array<Record<string, unknown>>) || []

  const sectors = ["Restauration", "Santé & Pharmacie", "BTP & Construction", "Télécommunications", "Commerce", "Banque & Finance"]
  const classified = entities.map((e, i) => ({
    ...e,
    detectedSector: sectors[i % sectors.length],
    sectorCode: ["RESTO", "PHARM", "BTP", "TELCO", "COMMERCE", "BANK"][i % 6],
    sectorKeywords: [String(e.sector || ""), String(e.name || "").split(" ")[0]],
    classificationConfidence: 0.85 + Math.random() * 0.1,
  }))

  await sleep(400)

  return {
    classifiedEntities: classified,
    classificationStats: {
      totalClassified: classified.length,
      sectorsDetected: sectors.length,
      avgConfidence: 0.89,
      method: "hybrid_rules_llm",
    },
  }
})

// ============================================================================
// AGENT 9 : SCORING
// ============================================================================

registerProcessor("scoring", async (state) => {
  const entities = (state.sharedData.classifiedEntities as Array<Record<string, unknown>>) || []

  const scored = entities.map((e) => {
    const completeness = Math.random() * 30 + 60
    const contactValidity = Math.random() * 25 + 65
    const nameQuality = Math.random() * 15 + 80
    const geoAccuracy = Math.random() * 30 + 55
    const sourceReliability = Math.random() * 20 + 75
    const freshness = 90
    const onlinePresence = Math.random() * 35 + 50

    const score = Math.round(
      completeness * 0.25 + contactValidity * 0.20 + nameQuality * 0.10 +
      geoAccuracy * 0.15 + sourceReliability * 0.15 + freshness * 0.05 + onlinePresence * 0.10
    )

    return {
      ...e,
      qualityScore: score,
      qualityCategory: score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D",
      qualityBreakdown: { completeness, contactValidity, nameQuality, geoAccuracy, sourceReliability, freshness, onlinePresence },
    }
  })

  await sleep(300)

  return {
    scoredEntities: scored,
    scoringStats: {
      totalScored: scored.length,
      avgScore: Math.round(scored.reduce((s, e) => s + (e.qualityScore as number), 0) / scored.length),
      categoryA: scored.filter((e) => e.qualityCategory === "A").length,
      categoryB: scored.filter((e) => e.qualityCategory === "B").length,
      categoryC: scored.filter((e) => e.qualityCategory === "C").length,
      categoryD: scored.filter((e) => e.qualityCategory === "D").length,
    },
  }
})

// ============================================================================
// AGENT 10 : EXPORT
// ============================================================================

registerProcessor("export", async (state) => {
  const entities = (state.sharedData.scoredEntities as Array<Record<string, unknown>>) || []

  await sleep(500)

  return {
    exportResults: {
      format: "xlsx",
      filename: `export_${state.jobId}.xlsx`,
      rows: entities.length,
      sizeBytes: entities.length * 500,
      downloadUrl: `/api/v1/queue/test`,
    },
    notificationsSent: [
      { channel: "in_app", status: "sent" },
      { channel: "email", status: "sent" },
    ],
    auditEntries: entities.length,
    exportStats: {
      totalExported: entities.length,
      format: "xlsx",
      durationMs: 500,
    },
  }
})

// ============================================================================
// HELPER
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// Re-export pour l'API
export { PipelineOrchestrator }
