/**
 * Normalisation des coordonnées (téléphone, email, URL, GPS, noms)
 * Utilisé pour la déduplication et l'enrichissement
 */

/**
 * Normalise un numéro de téléphone au format international +225 (Côte d'Ivoire)
 * Gère :
 *  - Espaces, tirets, points
 *  - Préfixes locaux (27, 07, 05, 01)
 *  - Formats courts (8 chiffres)
 *  - Indicatifs étrangers
 */
export function normalizePhone(input: string, defaultCountry = "225"): string | null {
  if (!input) return null

  // Nettoie tout sauf les chiffres et le +
  let cleaned = input.replace(/[^\d+]/g, "")

  // Cas : déjà au format international +225...
  if (cleaned.startsWith("+225")) {
    const rest = cleaned.slice(4)
    if (rest.length === 10) return `+225 ${rest.slice(0, 2)} ${rest.slice(2, 4)} ${rest.slice(4, 6)} ${rest.slice(6, 8)} ${rest.slice(8, 10)}`
  }

  // Cas : commence par 00225 (format international alternatif)
  if (cleaned.startsWith("00225")) {
    cleaned = "+" + cleaned.slice(2)
    return normalizePhone(cleaned)
  }

  // Cas : numéro local ivoirien 10 chiffres (depuis 2021 : 27/07/05/01 + 8 chiffres)
  if (cleaned.length === 10 && /^(27|07|05|01)/.test(cleaned)) {
    return normalizePhone(`+225${cleaned}`)
  }

  // Cas : numéro local court 8 chiffres (avant 2021)
  if (cleaned.length === 8 && defaultCountry === "225") {
    return normalizePhone(`+2250${cleaned}`)
  }

  // Cas : numéro international générique
  if (cleaned.startsWith("+") && cleaned.length >= 8) {
    return cleaned
  }

  // Cas : numéro sans indicatif, suppose pays par défaut
  if (cleaned.length >= 8 && !cleaned.startsWith("+")) {
    return `+${defaultCountry}${cleaned}`
  }

  return null
}

/**
 * Normalise un email (lowercase, trim)
 */
export function normalizeEmail(input: string): string | null {
  if (!input) return null
  const email = input.trim().toLowerCase()
  // Regex RFC 5322 simplifiée
  if (/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) {
    return email
  }
  return null
}

/**
 * Normalise une URL : ajoute https:// si manquant, retire les paramètres de tracking
 */
export function normalizeUrl(input: string): string | null {
  if (!input) return null
  let url = input.trim()
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url
  }
  try {
    const u = new URL(url)
    // Retire les paramètres de tracking communs
    const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"]
    trackingParams.forEach((p) => u.searchParams.delete(p))
    // Retire le slash final sauf si racine
    let path = u.pathname
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1)
    }
    return `${u.protocol}//${u.host}${path}${u.search ? u.search : ""}`
  } catch {
    return null
  }
}

/**
 * Normalise un nom d'entreprise pour le matching :
 *  - lowercase
 *  - retire accents
 *  - retire ponctuation
 *  - retire suffixes légaux (SARL, SA, EURL, etc.)
 *  - collapse whitespace
 */
export function normalizeName(input: string): string {
  if (!input) return ""
  let s = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // retire accents
    .replace(/[^\w\s]/g, " ") // retire ponctuation
    .replace(/\s+/g, " ")
    .trim()

  // Retire suffixes légaux ivoiriens et français
  const suffixes = [
    "sarl", "sarlci", "sa", "eurl", "sasu", "sas", "sci", "snc", "scs",
    "sca", "coop", "gie", "grp", "group", "ltd", "inc", "corp",
    "entreprise", "company", "etablissement", "ets", "etab",
  ]
  const words = s.split(" ").filter((w) => !suffixes.includes(w))
  return words.join(" ").trim()
}

/**
 * Parse une adresse GPS depuis une URL Google Maps
 * Format: /@LAT,LNG,OU /place/LAT,LNG
 */
export function parseGpsFromUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null
  // /@5.3461,-3.9986,15z
  const match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (match) {
    const lat = parseFloat(match[1])
    const lng = parseFloat(match[2])
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng }
    }
  }
  return null
}

/**
 * Parse une note (rating) depuis une string "4,5" ou "4.5" ou "4.5 étoiles"
 */
export function parseRating(input: string): number | null {
  if (!input) return null
  const match = input.match(/(\d+[.,]\d)/)
  if (match) {
    return parseFloat(match[1].replace(",", "."))
  }
  const intMatch = input.match(/(\d)/)
  if (intMatch) {
    return parseInt(intMatch[1], 10)
  }
  return null
}

/**
 * Parse un nombre d'avis depuis "1 234 avis" ou "(1234)" ou "1234"
 */
export function parseReviewCount(input: string): number | null {
  if (!input) return null
  // Retire tout sauf chiffres et espaces
  const cleaned = input.replace(/[^\d\s]/g, "").trim()
  const num = parseInt(cleaned.replace(/\s/g, ""), 10)
  return isNaN(num) ? null : num
}
