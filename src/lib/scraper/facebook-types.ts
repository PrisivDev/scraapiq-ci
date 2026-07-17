/**
 * Types spécifiques au scraper Facebook
 */

import type { ScrapedPlace } from "./types"

/** Critères de recherche Facebook */
export interface FacebookSearchQuery {
  keyword: string // ex: "restaurant", "pharmacie"
  city?: string // ex: "Abidjan"
  commune?: string // ex: "Cocody"
  neighborhood?: string
  country?: string // défaut "Côte d'Ivoire"
  maxResults?: number
  language?: string
  /** Cookies de session Facebook (format: "c_user=XXX; xs=YYY; datr=ZZZ; fr=WWW") */
  cookies?: string
  /** URL directe d'une page Facebook (skip la recherche) */
  pageUrl?: string
}

/** Lieu extrait d'une page Facebook */
export interface FacebookPlace extends ScrapedPlace {
  /** Nom de la page Facebook */
  pageName?: string
  /** URL de la page Facebook */
  pageUrl?: string
  /** Lien Messenger (m.me/...) */
  messenger?: string
  /** Numéro WhatsApp (extrait du contenu) */
  whatsapp?: string
  /** Lien Google Maps dérivé de l'adresse */
  googleMapsUrl?: string
  /** Description / bio de la page */
  description?: string
  /** ID Facebook de la page */
  facebookId?: string
  /** Nombre de likes / followers */
  likesCount?: number
  /** Nombre d'abonnés */
  followersCount?: number
  /** Vérifié (badge bleu) */
  isVerified?: boolean
}

/** Configuration du scraper Facebook */
export interface FacebookScraperConfig {
  headless?: boolean
  /** Cookies de session Facebook (requis pour la plupart des pages) */
  cookies?: string
  /** User-agent custom */
  userAgent?: string
  /** Délai min entre actions (ms) */
  minDelay?: number
  /** Délai max entre actions (ms) */
  maxDelay?: number
  /** Timeout par page (ms) */
  pageTimeout?: number
  /** Retries */
  retries?: number
  /** Backoff initial (ms) */
  backoffMs?: number
  /** Extraire les images */
  extractImages?: boolean
  /** Max images par page */
  maxImages?: number
  /** Utiliser la version mobile (m.facebook.com) — recommandé, plus léger */
  mobileVersion?: boolean
}

/** Événements spécifiques Facebook */
export type FacebookScrapeEvent =
  | { type: "fb-login-required"; message: string }
  | { type: "fb-consent-required" }
  | { type: "fb-page-loaded"; pageUrl: string; pageName: string }
  | { type: "fb-search-loaded"; resultsCount: number }
  | { type: "fb-extracted"; place: FacebookPlace; index: number }
  | { type: "fb-error"; message: string; pageUrl?: string }
  | { type: "fb-progress"; progress: number; phase: string }

/** Cookie Facebook parsé */
export interface FacebookCookie {
  name: string
  value: string
  domain: string
  path: string
}

/**
 * Parse une chaîne de cookies Facebook (format header Cookie: "name=value; name2=value2")
 * vers un tableau de cookies jouables par Playwright
 */
export function parseFacebookCookies(cookieString: string): FacebookCookie[] {
  if (!cookieString) return []

  const cookies: FacebookCookie[] = []
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
      domain: ".facebook.com",
      path: "/",
    })
  }

  return cookies
}

/**
 * Vérifie qu'un ensemble de cookies contient les cookies essentiels pour l'auth Facebook
 */
export function validateFacebookCookies(cookies: FacebookCookie[]): {
  valid: boolean
  missing: string[]
} {
  const essential = ["c_user", "xs"]
  const present = cookies.map((c) => c.name)
  const missing = essential.filter((n) => !present.includes(n))
  return { valid: missing.length === 0, missing }
}
