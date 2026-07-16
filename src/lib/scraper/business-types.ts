/**
 * Types du moteur d'identification d'entreprises (LinkedIn + multi-sources)
 */

import type { ScrapedPlace } from "./types"

/** Personne associée à une entreprise (dirigeant ou employé) */
export interface BusinessPerson {
  /** Nom complet */
  name: string
  /** Fonction/poste (ex: "CEO", "Directeur Général", "Software Engineer") */
  title?: string
  /** URL du profil LinkedIn */
  linkedinUrl?: string
  /** Photo de profil (URL) */
  photoUrl?: string
  /** Type de personne : dirigeant (exec) ou employé */
  role: "executive" | "employee"
  /** Description / bio */
  bio?: string
  /** Localisation de la personne */
  location?: string
  /** Connecté/follower count */
  connections?: number
}

/** Entité entreprise complète identifiée */
export interface BusinessEntity extends ScrapedPlace {
  /** Slug LinkedIn (ex: "orange") */
  linkedinSlug?: string
  /** URL page LinkedIn */
  linkedinUrl?: string
  /** Taille de l'entreprise (range) */
  companySize?: string
  /** Type d'entreprise (ex: "Public Company", "Privately Held") */
  companyType?: string
  /** Année de fondation */
  foundedYear?: number
  /** Spécialités (keywords) */
  specialties?: string[]
  /** Liste des dirigeants (CEO, CFO, etc.) */
  executives?: BusinessPerson[]
  /** Liste des employés visibles publiquement */
  employees?: BusinessPerson[]
  /** Nombre total d'employés sur LinkedIn */
  employeesOnLinkedin?: number
  /** Nombre de followers LinkedIn */
  followersCount?: number
  /** Source principale de l'identification */
  source?: "linkedin" | "google" | "pagesjaunes" | "rccm" | "mixed"
  /** Score de confiance de l'identification (0-100) */
  identificationScore?: number
}

/** Critères de recherche d'entreprise */
export interface BusinessSearchQuery {
  /** Nom de l'entreprise ou mot-clé */
  query: string
  /** Localisation (ville, pays) */
  location?: string
  /** Slug LinkedIn direct (ex: "orange") — skip la recherche */
  linkedinSlug?: string
  /** URL LinkedIn directe */
  linkedinUrl?: string
  /** Cookies LinkedIn (li_at, session) */
  cookies?: string
  /** Nombre max d'employés/dirigeants à extraire */
  maxPeople?: number
  /** Extraire les employés (pas seulement les dirigeants) */
  extractEmployees?: boolean
  /** Pays */
  country?: string
  /** Langue */
  language?: string
}

/** Configuration du scraper business */
export interface BusinessScraperConfig {
  headless?: boolean
  /** Cookies LinkedIn (li_at, JSESSIONID) */
  cookies?: string
  userAgent?: string
  minDelay?: number
  maxDelay?: number
  pageTimeout?: number
  retries?: number
  backoffMs?: number
  /** Mode mobile (m.linkedin.com) */
  mobileVersion?: boolean
  /** Activer les sources fallback (Google, Pages Jaunes) */
  enableFallbacks?: boolean
}

/** Événements spécifiques business */
export type BusinessScrapeEvent =
  | { type: "biz-search-loaded"; resultsCount: number }
  | { type: "biz-page-loaded"; companyName: string; linkedinUrl: string }
  | { type: "biz-extracted"; entity: BusinessEntity; index: number }
  | { type: "biz-people-found"; executivesCount: number; employeesCount: number }
  | { type: "biz-fallback"; source: string; reason: string }
  | { type: "biz-error"; message: string; companyName?: string }

/** Cookie LinkedIn parsé */
export interface LinkedInCookie {
  name: string
  value: string
  domain: string
  path: string
}

/**
 * Parse une chaîne de cookies LinkedIn
 * Format: "li_at=XXX; JSESSIONID=YYY; bcookie=ZZZ"
 */
export function parseLinkedInCookies(cookieString: string): LinkedInCookie[] {
  if (!cookieString) return []
  const cookies: LinkedInCookie[] = []
  const parts = cookieString.split(";")
  for (const part of parts) {
    const eqIdx = part.indexOf("=")
    if (eqIdx === -1) continue
    const name = part.slice(0, eqIdx).trim()
    const value = part.slice(eqIdx + 1).trim()
    if (!name || !value) continue
    cookies.push({
      name,
      value,
      domain: ".linkedin.com",
      path: "/",
    })
  }
  return cookies
}

/**
 * Valide les cookies LinkedIn (li_at est essentiel pour l'auth)
 */
export function validateLinkedInCookies(cookies: LinkedInCookie[]): {
  valid: boolean
  missing: string[]
} {
  const essential = ["li_at"]
  const present = cookies.map((c) => c.name)
  const missing = essential.filter((n) => !present.includes(n))
  return { valid: missing.length === 0, missing }
}

/**
 * Devine le slug LinkedIn à partir d'un nom d'entreprise
 * "Orange Côte d'Ivoire" → "orange-cote-divoire"
 */
export function guessLinkedinSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .replace(/-sarl$|-sa$|-eurl$|-sas$|-sci$|-ets$|-group$|-ci$/g, "")
    .replace(/(^-|-$)/g, "")
}

/**
 * Parse un nombre depuis "1,2 k" ou "12345" ou "1,2M"
 */
export function parseCount(text: string): number {
  if (!text) return 0
  const cleaned = text.trim().toLowerCase().replace(/\s/g, "").replace(/,/g, ".")
  const match = cleaned.match(/(\d+(?:\.\d+)?)([km]?)/)
  if (!match) return 0
  const num = parseFloat(match[1])
  const unit = match[2]
  if (unit === "k") return Math.round(num * 1000)
  if (unit === "m") return Math.round(num * 1000000)
  return Math.round(num)
}

/**
 * Parse une année depuis "Fondée en 1995" ou "Founded in 1995" ou "1995"
 */
export function parseYear(text: string): number | undefined {
  if (!text) return undefined
  const match = text.match(/(19|20)\d{2}/)
  return match ? parseInt(match[0], 10) : undefined
}
