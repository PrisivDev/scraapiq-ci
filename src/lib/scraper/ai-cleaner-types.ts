/**
 * Types du moteur IA de nettoyage et d'enrichissement
 */

import type { ScrapedPlace } from "./types"

/** Statut d'activité d'une entreprise */
export type BusinessStatus = "active" | "closed" | "temporarily_closed" | "relocated" | "unknown"

/** Source de l'information */
export type InfoSource = "google_maps" | "facebook" | "linkedin" | "website" | "rccm" | "ai_inference" | "user_input"

/** Une entreprise après nettoyage et enrichissement IA */
export interface CleanedEntity extends ScrapedPlace {
  /** ID unique généré après fusion */
  canonicalId?: string

  /** Nom nettoyé (sans suffixes légaux, espaces, etc.) */
  cleanedName?: string
  /** Noms alternatifs détectés (doublons fusionnés) */
  aliases?: string[]

  /** Téléphone corrigé et normalisé */
  cleanedPhone?: string
  /** Téléphone original (avant correction) */
  originalPhone?: string
  /** Téléphone corrigé (true si une correction a été appliquée) */
  phoneCorrected?: boolean

  /** Email corrigé */
  cleanedEmail?: string
  /** Email original */
  originalEmail?: string
  /** Email corrigé (true si correction appliquée) */
  emailCorrected?: boolean
  /** Email validé (syntaxe + domaine) */
  emailValid?: boolean

  /** Adresse normalisée */
  cleanedAddress?: string
  /** Adresse originale */
  originalAddress?: string
  /** Composantes d'adresse parsées */
  addressComponents?: {
    street?: string
    number?: string
    commune?: string
    city?: string
    region?: string
    postalCode?: string
    country?: string
  }

  /** Secteur d'activité détecté (normalisé) */
  detectedSector?: string
  /** Code secteur (NSE/NACE) */
  sectorCode?: string
  /** Mots-clés du secteur */
  sectorKeywords?: string[]

  /** Score de qualité global (0-100) */
  qualityScore?: number
  /** Détail du score par dimension */
  qualityBreakdown?: QualityBreakdown

  /** Statut d'activité */
  businessStatus?: BusinessStatus
  /** Indicateurs de fermeture détectés */
  closureIndicators?: string[]
  /** Date de fermeture estimée */
  closedAt?: string

  /** Informations complétées par l'IA */
  aiCompletions?: Array<{
    field: string
    value: string
    confidence: number
    source: string
  }>

  /** Sources qui ont contribué à cette fiche */
  sources?: InfoSource[]
  /** Nombre de fiches fusionnées */
  mergedCount?: number

  /** Métadonnées de nettoyage */
  cleaningMetadata?: {
    cleanedAt: string
    durationMs: number
    operations: string[]
    llmCalls: number
    confidence: number
  }
}

/** Détail du score de qualité par dimension */
export interface QualityBreakdown {
  /** Complétude des champs (0-100) */
  completeness: number
  /** Validité des coordonnées (email, tél) (0-100) */
  contactValidity: number
  /** Qualité du nom (0-100) */
  nameQuality: number
  /** Précision géoloc (0-100) */
  geoAccuracy: number
  /** Fiabilité de la source (0-100) */
  sourceReliability: number
  /** Fraîcheur des données (0-100) */
  freshness: number
  /** Présence online (site, réseaux sociaux) (0-100) */
  onlinePresence: number
}

/** Configuration du moteur IA */
export interface AICleanerConfig {
  /** Utiliser le LLM pour l'enrichissement (défaut true) */
  useLLM?: boolean
  /** Modèle LLM à utiliser */
  llmModel?: string
  /** Confiance minimum pour appliquer une suggestion IA (0-1) */
  minConfidence?: number
  /** Détecter les entreprises fermées */
  detectClosed?: boolean
  /** Compléter les champs manquants via IA */
  completeMissing?: boolean
  /** Détecter le secteur d'activité */
  detectSector?: boolean
  /** Langue de sortie */
  language?: string
  /** Pays (pour normalisation) */
  country?: string
}

/** Groupe de doublons fusionnés */
export interface MergedGroup {
  canonicalId: string
  canonicalName: string
  mergedEntities: Array<{
    id: string
    name: string
    source: InfoSource
    similarity: number
    matchReason: string
  }>
  fusionConfidence: number
}

/** Rapport de nettoyage */
export interface CleaningReport {
  jobId: string
  startedAt: string
  completedAt: string
  durationMs: number
  input: {
    totalEntities: number
    sources: InfoSource[]
  }
  output: {
    cleanedEntities: number
    duplicatesRemoved: number
    fieldsCorrected: number
    fieldsCompleted: number
    sectorsDetected: number
    closedDetected: number
  }
  duplicates: MergedGroup[]
  corrections: Array<{
    entityId: string
    fieldName: string
    oldValue: string
    newValue: string
    correctionType: "phone" | "email" | "address" | "name" | "sector"
    method: "deterministic" | "llm" | "rule"
    confidence: number
  }>
  stats: {
    phoneCorrections: number
    emailCorrections: number
    addressNormalizations: number
    sectorDetections: number
    qualityScores: number[]
    avgQualityScore: number
    llmCalls: number
    llmTokensUsed: number
  }
}

/** Événements du moteur IA */
export type AICleanerEvent =
  | { type: "ai-start"; totalEntities: number }
  | { type: "ai-dedup-start" }
  | { type: "ai-dedup-done"; duplicatesRemoved: number; groups: number }
  | { type: "ai-merge-start"; groupIndex: number; total: number }
  | { type: "ai-merge-done"; canonicalName: string; mergedCount: number }
  | { type: "ai-correct-start"; entityId: string }
  | { type: "ai-correct-phone"; entityId: string; from: string; to: string; method: string }
  | { type: "ai-correct-email"; entityId: string; from: string; to: string; method: string }
  | { type: "ai-normalize-address"; entityId: string; from: string; to: string }
  | { type: "ai-enrich-start"; entityId: string; missingFields: string[] }
  | { type: "ai-enrich-done"; entityId: string; completedFields: string[] }
  | { type: "ai-sector-detect"; entityId: string; sector: string; confidence: number }
  | { type: "ai-quality-score"; entityId: string; score: number }
  | { type: "ai-closed-detect"; entityId: string; status: BusinessStatus; indicators: string[] }
  | { type: "ai-progress"; progress: number; phase: string }
  | { type: "ai-error"; message: string; entityId?: string }
  | { type: "ai-complete"; report: CleaningReport }

/** Critères de nettoyage */
export interface CleaningQuery {
  /** Entités à nettoyer (depuis un job de scraping) */
  entities: ScrapedPlace[]
  /** ID du job de scraping source (optionnel) */
  sourceJobId?: string
  /** Configuration */
  config?: AICleanerConfig
}

/** Domaines email temporaires/jetables à rejeter */
export const DISPOSABLE_EMAIL_DOMAINS = [
  "tempmail", "throwaway", "mailinator", "guerrillamail", "10minutemail",
  "yopmail", "trashmail", "sharklasers", "getnada", "maildrop",
  "dispostable", "fakeinbox", "temp-mail",
]

/** Secteurs d'activité normalisés (référentiel) */
export const SECTOR_REFERENCE: Array<{ code: string; label: string; keywords: string[] }> = [
  { code: "RESTO", label: "Restauration", keywords: ["restaurant", "maquis", "bar", "snack", "fast food", "food", "cuisine", "traiteur", "pizzeria"] },
  { code: "PHARM", label: "Santé & Pharmacie", keywords: ["pharmacie", "clinique", "hôpital", "hopital", "medical", "santé", "medecin", "laboratoire", "cabinet medical"] },
  { code: "BANK", label: "Banque & Finance", keywords: ["banque", "bank", "finance", "assurance", "microfinance", "crédit", "credit", "épargne", "caisse"] },
  { code: "TELCO", label: "Télécommunications", keywords: ["telecom", "telecommunication", "mobile", "internet", "operator", "orange", "mtn", "moov", "reseau"] },
  { code: "BTP", label: "BTP & Construction", keywords: ["construction", "btp", "batiment", "building", "genie civil", "travaux", "immobilier", "real estate"] },
  { code: "AGRI", label: "Agro-alimentaire", keywords: ["agro", "agriculture", "food", "alimentaire", "ferme", "elevage", "cacao", "cafe", "riz"] },
  { code: "COMMERCE", label: "Commerce", keywords: ["commerce", "shop", "boutique", "store", "vente", "distribution", "magasin", "marche"] },
  { code: "TRANSPORT", label: "Transport & Logistique", keywords: ["transport", "logistique", "logistics", "livraison", "delivery", "shipping", "freight", "cargo"] },
  { code: "IT", label: "Technologie & IT", keywords: ["it", "tech", "technology", "informatique", "software", "digital", "internet", "web", "app", "digital"] },
  { code: "EDUC", label: "Éducation & Formation", keywords: ["ecole", "school", "formation", "education", "cours", "institut", "academie", "universite", "training"] },
  { code: "ENERGY", label: "Énergie", keywords: ["energie", "energy", "electricite", "electricity", "petrole", "oil", "gas", "gaz", "solaire", "solar"] },
  { code: "TOURISM", label: "Tourisme & Hôtellerie", keywords: ["hotel", "tourisme", "tourism", "voyage", "travel", "resort", "vacances", "hebergement"] },
  { code: "TEXTILE", label: "Textile & Mode", keywords: ["textile", "mode", "fashion", "vetement", "clothing", "couture", "tissu"] },
  { code: "AUTO", label: "Automobile", keywords: ["auto", "automobile", "car", "voiture", "garage", "mecanique", "moto", "vehicle"] },
  { code: "BEAUTY", label: "Beauté & Bien-être", keywords: ["beaute", "beauty", "spa", "salon", "coiffure", "massage", "bien-etre", "wellness", "cosmetique"] },
  { code: "MEDIA", label: "Médias & Communication", keywords: ["media", "presse", "communication", "marketing", "publicite", "advertising", "radio", "tv", "television"] },
  { code: "LEGAL", label: "Services Juridiques", keywords: ["avocat", "lawyer", "juridique", "legal", "notaire", "conseil juridique"] },
  { code: "CONSULT", label: "Conseil & Services", keywords: ["conseil", "consulting", "service", "services", "conseil entreprise", "audit"] },
]

/** Mots-clés indiquant une fermeture probable */
export const CLOSURE_INDICATORS = [
  "fermé", "fermé définitivement", "definitively closed", "permanently closed",
  "out of business", "ceased operations", "ceased trading",
  "n'existe plus", "plus en activité", "plus ouvert",
  "fermé depuis", "closed since", "shut down",
  "bankrupt", "faillite", "liquidation",
  "relocated", "déménagé", "déménagement",
]
