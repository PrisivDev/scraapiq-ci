/**
 * Types du robot de scraping de sites web
 */

import type { ScrapedPlace } from "./types"

/** Page visitée par le robot */
export interface VisitedPage {
  /** URL finale (après redirections) */
  url: string
  /** URL d'origine demandée */
  requestedUrl: string
  /** Titre de la page */
  title?: string
  /** Type de page identifié */
  pageType: "home" | "contact" | "about" | "legal" | "footer" | "other"
  /** Statut HTTP */
  status: number
  /** Temps de chargement (ms) */
  loadTimeMs: number
  /** Profondeur dans le site (0 = home) */
  depth: number
  /** Erreur éventuelle */
  error?: string
}

/** Email extrait */
export interface ExtractedEmail {
  email: string
  /** Page où il a été trouvé */
  foundOn: string
  /** Contexte (texte autour) */
  context?: string
  /** Détecté dans un lien mailto: */
  fromMailtoLink: boolean
}

/** Téléphone extrait */
export interface ExtractedPhone {
  /** Format brut */
  raw: string
  /** Format normalisé (+225 XX XX XX XX) */
  normalized: string
  foundOn: string
  context?: string
  /** Détecté dans un lien tel: */
  fromTelLink: boolean
}

/** Lien réseau social extrait */
export interface ExtractedSocialLink {
  platform: "facebook" | "instagram" | "linkedin" | "twitter" | "youtube" | "tiktok" | "whatsapp" | "telegram"
  url: string
  foundOn: string
  /** Nom d'utilisateur/handle si détecté */
  handle?: string
}

/** Coordonnées GPS extraites */
export interface ExtractedGps {
  lat: number
  lng: number
  foundOn: string
  /** Source : embedded_map, microdata, json-ld, iframe, url */
  source: string
}

/** Résultat complet d'un site scrapé */
export interface WebsiteScrapedData extends ScrapedPlace {
  /** URL d'origine du site */
  siteUrl: string
  /** Nom du site (titre de l'accueil) */
  siteName?: string
  /** Description (meta description) */
  metaDescription?: string
  /** Pages visitées */
  visitedPages: VisitedPage[]
  /** Tous les emails extraits */
  emails: ExtractedEmail[]
  /** Tous les téléphones extraits */
  phones: ExtractedPhone[]
  /** Numéro WhatsApp spécifiquement détecté */
  whatsapp?: ExtractedPhone[]
  /** Liens réseaux sociaux */
  socialLinks: ExtractedSocialLink[]
  /** Lien Google Maps */
  googleMapsUrl?: string
  /** Adresses postales extraites */
  addresses: string[]
  /** Coordonnées GPS extraites */
  gps?: ExtractedGps[]
  /** Liens footer utiles (mentions, privacy, terms) */
  footerLinks: Array<{ text: string; url: string }>
  /** Favicon / logo URL */
  logoUrl?: string
  /** Langue du site (html lang) */
  language?: string
  /** Schema.org organization (JSON-LD) si détecté */
  organizationSchema?: Record<string, unknown>
}

/** Critères de scraping d'un site */
export interface WebsiteSearchQuery {
  /** URL du site à scraper */
  url: string
  /** Pages à visiter (défaut: home, contact, about, mentions) */
  pageTypes?: string[]
  /** Profondeur max de navigation dans le footer */
  maxDepth?: number
  /** Suivre les liens du footer (défaut true) */
  followFooterLinks?: boolean
  /** User-agent custom */
  userAgent?: string
  /** Timeout par page (ms) */
  pageTimeout?: number
  /** Max pages à visiter (défaut 8) */
  maxPages?: number
}

/** Configuration du scraper web */
export interface WebsiteScraperConfig {
  headless?: boolean
  userAgent?: string
  minDelay?: number
  maxDelay?: number
  pageTimeout?: number
  retries?: number
  backoffMs?: number
  /** Bloquer les ressources non essentielles (images, fonts) */
  blockResources?: boolean
  /** Extraire les images (logo, photos) */
  extractImages?: boolean
}

/** Événements spécifiques website */
export type WebsiteScrapeEvent =
  | { type: "ws-page-visit"; url: string; pageType: string; depth: number }
  | { type: "ws-page-loaded"; url: string; title: string; loadTimeMs: number; status: number }
  | { type: "ws-contacts-found"; emails: number; phones: number; socials: number }
  | { type: "ws-extracted"; data: WebsiteScrapedData }
  | { type: "ws-error"; message: string; url?: string }
  | { type: "ws-progress"; progress: number; phase: string }

/**
 * Patterns pour identifier les pages clés dans les URLs / textes de liens
 */
export const PAGE_TYPE_PATTERNS: Record<string, RegExp[]> = {
  home: [/^\/?$/, /^\/$/],
  contact: [
    /\/contact/i,
    /\/nous-contacter/i,
    /\/contacter/i,
    /\/contact-us/i,
    /\/contactez-nous/i,
    /\/reach-us/i,
  ],
  about: [
    /\/about/i,
    /\/a-propos/i,
    /\/apropos/i,
    /\/qui-sommes-nous/i,
    /\/notre-histoire/i,
    /\/notre-entreprise/i,
    /\/company/i,
    /\/who-we-are/i,
  ],
  legal: [
    /\/mentions/i,
    /\/legal/i,
    /\/legales/i,
    /\/cgu/i,
    /\/terms/i,
    /\/privacy/i,
    /\/confidentialite/i,
    /\/politique/i,
    /\/cookies/i,
  ],
}

/**
 * Détecte le type de page depuis une URL ou un texte de lien
 */
export function detectPageType(url: string, linkText?: string): VisitedPage["pageType"] {
  const text = (linkText || "").toLowerCase()
  const urlLower = url.toLowerCase()

  // Home
  if (PAGE_TYPE_PATTERNS.home.some((r) => r.test(urlLower) || r.test(new URL(url, "http://x").pathname))) {
    return "home"
  }

  // Par mot-clé dans le texte du lien (plus fiable)
  if (text) {
    if (/contact|contacter|nous contacter|contactez|reach/i.test(text)) return "contact"
    if (/à propos|a propos|apropos|qui sommes|notre histoire|notre entreprise|about|who we are/i.test(text)) return "about"
    if (/mention|légales|legales|cgu|terms|privacy|confidentialité|cookies|politique/i.test(text)) return "legal"
    if (/footer|pied de page/i.test(text)) return "footer"
  }

  // Par pattern d'URL
  for (const [type, patterns] of Object.entries(PAGE_TYPE_PATTERNS)) {
    if (type === "home") continue
    if (patterns.some((r) => r.test(urlLower))) {
      return type as VisitedPage["pageType"]
    }
  }

  return "other"
}

/**
 * Normalise un téléphone (wrapper pour Côte d'Ivoire par défaut)
 */
export function normalizePhoneCI(input: string): string | null {
  if (!input) return null
  let cleaned = input.replace(/[^\d+]/g, "")

  if (cleaned.startsWith("+225")) {
    const rest = cleaned.slice(4)
    if (rest.length === 10) {
      return `+225 ${rest.slice(0, 2)} ${rest.slice(2, 4)} ${rest.slice(4, 6)} ${rest.slice(6, 8)} ${rest.slice(8, 10)}`
    }
    // Si +225 suivi de plus de 10 chiffres, prend les 10 premiers
    if (rest.length > 10) {
      return normalizePhoneCI("+225" + rest.slice(0, 10))
    }
  }
  if (cleaned.startsWith("00225")) {
    return normalizePhoneCI("+" + cleaned.slice(2))
  }
  // Cas : 22507... (sans +) — 12 chiffres
  if (cleaned.length === 12 && cleaned.startsWith("225")) {
    return normalizePhoneCI("+" + cleaned)
  }
  if (cleaned.length === 10 && /^(27|07|05|01)/.test(cleaned)) {
    return normalizePhoneCI("+225" + cleaned)
  }
  if (cleaned.startsWith("+") && cleaned.length >= 8) {
    return cleaned
  }
  if (cleaned.length >= 8 && !cleaned.startsWith("+")) {
    return "+225" + cleaned
  }
  return null
}

/**
 * Extrait le handle d'un lien réseau social
 * https://www.facebook.com/OrangeCI/ → "OrangeCI"
 */
export function extractSocialHandle(url: string, platform: string): string | undefined {
  try {
    const u = new URL(url)
    const parts = u.pathname.split("/").filter(Boolean)
    // Pour WhatsApp : wa.me/22507XXXX → "22507XXXX"
    if (platform === "whatsapp") {
      return parts[0] || u.searchParams.get("phone") || undefined
    }
    // Pour les autres : premier segment du path
    return parts[0] || undefined
  } catch {
    return undefined
  }
}
