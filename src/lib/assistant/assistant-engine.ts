/**
 * Assistant IA — traduit le langage naturel en requête de recherche structurée
 *
 * Pipeline :
 *  1. L'utilisateur tape une requête en langage naturel
 *     ex: "Trouve les hôtels de Marcory"
 *     ex: "Trouve les cliniques privées de Bouaké"
 *     ex: "Trouve toutes les entreprises BTP ayant un site web"
 *  2. L'IA (LLM z-ai) analyse la requête et extrait :
 *     - sector (secteur d'activité normalisé)
 *     - city (ville)
 *     - commune (commune)
 *     - hasWebsite (booléen)
 *     - hasPhone (booléen)
 *     - hasEmail (booléen)
 *     - minRating (nombre)
 *     - keywords (mots-clés additionnels)
 *     - intent (find_business, find_contact, count, list, etc.)
 *  3. La requête structurée est envoyée au moteur Elasticsearch
 *  4. Les résultats sont retournés avec une réponse en langage naturel
 */

import ZAI from "z-ai-web-dev-sdk"
import { searchEngine } from "@/lib/search/search-store"
import type { SearchHit } from "@/lib/search/elasticsearch-engine"

export interface AssistantQuery {
  /** Requête originale de l'utilisateur */
  raw: string
  /** Langue détectée */
  language: string
}

export interface StructuredSearch {
  /** Secteur d'activité normalisé */
  sector?: string
  /** Secteur code (RESTO, PHARM, BTP, etc.) */
  sectorCode?: string
  /** Ville */
  city?: string
  /** Commune */
  commune?: string
  /** Quartier */
  neighborhood?: string
  /** Filtre : a un site web */
  hasWebsite?: boolean
  /** Filtre : a un téléphone */
  hasPhone?: boolean
  /** Filtre : a un email */
  hasEmail?: boolean
  /** Note minimum */
  minRating?: number
  /** Mots-clés additionnels */
  keywords?: string[]
  /** Intention détectée */
  intent: "find_business" | "find_contact" | "count" | "list" | "compare" | "general"
  /** Requête reformulée pour Elasticsearch */
  searchQuery: string
  /** Filtres dérivés pour Elasticsearch */
  filters: Record<string, string | string[]>
  /** Confiance de l'analyse (0-1) */
  confidence: number
  /** Résumé de ce que l'IA a compris */
  summary: string
}

export interface AssistantResponse {
  /** Requête originale */
  query: string
  /** Analyse structurée */
  analysis: StructuredSearch
  /** Résultats de recherche */
  results: Array<{
    id: string
    name: string
    sector: string
    commune: string
    city: string
    phone?: string
    email?: string
    website?: string
    address?: string
    rating?: number
    reviewCount?: number
    status?: string
    score: number
    highlight?: Record<string, string[]>
  }>
  /** Nombre total de résultats */
  total: number
  /** Réponse en langage naturel générée par l'IA */
  naturalResponse: string
  /** Temps de traitement (ms) */
  took: number
  /** Suggestions de requêtes suivantes */
  suggestions: string[]
}

/**
 * Référentiel secteurs pour le prompt LLM
 */
const SECTORS_REFERENCE = [
  { code: "RESTO", label: "Restauration", synonyms: "restaurant, resto, maquis, bar, snack, fast food, cuisine, traiteur, pizzeria, buvette" },
  { code: "PHARM", label: "Santé & Pharmacie", synonyms: "pharmacie, pharma, clinique, hopital, hôpital, medical, medecin, cabinet medical, laboratoire, santé, sante, dispensaire, infirmerie" },
  { code: "BANK", label: "Banque & Finance", synonyms: "banque, bank, finance, assurance, microfinance, credit, crédit, epargne, caisse, dab, guichet" },
  { code: "TELCO", label: "Télécommunications", synonyms: "telecom, telecommunication, mobile, internet, operator, orange, mtn, moov, reseau, forfait" },
  { code: "BTP", label: "BTP & Construction", synonyms: "btp, construction, batiment, building, genie civil, travaux, immobilier, real estate, gros oeuvre" },
  { code: "AGRI", label: "Agro-alimentaire", synonyms: "agro, agriculture, alimentaire, ferme, elevage, cacao, cafe, riz, exportation" },
  { code: "COMMERCE", label: "Commerce", synonyms: "commerce, shop, boutique, store, vente, distribution, magasin, marche, supermarche" },
  { code: "TRANSPORT", label: "Transport & Logistique", synonyms: "transport, logistique, livraison, delivery, shipping, freight, cargo, transit" },
  { code: "IT", label: "Technologie & IT", synonyms: "it, tech, technology, informatique, software, digital, web, app, startup" },
  { code: "EDUC", label: "Éducation & Formation", synonyms: "ecole, school, formation, education, cours, institut, academie, universite, training" },
  { code: "TOURISM", label: "Tourisme & Hôtellerie", synonyms: "hotel, hôtel, tourisme, voyage, travel, resort, vacances, hebergement, auberge, pension" },
  { code: "BEAUTY", label: "Beauté & Bien-être", synonyms: "beaute, beauty, spa, salon, coiffure, massage, bien-etre, wellness, cosmetique" },
  { code: "AUTO", label: "Automobile", synonyms: "auto, automobile, car, voiture, garage, mecanique, moto, vehicle" },
  { code: "LEGAL", label: "Services Juridiques", synonyms: "avocat, lawyer, juridique, legal, notaire, huissier" },
  { code: "MEDIA", label: "Médias & Communication", synonyms: "media, presse, communication, marketing, publicite, radio, tv, television" },
]

/**
 * Analyse la requête en langage naturel via LLM
 */
export async function analyzeNaturalLanguage(query: string): Promise<StructuredSearch> {
  try {
    const zai = await ZAI.create()

    const sectorsList = SECTORS_REFERENCE.map(
      (s) => `- ${s.code}: ${s.label} (synonymes: ${s.synonyms})`
    ).join("\n")

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: `Tu es un assistant IA expert en recherche d'entreprises ivoiriennes. Tu analyses les requêtes en langage naturel et les traduis en recherche structurée.

SECTEURS POSSIBLES :
${sectorsList}

VILLES DE CÔTE D'IVOIRE : Abidjan, Bouaké, Yamoussoukro, San-Pédro, Korhogo, Daloa, Man, Gagnoa, Grand-Bassam, Divo, Abengourou

COMMUNES D'ABIDJAN : Cocody, Plateau, Yopougon, Marcory, Treichville, Koumassi, Abobo, Adjamé, Port-Bouët, Attécoubé, Bingerville, Songon

RÈGLES D'ANALYSE :
- "hôtels de Marcory" → sector: "Tourisme & Hôtellerie", commune: "Marcory", city: "Abidjan"
- "cliniques privées de Bouaké" → sector: "Santé & Pharmacie", city: "Bouaké", keywords: ["privées"]
- "entreprises BTP ayant un site web" → sector: "BTP & Construction", hasWebsite: true
- "restaurants avec téléphone à Cocody" → sector: "Restauration", commune: "Cocody", hasPhone: true
- "pharmacies notées au moins 4 étoiles" → sector: "Santé & Pharmacie", minRating: 4
- "combien d'entreprises à Yopougon" → intent: "count", commune: "Yopougon"
- Si "privé" ou "privée" est mentionné → ajoute "privé" dans keywords
- Si "public" ou "publique" → ajoute "public" dans keywords
- Si une commune est mentionnée → city est "Abidjan" par défaut

Réponds UNIQUEMENT avec un JSON valide :
{
  "sector": "Libellé du secteur" ou null,
  "sectorCode": "CODE" ou null,
  "city": "Ville" ou null,
  "commune": "Commune" ou null,
  "neighborhood": "Quartier" ou null,
  "hasWebsite": true/false,
  "hasPhone": true/false,
  "hasEmail": true/false,
  "minRating": nombre ou null,
  "keywords": ["mot-clé1"],
  "intent": "find_business|find_contact|count|list|compare|general",
  "confidence": 0.9,
  "summary": "Description de ce que l'IA a compris"
}`,
        },
        {
          role: "user",
          content: `Analyse cette requête : "${query}"`,
        },
      ],
      thinking: { type: "disabled" },
    })

    const response = completion.choices[0]?.message?.content || ""
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return fallbackAnalysis(query)
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Construit la requête Elasticsearch + filtres
    const searchParts: string[] = []
    const filters: Record<string, string | string[]> = {}

    if (parsed.sector) {
      searchParts.push(parsed.sector)
      filters.sector = parsed.sector
    }
    if (parsed.commune) {
      searchParts.push(parsed.commune)
      filters.commune = parsed.commune
      if (!parsed.city) parsed.city = "Abidjan"
    }
    if (parsed.city) {
      searchParts.push(parsed.city)
      filters.city = parsed.city
    }
    if (parsed.neighborhood) {
      searchParts.push(parsed.neighborhood)
    }
    if (parsed.keywords && Array.isArray(parsed.keywords)) {
      searchParts.push(...parsed.keywords)
    }

    return {
      sector: parsed.sector || undefined,
      sectorCode: parsed.sectorCode || undefined,
      city: parsed.city || undefined,
      commune: parsed.commune || undefined,
      neighborhood: parsed.neighborhood || undefined,
      hasWebsite: parsed.hasWebsite || undefined,
      hasPhone: parsed.hasPhone || undefined,
      hasEmail: parsed.hasEmail || undefined,
      minRating: parsed.minRating || undefined,
      keywords: parsed.keywords || [],
      intent: parsed.intent || "find_business",
      searchQuery: searchParts.join(" ") || query,
      filters: Object.keys(filters).length > 0 ? filters : {},
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.7)),
      summary: parsed.summary || `Recherche: ${query}`,
    }
  } catch (err) {
    console.error("[assistant] analyzeNaturalLanguage error:", err)
    return fallbackAnalysis(query)
  }
}

/**
 * Analyse de fallback (règles simples sans LLM)
 */
function fallbackAnalysis(query: string): StructuredSearch {
  const q = query.toLowerCase()
  const filters: Record<string, string | string[]> = {}
  const searchParts: string[] = []
  let summary = `Recherche: ${query}`

  // Détection secteur
  for (const s of SECTORS_REFERENCE) {
    const syns = s.synonyms.split(", ")
    if (syns.some((syn) => q.includes(syn))) {
      filters.sector = s.label
      searchParts.push(s.label)
      summary = `Recherche d'entreprises dans le secteur ${s.label}`
      break
    }
  }

  // Détection commune
  const communes = ["cocody", "plateau", "yopougon", "marcory", "treichville", "koumassi", "abobo", "adjamé", "port-bouët", "attécoubé", "bingerville", "songon"]
  for (const c of communes) {
    if (q.includes(c)) {
      const commune = c.charAt(0).toUpperCase() + c.slice(1)
      filters.commune = commune
      filters.city = "Abidjan"
      searchParts.push(commune, "Abidjan")
      summary += ` à ${commune}, Abidjan`
      break
    }
  }

  // Détection ville
  const cities = ["bouaké", "yamoussoukro", "san-pédro", "san pedro", "korhogo", "daloa", "grand-bassam", "grand bassam"]
  for (const c of cities) {
    if (q.includes(c)) {
      const cityMap: Record<string, string> = {
        "bouaké": "Bouaké", "yamoussoukro": "Yamoussoukro",
        "san-pédro": "San-Pédro", "san pedro": "San-Pédro",
        "korhogo": "Korhogo", "daloa": "Daloa",
        "grand-bassam": "Grand-Bassam", "grand bassam": "Grand-Bassam",
      }
      const city = cityMap[c]
      if (city) {
        filters.city = city
        searchParts.push(city)
        summary += ` à ${city}`
        break
      }
    }
  }

  // Filtres booléens
  const hasWebsite = q.includes("site web") || q.includes("site internet") || q.includes("website")
  const hasPhone = q.includes("téléphone") || q.includes("telephone") || q.includes("phone") || q.includes("numéro")
  const hasEmail = q.includes("email") || q.includes("courriel") || q.includes("mail")

  // Note minimum
  let minRating: number | undefined
  const ratingMatch = q.match(/(\d)[\s,]*étoile|note.*?(\d)|rating.*?(\d)/i)
  if (ratingMatch) {
    minRating = parseInt(ratingMatch[1] || ratingMatch[2] || ratingMatch[3])
  }

  // Intention
  let intent: StructuredSearch["intent"] = "find_business"
  if (q.includes("combien") || q.includes("nombre")) intent = "count"

  return {
    sector: (filters.sector as string) || undefined,
    city: (filters.city as string) || undefined,
    commune: (filters.commune as string) || undefined,
    hasWebsite: hasWebsite || undefined,
    hasPhone: hasPhone || undefined,
    hasEmail: hasEmail || undefined,
    minRating,
    keywords: [],
    intent,
    searchQuery: searchParts.join(" ") || query,
    filters,
    confidence: 0.6,
    summary,
  }
}

/**
 * Génère une réponse en langage naturel à partir des résultats
 */
export async function generateNaturalResponse(
  query: string,
  analysis: StructuredSearch,
  results: Array<SearchHit>,
  total: number
): Promise<string> {
  try {
    const zai = await ZAI.create()

    const topResults = results.slice(0, 5).map((r) => ({
      name: r.source.name,
      sector: r.source.sector,
      commune: r.source.commune,
      city: r.source.city,
      phone: r.source.phone,
      website: r.source.website,
      rating: r.source.rating,
    }))

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content: `Tu es un assistant IA qui répond en langage naturel aux questions sur les entreprises ivoiriennes. Réponds de façon concise et utile en français.

Si on demande "combien", donne le nombre total.
Si on demande de "trouver" ou "lister", résume les résultats trouvés.
Si aucun résultat, propose des alternatives.
Sois naturel et conversationnel, pas robotique.
Maximum 3-4 phrases.`,
        },
        {
          role: "user",
          content: `Requête utilisateur: "${query}"
Analyse: ${JSON.stringify(analysis, null, 2)}
Total résultats: ${total}
Top résultats: ${JSON.stringify(topResults, null, 2)}`,
        },
      ],
      thinking: { type: "disabled" },
    })

    return completion.choices[0]?.message?.content || `J'ai trouvé ${total} entreprise(s) correspondant à votre recherche.`
  } catch {
    // Fallback : réponse simple sans LLM
    if (total === 0) {
      return `Aucune entreprise ne correspond à votre recherche. Essayez avec d'autres critères ou élargissez votre recherche.`
    }
    if (analysis.intent === "count") {
      return `J'ai trouvé **${total} entreprise(s)**${analysis.sector ? ` dans le secteur "${analysis.sector}"` : ""}${analysis.commune ? ` à ${analysis.commune}` : ""}${analysis.city ? `, ${analysis.city}` : ""}.`
    }
    return `J'ai trouvé **${total} entreprise(s)**${analysis.sector ? ` dans le secteur "${analysis.sector}"` : ""}${analysis.commune ? ` à ${analysis.commune}` : ""}${analysis.city ? `, ${analysis.city}` : ""}. Voici les premières : ${results.slice(0, 3).map((r) => r.source.name).join(", ")}.`
  }
}

/**
 * Suggestions de requêtes suivantes
 */
export function generateSuggestions(analysis: StructuredSearch): string[] {
  const suggestions: string[] = []

  if (analysis.sector && analysis.commune) {
    suggestions.push(`Trouve les ${analysis.sector.toLowerCase()} avec un site web`)
    suggestions.push(`Combien de ${analysis.sector.toLowerCase()} à ${analysis.commune} ?`)
  }
  if (analysis.sector && !analysis.commune) {
    suggestions.push(`Trouve les ${analysis.sector.toLowerCase()} à Cocody`)
    suggestions.push(`Trouve les ${analysis.sector.toLowerCase()} à Bouaké`)
  }
  if (analysis.commune && !analysis.sector) {
    suggestions.push(`Trouve les restaurants à ${analysis.commune}`)
    suggestions.push(`Trouve les pharmacies à ${analysis.commune}`)
  }
  if (analysis.hasWebsite) {
    suggestions.push(`Trouve les entreprises avec un email`)
    suggestions.push(`Trouve les entreprises avec un téléphone`)
  }

  // Suggestions génériques
  suggestions.push("Trouve les hôtels de Grand-Bassam")
  suggestions.push("Trouve les cliniques privées de Bouaké")
  suggestions.push("Trouve les entreprises BTP ayant un site web")

  return suggestions.slice(0, 5)
}

/**
 * Pipeline complet : analyse IA → recherche Elasticsearch → réponse naturelle
 */
export async function processAssistantQuery(query: string): Promise<AssistantResponse> {
  const startTime = Date.now()

  // 1. Analyse IA
  const analysis = await analyzeNaturalLanguage(query)

  // 2. Recherche Elasticsearch avec filtres post-traitement
  const searchResult = searchEngine.search({
    query: analysis.searchQuery,
    filters: analysis.filters,
    fuzzy: true,
    size: 20,
    aggregations: ["sector", "city", "commune"],
  })

  // 3. Filtres post-recherche (hasWebsite, hasPhone, hasEmail, minRating)
  let filteredHits = searchResult.hits
  if (analysis.hasWebsite) {
    filteredHits = filteredHits.filter((h) => h.source.website && String(h.source.website).length > 0)
  }
  if (analysis.hasPhone) {
    filteredHits = filteredHits.filter((h) => h.source.phone && String(h.source.phone).length > 0)
  }
  if (analysis.hasEmail) {
    filteredHits = filteredHits.filter((h) => h.source.email && String(h.source.email).length > 0)
  }
  if (analysis.minRating) {
    filteredHits = filteredHits.filter((h) => (h.source.rating as number) >= analysis.minRating!)
  }

  // 4. Réponse en langage naturel
  const naturalResponse = await generateNaturalResponse(query, analysis, filteredHits, filteredHits.length)

  // 5. Suggestions
  const suggestions = generateSuggestions(analysis)

  return {
    query,
    analysis,
    results: filteredHits.map((h) => ({
      id: h.id,
      name: h.source.name as string,
      sector: h.source.sector as string,
      commune: h.source.commune as string,
      city: h.source.city as string,
      phone: h.source.phone as string | undefined,
      email: h.source.email as string | undefined,
      website: h.source.website as string | undefined,
      address: h.source.address as string | undefined,
      rating: h.source.rating as number | undefined,
      reviewCount: h.source.reviewCount as number | undefined,
      status: h.source.status as string | undefined,
      score: h.score,
      highlight: h.highlight,
    })),
    total: filteredHits.length,
    naturalResponse,
    took: Date.now() - startTime,
    suggestions,
  }
}
