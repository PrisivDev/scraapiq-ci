/**
 * Extracteur de contacts depuis le contenu HTML / texte d'une page
 *
 * Responsabilités :
 *  - Extraire les emails (regex + déduplication)
 *  - Extraire les téléphones (format ivoirien + international)
 *  - Détecter WhatsApp (liens wa.me, wa.link, mention "WhatsApp")
 *  - Détecter les réseaux sociaux (Facebook, Instagram, LinkedIn, Twitter, YouTube, TikTok, Telegram)
 *  - Détecter les liens Google Maps
 *  - Extraire les coordonnées GPS (iframe, microdata, JSON-LD, URL)
 *  - Extraire les adresses postales
 */

import type {
  ExtractedEmail,
  ExtractedPhone,
  ExtractedSocialLink,
  ExtractedGps,
} from "./website-types"
import { normalizePhoneCI, extractSocialHandle } from "./website-types"

/** Résultat d'extraction pour une page donnée */
export interface PageExtraction {
  emails: ExtractedEmail[]
  phones: ExtractedPhone[]
  whatsapp: ExtractedPhone[]
  socials: ExtractedSocialLink[]
  googleMapsUrl?: string
  addresses: string[]
  gps: ExtractedGps[]
  links: Array<{ text: string; href: string; inFooter: boolean }>
}

// Patterns pour les réseaux sociaux
const SOCIAL_PATTERNS: Array<{ platform: ExtractedSocialLink["platform"]; pattern: RegExp }> = [
  { platform: "facebook", pattern: /facebook\.com|fb\.com|fb\.me/i },
  { platform: "instagram", pattern: /instagram\.com|instagr\.am/i },
  { platform: "linkedin", pattern: /linkedin\.com|lnkd\.in/i },
  { platform: "twitter", pattern: /twitter\.com|x\.com|t\.co/i },
  { platform: "youtube", pattern: /youtube\.com|youtu\.be/i },
  { platform: "tiktok", pattern: /tiktok\.com/i },
  { platform: "telegram", pattern: /t\.me|telegram\.me|telegram\.org/i },
]

// Pattern WhatsApp
const WHATSAPP_PATTERNS = [/wa\.me\/(\+?[\d]+)/i, /whatsapp\.com\/send.*phone=([\d]+)/i, /api\.whatsapp\.com\/send.*phone=([\d]+)/i]

// Regex email (RFC 5322 simplifiée)
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

// Regex téléphone international (+XX X XX XX XX XX)
const PHONE_REGEX = /(?:\+|00)?(?:\d[\s.-]?){8,15}\d/g

// Regex téléphone ivoirien (10 chiffres à partir de 27/07/05/01)
const PHONE_CI_REGEX = /(?:\+?225[\s.-]?)?(?:27|07|05|01)(?:\s|\.)?\d{2}(?:\s|\.)?\d{2}(?:\s|\.)?\d{2}(?:\s|\.)?\d{2}/g

// Regex GPS dans URL Google Maps
const GPS_URL_REGEX = /@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/g

// Regex coordonnées dans URL embed
const GPS_EMBED_REGEX = /(?:ll=|center=)(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/g

// Mails à exclure (noreply, example, etc.)
const EXCLUDED_EMAILS = [
  "noreply@", "no-reply@", "donotreply@", "example@", "test@", "sentry@",
  "wixpress.com", "squarespace.com", "godaddy.com",
]

/**
 * Extrait tous les contacts d'une page HTML
 */
export function extractContactsFromPage(params: {
  url: string
  html: string
  text: string
  links: Array<{ text: string; href: string; inFooter: boolean }>
}): PageExtraction {
  const { url, html, text, links } = params

  const emails: ExtractedEmail[] = []
  const phonesMap = new Map<string, ExtractedPhone>()
  const whatsappMap = new Map<string, ExtractedPhone>()
  const socialsMap = new Map<string, ExtractedSocialLink>()
  const addresses: string[] = []
  const gpsList: ExtractedGps[] = []
  let googleMapsUrl: string | undefined
  const allLinks = [...links]

  // ===== EMAILS =====
  // 1. Liens mailto:
  const mailtoRegex = /mailto:([^"'\s?>]+)/gi
  let match
  while ((match = mailtoRegex.exec(html)) !== null) {
    const email = match[1].toLowerCase().trim()
    if (isValidEmail(email) && !isExcludedEmail(email)) {
      emails.push({
        email,
        foundOn: url,
        fromMailtoLink: true,
      })
    }
  }

  // 2. Emails dans le texte (regex)
  const textEmails = text.match(EMAIL_REGEX) || []
  for (const e of textEmails) {
    const email = e.toLowerCase().trim()
    if (isValidEmail(email) && !isExcludedEmail(email) && !emails.find((x) => x.email === email)) {
      // Cherche le contexte (50 chars autour)
      const idx = text.indexOf(e)
      const context = text.slice(Math.max(0, idx - 50), idx + e.length + 50).trim()
      emails.push({ email, foundOn: url, fromMailtoLink: false, context })
    }
  }

  // ===== TÉLÉPHONES =====
  // 1. Liens tel:
  const telRegex = /tel:([^"'\s?>]+)/gi
  while ((match = telRegex.exec(html)) !== null) {
    const raw = match[1].trim()
    const normalized = normalizePhoneCI(raw)
    if (normalized && !phonesMap.has(normalized)) {
      phonesMap.set(normalized, {
        raw,
        normalized,
        foundOn: url,
        fromTelLink: true,
      })
    }
  }

  // 2. Téléphones ivoiriens dans le texte (format spécifique)
  const ciPhones = text.match(PHONE_CI_REGEX) || []
  for (const p of ciPhones) {
    const raw = p.trim()
    const normalized = normalizePhoneCI(raw)
    if (normalized && !phonesMap.has(normalized)) {
      const idx = text.indexOf(p)
      const context = text.slice(Math.max(0, idx - 50), idx + p.length + 50).trim()
      phonesMap.set(normalized, { raw, normalized, foundOn: url, fromTelLink: false, context })
    }
  }

  // 3. Téléphones internationaux dans le texte
  const intPhones = text.match(PHONE_REGEX) || []
  for (const p of intPhones) {
    const raw = p.trim()
    // Skip si déjà matché comme CI
    if (phonesMap.size > 0) {
      const cleaned = raw.replace(/[^\d+]/g, "")
      let alreadyExists = false
      for (const existing of phonesMap.values()) {
        if (existing.raw.replace(/[^\d+]/g, "").includes(cleaned.slice(-8))) {
          alreadyExists = true
          break
        }
      }
      if (alreadyExists) continue
    }
    const normalized = normalizePhoneCI(raw) || raw
    if (!phonesMap.has(normalized) && raw.replace(/[^\d]/g, "").length >= 8) {
      phonesMap.set(normalized, { raw, normalized, foundOn: url, fromTelLink: false })
    }
  }

  // ===== WHATSAPP =====
  // 1. Liens wa.me / api.whatsapp.com
  for (const pattern of WHATSAPP_PATTERNS) {
    const waRegex = new RegExp(pattern.source, "gi")
    while ((match = waRegex.exec(html)) !== null) {
      const num = match[1].replace(/[^\d+]/g, "")
      const normalized = normalizePhoneCI(num)
      if (normalized && !whatsappMap.has(normalized)) {
        whatsappMap.set(normalized, {
          raw: num,
          normalized,
          foundOn: url,
          fromTelLink: false,
        })
      }
    }
  }

  // 2. Texte "WhatsApp" + numéro proche
  const waTextRegex = /whatsapp[^+]*\+?(225[\d\s]{10,}|\d{8,})/gi
  while ((match = waTextRegex.exec(text)) !== null) {
    const num = match[1].replace(/[^\d+]/g, "")
    const normalized = normalizePhoneCI(num)
    if (normalized && !whatsappMap.has(normalized)) {
      whatsappMap.set(normalized, { raw: num, normalized, foundOn: url, fromTelLink: false })
    }
  }

  // ===== RÉSEAUX SOCIAUX =====
  for (const link of allLinks) {
    const href = link.href || ""
    if (!href) continue

    for (const { platform, pattern } of SOCIAL_PATTERNS) {
      if (pattern.test(href) && !socialsMap.has(href)) {
        socialsMap.set(href, {
          platform,
          url: href,
          foundOn: url,
          handle: extractSocialHandle(href, platform),
        })
        break
      }
    }

    // Google Maps
    if (!googleMapsUrl && (href.includes("google.com/maps") || href.includes("maps.app.goo.gl") || href.includes("maps.google"))) {
      googleMapsUrl = href
    }
  }

  // ===== COORDONNÉES GPS =====
  // 1. URL Google Maps dans les liens
  for (const link of allLinks) {
    const href = link.href || ""
    let gpsMatch
    GPS_URL_REGEX.lastIndex = 0
    while ((gpsMatch = GPS_URL_REGEX.exec(href)) !== null) {
      const lat = parseFloat(gpsMatch[1])
      const lng = parseFloat(gpsMatch[2])
      if (isValidGps(lat, lng)) {
        gpsList.push({ lat, lng, foundOn: url, source: "google_maps_url" })
      }
    }
  }

  // 2. Iframes Google Maps / OpenStreetMap
  const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi
  while ((match = iframeRegex.exec(html)) !== null) {
    const iframeSrc = match[1]
    GPS_EMBED_REGEX.lastIndex = 0
    let gpsMatch
    while ((gpsMatch = GPS_EMBED_REGEX.exec(iframeSrc)) !== null) {
      const lat = parseFloat(gpsMatch[1])
      const lng = parseFloat(gpsMatch[2])
      if (isValidGps(lat, lng)) {
        gpsList.push({ lat, lng, foundOn: url, source: "iframe_embed" })
      }
    }
    // Si c'est une iframe Google Maps, récupère l'URL
    if (!googleMapsUrl && (iframeSrc.includes("google.com/maps") || iframeSrc.includes("maps.google"))) {
      googleMapsUrl = iframeSrc
    }
  }

  // 3. JSON-LD schema.org (GeoCoordinates)
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1].trim())
      const geoList = extractGeoFromJsonLd(json)
      for (const geo of geoList) {
        if (isValidGps(geo.lat, geo.lng)) {
          gpsList.push({ lat: geo.lat, lng: geo.lng, foundOn: url, source: "json-ld" })
        }
      }
    } catch {
      // JSON invalide, ignore
    }
  }

  // 4. Microdata (itemprop="geo")
  const microdataRegex = /itemprop=["']geo["'][^>]*>[\s\S]*?content=["'](-?\d+\.\d+)\s+(-?\d+\.\d+)["']/gi
  while ((match = microdataRegex.exec(html)) !== null) {
    const lat = parseFloat(match[1])
    const lng = parseFloat(match[2])
    if (isValidGps(lat, lng)) {
      gpsList.push({ lat, lng, foundOn: url, source: "microdata" })
    }
  }

  // 5. data-lat / data-lng attributes
  const dataLatRegex = /data-lat=["'](-?\d+\.\d+)["']/i
  const dataLngRegex = /data-lng=["'](-?\d+\.\d+)["']/i
  const dataLatMatch = html.match(dataLatRegex)
  const dataLngMatch = html.match(dataLngRegex)
  if (dataLatMatch && dataLngMatch) {
    const lat = parseFloat(dataLatMatch[1])
    const lng = parseFloat(dataLngMatch[1])
    if (isValidGps(lat, lng)) {
      gpsList.push({ lat, lng, foundOn: url, source: "data-attribute" })
    }
  }

  // ===== ADRESSES POSTALES =====
  // 1. Schema.org PostalAddress (JSON-LD)
  jsonLdRegex.lastIndex = 0
  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1].trim())
      const addressesList = extractAddressFromJsonLd(json)
      for (const addr of addressesList) {
        if (addr.length > 10 && !addresses.includes(addr)) {
          addresses.push(addr)
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Pattern texte "Adresse: ..."
  const addrTextRegex = /(?:adresse|address|localisation|location)\s*[:：]\s*([^\n<]{10,100})/i
  const addrMatch = text.match(addrTextRegex)
  if (addrMatch && addrMatch[1].trim().length > 10) {
    const addr = addrMatch[1].trim()
    if (!addresses.includes(addr)) {
      addresses.push(addr)
    }
  }

  // 3. Patterns ivoiriens : "Cocody, Abidjan" / "Riviera, Abidjan" / "Bouake" etc.
  const ciCityRegex = /\b(?:Cocody|Plateau|Yopougon|Marcory|Treichville|Koumassi|Abobo|Adjamé|Port-Bouët|Bingerville|Attécoubé|Songon|Abidjan|Bouaké|Yamoussoukro|San-Pédro|Korhogo|Daloa|Man|Gagnoa|Divo|Abengourou)\b[^.\n]{5,80}/gi
  const ciAddrMatches = text.match(ciCityRegex) || []
  for (const a of ciAddrMatches) {
    const trimmed = a.trim().slice(0, 100)
    if (trimmed.length > 10 && !addresses.includes(trimmed)) {
      addresses.push(trimmed)
    }
  }

  return {
    emails,
    phones: Array.from(phonesMap.values()),
    whatsapp: Array.from(whatsappMap.values()),
    socials: Array.from(socialsMap.values()),
    googleMapsUrl,
    addresses: addresses.slice(0, 10),
    gps: gpsList,
    links: allLinks,
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function isValidEmail(email: string): boolean {
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)
}

function isExcludedEmail(email: string): boolean {
  return EXCLUDED_EMAILS.some((e) => email.toLowerCase().includes(e))
}

function isValidGps(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) && !isNaN(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0) // skip null island
  )
}

/** Extrait les coordonnées GPS depuis un objet JSON-LD (récursif) */
function extractGeoFromJsonLd(json: unknown): Array<{ lat: number; lng: number }> {
  const results: Array<{ lat: number; lng: number }> = []

  function walk(obj: unknown) {
    if (!obj || typeof obj !== "object") return
    const o = obj as Record<string, unknown>

    // Cas 1: objet GeoCoordinates direct
    if (o["@type"] === "GeoCoordinates" || o["latitude"]) {
      const lat = parseFloat(String(o.latitude))
      const lng = parseFloat(String(o.longitude))
      if (!isNaN(lat) && !isNaN(lng)) {
        results.push({ lat, lng })
      }
    }

    // Cas 2: geo est un sous-objet
    if (o.geo && typeof o.geo === "object") {
      walk(o.geo)
    }

    // Cas 3: récursion sur tous les sous-objets
    for (const key of Object.keys(o)) {
      if (typeof o[key] === "object" && o[key] !== null) {
        walk(o[key])
      }
    }
  }

  walk(json)
  return results
}

/** Extrait les adresses postales depuis un objet JSON-LD (récursif) */
function extractAddressFromJsonLd(json: unknown): string[] {
  const results: string[] = []

  function walk(obj: unknown) {
    if (!obj || typeof obj !== "object") return
    const o = obj as Record<string, unknown>

    if (o["@type"] === "PostalAddress") {
      const parts = [
        o.streetAddress,
        o.addressLocality,
        o.addressRegion,
        o.postalCode,
        o.addressCountry,
      ].filter((p) => p && typeof p === "string")
      if (parts.length > 0) {
        results.push(parts.join(", "))
      }
    }

    if (o.address && typeof o.address === "object") {
      walk(o.address)
    }
    if (o.location && typeof o.location === "object") {
      walk(o.location)
    }

    for (const key of Object.keys(o)) {
      if (typeof o[key] === "object" && o[key] !== null) {
        walk(o[key])
      }
    }
  }

  walk(json)
  return results
}
