/**
 * Analyseur d'intention IA — LLM z-ai
 *
 * Comprend le langage naturel et extrait :
 *  - sector : secteur d'activité (ex: "Restaurant" → "Restauration")
 *  - city : ville (ex: "Grand Bassam" → "Grand-Bassam")
 *  - commune : commune (ex: "Cocody")
 *  - neighborhood : quartier (ex: "Riviera 2")
 *  - keywords : mots-clés additionnels
 *  - intent : type de recherche (find_business, find_contact, etc.)
 *
 * Exemples :
 *  "Restaurant Cocody" → { sector: "Restauration", commune: "Cocody", city: "Abidjan" }
 *  "Pharmacie Yopougon" → { sector: "Santé & Pharmacie", commune: "Yopougon", city: "Abidjan" }
 *  "BTP Bouaké" → { sector: "BTP & Construction", city: "Bouaké" }
 *  "Hôtel Grand Bassam" → { sector: "Tourisme & Hôtellerie", city: "Grand-Bassam" }
 *  "Clinique Abidjan" → { sector: "Santé & Pharmacie", city: "Abidjan" }
 */

import ZAI from "z-ai-web-dev-sdk"

export interface SearchIntent {
  /** Secteur d'activité normalisé */
  sector?: string
  /** Secteur code (ex: RESTO, PHARM, BTP) */
  sectorCode?: string
  /** Ville détectée */
  city?: string
  /** Commune détectée (Abidjan) */
  commune?: string
  /** Quartier détecté */
  neighborhood?: string
  /** Mots-clés additionnels */
  keywords?: string[]
  /** Intention de la recherche */
  intent: "find_business" | "find_contact" | "find_location" | "general_search"
  /** Confiance globale (0-1) */
  confidence: number
  /** Requête reformulée pour Elasticsearch */
  searchQuery: string
  /** Méthode utilisée */
  method: "rules" | "llm" | "hybrid"
  /** Filtres dérivés pour Elasticsearch */
  filters?: Record<string, string>
}

// Référentiel secteurs pour matching par règles
const SECTOR_SYNONYMS: Array<{ code: string; label: string; synonyms: string[] }> = [
  { code: "RESTO", label: "Restauration", synonyms: ["restaurant", "resto", "maquis", "bar", "snack", "fast food", "food", "cuisine", "traiteur", "pizzeria", "buvette"] },
  { code: "PHARM", label: "Santé & Pharmacie", synonyms: ["pharmacie", "pharma", "clinique", "hopital", "hôpital", "medical", "medecin", "cabinet medical", "laboratoire", "santé", "sante", "dispensaire", "infirmerie"] },
  { code: "BANK", label: "Banque & Finance", synonyms: ["banque", "bank", "finance", "assurance", "microfinance", "credit", "crédit", "epargne", "caisse", "dab", "guichet"] },
  { code: "TELCO", label: "Télécommunications", synonyms: ["telecom", "telecommunication", "mobile", "internet", "operator", "orange", "mtn", "moov", "reseau", "forfait"] },
  { code: "BTP", label: "BTP & Construction", synonyms: ["btp", "construction", "batiment", "building", "genie civil", "travaux", "immobilier", "real estate", "entreprise btp", "gros oeuvre"] },
  { code: "AGRI", label: "Agro-alimentaire", synonyms: ["agro", "agriculture", "alimentaire", "ferme", "elevage", "cacao", "cafe", "riz", "exportation"] },
  { code: "COMMERCE", label: "Commerce", synonyms: ["commerce", "shop", "boutique", "store", "vente", "distribution", "magasin", "marche", "supermarche", "hypermarche"] },
  { code: "TRANSPORT", label: "Transport & Logistique", synonyms: ["transport", "logistique", "logistics", "livraison", "delivery", "shipping", "freight", "cargo", "transit"] },
  { code: "IT", label: "Technologie & IT", synonyms: ["it", "tech", "technology", "informatique", "software", "digital", "internet", "web", "app", "startup"] },
  { code: "EDUC", label: "Éducation & Formation", synonyms: ["ecole", "school", "formation", "education", "cours", "institut", "academie", "universite", "training", "centre de formation"] },
  { code: "ENERGY", label: "Énergie", synonyms: ["energie", "energy", "electricite", "petrole", "oil", "gas", "gaz", "solaire", "solar", "cie"] },
  { code: "TOURISM", label: "Tourisme & Hôtellerie", synonyms: ["hotel", "hôtel", "tourisme", "tourism", "voyage", "travel", "resort", "vacances", "hebergement", "auberge", "pension"] },
  { code: "TEXTILE", label: "Textile & Mode", synonyms: ["textile", "mode", "fashion", "vetement", "clothing", "couture", "tissu"] },
  { code: "AUTO", label: "Automobile", synonyms: ["auto", "automobile", "car", "voiture", "garage", "mecanique", "moto", "vehicle"] },
  { code: "BEAUTY", label: "Beauté & Bien-être", synonyms: ["beaute", "beauty", "spa", "salon", "coiffure", "massage", "bien-etre", "wellness", "cosmetique", "onglerie"] },
  { code: "MEDIA", label: "Médias & Communication", synonyms: ["media", "presse", "communication", "marketing", "publicite", "advertising", "radio", "tv", "television"] },
  { code: "LEGAL", label: "Services Juridiques", synonyms: ["avocat", "lawyer", "juridique", "legal", "notaire", "conseil juridique", "huissier"] },
  { code: "CONSULT", label: "Conseil & Services", synonyms: ["conseil", "consulting", "service", "services", "audit", "conseil entreprise"] },
]

// Villes de Côte d'Ivoire (avec variantes orthographiques)
const CI_CITIES_SYNONYMS: Array<{ canonical: string; synonyms: string[] }> = [
  { canonical: "Abidjan", synonyms: ["abidjan", "abj"] },
  { canonical: "Bouaké", synonyms: ["bouake", "bouaké", "bke"] },
  { canonical: "Yamoussoukro", synonyms: ["yamoussoukro", "yam", "yakro"] },
  { canonical: "San-Pédro", synonyms: ["san-pedro", "san pedro", "sanpédro", "spl"] },
  { canonical: "Grand-Bassam", synonyms: ["grand-bassam", "grand bassam", "bassam", "gbassam"] },
  { canonical: "Korhogo", synonyms: ["korhogo", "kho"] },
  { canonical: "Daloa", synonyms: ["daloa", "dlc"] },
  { canonical: "Man", synonyms: ["man", "mtn city"] },
  { canonical: "Gagnoa", synonyms: ["gagnoa", "gna"] },
  { canonical: "Divo", synonyms: ["divo"] },
  { canonical: "Abengourou", synonyms: ["abengourou", "abg"] },
]

// Communes d'Abidjan
const ABIDJAN_COMMUNES = [
  "Cocody", "Plateau", "Yopougon", "Marcory", "Treichville",
  "Koumassi", "Abobo", "Adjamé", "Port-Bouët", "Bingerville",
  "Attécoubé", "Songon",
]

// Quartiers connus
const NEIGHBORHOODS = [
  "Riviera", "Riviera 2", "Riviera 3", "Riviera 4", "Riviera Palmeraie",
  "Angré", "II Plateaux", "2 Plateaux", "Zone 4", "Zone 4A", "Zone 4B",
  "Williamsville", "Bracodi", "Sicogi", "Selmer", "Vridi",
]

/**
 * Analyse d'intention par règles (rapide, déterministe)
 */
export function analyzeIntentByRules(query: string): SearchIntent {
  const queryLower = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const tokens = queryLower.split(/\s+/)

  let sector: string | undefined
  let sectorCode: string | undefined
  let city: string | undefined
  let commune: string | undefined
  let neighborhood: string | undefined
  const keywords: string[] = []
  let confidence = 0

  // 1. Détection secteur
  for (const { code, label, synonyms } of SECTOR_SYNONYMS) {
    for (const syn of synonyms) {
      if (queryLower.includes(syn)) {
        sector = label
        sectorCode = code
        confidence += 0.4
        break
      }
    }
    if (sector) break
  }

  // 2. Détection ville
  for (const { canonical, synonyms } of CI_CITIES_SYNONYMS) {
    for (const syn of synonyms) {
      // Match exact sur token (pour éviter "Man" dans "management")
      if (syn.length > 3) {
        if (queryLower.includes(syn)) {
          city = canonical
          confidence += 0.3
          break
        }
      } else if (tokens.includes(syn)) {
        city = canonical
        confidence += 0.3
        break
      }
    }
    if (city) break
  }

  // 3. Détection commune (Abidjan)
  for (const com of ABIDJAN_COMMUNES) {
    const comLower = com.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    if (queryLower.includes(comLower)) {
      commune = com
      if (!city) city = "Abidjan" // une commune implique Abidjan
      confidence += 0.3
      break
    }
  }

  // 4. Détection quartier
  for (const nb of NEIGHBORHOODS) {
    const nbLower = nb.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    if (queryLower.includes(nbLower)) {
      neighborhood = nb
      confidence += 0.2
      break
    }
  }

  // 5. Mots-clés additionnels (ce qui n'est pas secteur/ville/commune)
  const detectedTerms = new Set<string>()
  if (sector) SECTOR_SYNONYMS.find((s) => s.label === sector)?.synonyms.forEach((s) => detectedTerms.add(s))
  if (city) CI_CITIES_SYNONYMS.find((c) => c.canonical === city)?.synonyms.forEach((s) => detectedTerms.add(s))
  if (commune) detectedTerms.add(commune.toLowerCase())

  for (const token of tokens) {
    if (token.length > 2 && !detectedTerms.has(token) && !["le", "la", "les", "de", "du", "des"].includes(token)) {
      keywords.push(token)
    }
  }

  // 6. Intention
  let intent: SearchIntent["intent"] = "general_search"
  if (sector && (city || commune)) intent = "find_business"
  else if (sector) intent = "find_business"
  else if (city || commune) intent = "find_location"

  // 7. Requête reformulée pour Elasticsearch
  const searchParts: string[] = []
  if (sector) searchParts.push(sector)
  if (commune) searchParts.push(commune)
  if (city) searchParts.push(city)
  if (neighborhood) searchParts.push(neighborhood)
  searchParts.push(...keywords)
  const searchQuery = searchParts.join(" ") || query

  // 8. Filtres dérivés
  const filters: Record<string, string> = {}
  if (sector) filters.sector = sector
  if (city) filters.city = city
  if (commune) filters.commune = commune

  return {
    sector,
    sectorCode,
    city,
    commune,
    neighborhood,
    keywords,
    intent,
    confidence: Math.min(1, confidence),
    searchQuery,
    method: "rules",
    filters: Object.keys(filters).length > 0 ? filters : undefined,
  }
}

/**
 * Analyse d'intention par LLM (z-ai) — pour les cas complexes
 */
export async function analyzeIntentByLLM(query: string): Promise<SearchIntent> {
  try {
    const zai = await ZAI.create()

    const sectorsList = SECTOR_SYNONYMS.map((s) => `- ${s.code}: ${s.label} (synonymes: ${s.synonyms.slice(0, 5).join(", ")})`).join("\n")
    const citiesList = CI_CITIES_SYNONYMS.map((c) => `- ${c.canonical}`).join("\n")
    const communesList = ABIDJAN_COMMUNES.join(", ")

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: `Tu es un expert en analyse d'intention de recherche pour des entreprises ivoiriennes.

Analyse la requête utilisateur et extrais l'intention de recherche.

SECTEURS POSSIBLES :
${sectorsList}

VILLES DE CÔTE D'IVOIRE :
${citiesList}

COMMUNES D'ABIDJAN :
${communesList}

RÈGLES :
- "Restaurant Cocody" → secteur "Restauration", commune "Cocody", ville "Abidjan"
- "Pharmacie Yopougon" → secteur "Santé & Pharmacie", commune "Yopougon", ville "Abidjan"
- "BTP Bouaké" → secteur "BTP & Construction", ville "Bouaké"
- "Hôtel Grand Bassam" → secteur "Tourisme & Hôtellerie", ville "Grand-Bassam"
- "Clinique Abidjan" → secteur "Santé & Pharmacie", ville "Abidjan"
- Si un quartier est mentionné (Riviera, Angré, Zone 4), mets-le dans neighborhood
- Si pas de secteur clair, mets null

Réponds UNIQUEMENT avec un JSON valide :
{
  "sector": "Libellé du secteur" ou null,
  "sectorCode": "CODE" ou null,
  "city": "Ville" ou null,
  "commune": "Commune" ou null,
  "neighborhood": "Quartier" ou null,
  "keywords": ["mot-clé1", "mot-clé2"],
  "intent": "find_business|find_contact|find_location|general_search",
  "confidence": 0.9,
  "searchQuery": "requête reformulée pour Elasticsearch"
}`,
        },
        {
          role: "user",
          content: `Requête à analyser : "${query}"`,
        },
      ],
      thinking: { type: "disabled" },
    })

    const response = completion.choices[0]?.message?.content || ""
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return analyzeIntentByRules(query)
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Valide et normalise
    const intent: SearchIntent = {
      sector: parsed.sector || undefined,
      sectorCode: parsed.sectorCode || undefined,
      city: parsed.city || undefined,
      commune: parsed.commune || undefined,
      neighborhood: parsed.neighborhood || undefined,
      keywords: parsed.keywords || [],
      intent: parsed.intent || "general_search",
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.7)),
      searchQuery: parsed.searchQuery || query,
      method: "llm",
      filters: undefined,
    }

    // Construit les filtres
    const filters: Record<string, string> = {}
    if (intent.sector) filters.sector = intent.sector
    if (intent.city) filters.city = intent.city
    if (intent.commune) filters.commune = intent.commune
    intent.filters = Object.keys(filters).length > 0 ? filters : undefined

    return intent
  } catch (err) {
    console.error("[ai] analyzeIntentByLLM error:", err)
    return analyzeIntentByRules(query)
  }
}

/**
 * Analyse hybride : règles d'abord, LLM si confiance faible
 */
export async function analyzeIntentHybrid(
  query: string,
  useLLM = true,
  minConfidence = 0.6
): Promise<SearchIntent> {
  // 1. Règles (rapide)
  const rulesIntent = analyzeIntentByRules(query)

  if (rulesIntent.confidence >= minConfidence) {
    return { ...rulesIntent, method: "rules" }
  }

  // 2. LLM si règles insuffisantes
  if (useLLM) {
    const llmIntent = await analyzeIntentByLLM(query)
    if (llmIntent.confidence > rulesIntent.confidence) {
      return { ...llmIntent, method: "hybrid" }
    }
  }

  return { ...rulesIntent, method: "rules" }
}
