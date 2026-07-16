/**
 * Déduplication des lieux extraits
 *
 * Stratégies :
 *  1. Match exact sur placeId Google (100%)
 *  2. Match sur téléphone normalisé (95%)
 *  3. Match sur email normalisé (98%)
 *  4. Match sur site web normalisé (90%)
 *  5. Similarité nom + proximité GPS (Jaro-Winkler + distance haversine)
 *  6. Clustering par seuil de similarité
 */

import type { ScrapedPlace, DuplicateGroup } from "./types"
import { normalizePhone, normalizeEmail, normalizeUrl, normalizeName } from "./normalize"

/** Index de déduplication buildé à partir d'une collection existante */
export interface DedupIndex {
  byPlaceId: Map<string, ScrapedPlace>
  byPhone: Map<string, ScrapedPlace>
  byEmail: Map<string, ScrapedPlace>
  byWebsite: Map<string, ScrapedPlace>
  byNameGps: Array<{ name: string; gps: { lat: number; lng: number }; place: ScrapedPlace }>
}

/** Crée un index vide (ou pré-rempli avec des lieux existants) */
export function createDedupIndex(existing: ScrapedPlace[] = []): DedupIndex {
  const index: DedupIndex = {
    byPlaceId: new Map(),
    byPhone: new Map(),
    byEmail: new Map(),
    byWebsite: new Map(),
    byNameGps: [],
  }
  for (const place of existing) {
    addToIndex(index, place)
  }
  return index
}

/** Ajoute un lieu à l'index */
export function addToIndex(index: DedupIndex, place: ScrapedPlace): void {
  if (place.placeId) {
    index.byPlaceId.set(place.placeId, place)
  }
  if (place.phoneNormalized) {
    index.byPhone.set(place.phoneNormalized, place)
  }
  if (place.email) {
    const norm = normalizeEmail(place.email)
    if (norm) index.byEmail.set(norm, place)
  }
  if (place.website) {
    const norm = normalizeUrl(place.website)
    if (norm) index.byWebsite.set(norm, place)
  }
  if (place.gps) {
    index.byNameGps.push({
      name: normalizeName(place.name),
      gps: place.gps,
      place,
    })
  }
}

export interface DedupMatch {
  isDuplicate: boolean
  duplicateOf?: ScrapedPlace
  similarity: number
  reason: string
}

/**
 * Vérifie si un lieu est un doublon d'un lieu déjà indexé
 */
export function checkDuplicate(place: ScrapedPlace, index: DedupIndex): DedupMatch {
  // 1. Place ID exact
  if (place.placeId && index.byPlaceId.has(place.placeId)) {
    return {
      isDuplicate: true,
      duplicateOf: index.byPlaceId.get(place.placeId),
      similarity: 1.0,
      reason: "place_id_exact",
    }
  }

  // 2. Téléphone normalisé
  if (place.phoneNormalized && index.byPhone.has(place.phoneNormalized)) {
    return {
      isDuplicate: true,
      duplicateOf: index.byPhone.get(place.phoneNormalized),
      similarity: 0.95,
      reason: "phone_match",
    }
  }

  // 3. Email normalisé
  if (place.email) {
    const normEmail = normalizeEmail(place.email)
    if (normEmail && index.byEmail.has(normEmail)) {
      return {
        isDuplicate: true,
        duplicateOf: index.byEmail.get(normEmail),
        similarity: 0.98,
        reason: "email_match",
      }
    }
  }

  // 4. Site web normalisé
  if (place.website) {
    const normUrl = normalizeUrl(place.website)
    if (normUrl && index.byWebsite.has(normUrl)) {
      return {
        isDuplicate: true,
        duplicateOf: index.byWebsite.get(normUrl),
        similarity: 0.90,
        reason: "website_match",
      }
    }
  }

  // 5. Similarité nom + proximité GPS
  if (place.gps && place.name) {
    const normName = normalizeName(place.name)
    for (const entry of index.byNameGps) {
      const nameSim = jaroWinkler(normName, entry.name)
      const dist = haversineDistance(place.gps, entry.gps)

      // Même nom (>85%) + GPS proche (<200m)
      if (nameSim >= 0.85 && dist <= 0.2) {
        const sim = nameSim * (1 - dist / 10) // pondère par distance
        return {
          isDuplicate: true,
          duplicateOf: entry.place,
          similarity: Math.max(0.80, sim),
          reason: `name_gps_match (name=${nameSim.toFixed(2)}, dist=${dist.toFixed(2)}km)`,
        }
      }

      // Nom très proche (>95%) même sans GPS
      if (nameSim >= 0.95) {
        return {
          isDuplicate: true,
          duplicateOf: entry.place,
          similarity: nameSim,
          reason: "name_similar",
        }
      }
    }
  }

  return { isDuplicate: false, similarity: 0, reason: "no_match" }
}

/**
 * Traite un lot de lieux et retourne les uniques + les groupes de doublons
 */
export function deduplicatePlaces(places: ScrapedPlace[]): {
  unique: ScrapedPlace[]
  duplicates: DuplicateGroup[]
} {
  const index = createDedupIndex()
  const unique: ScrapedPlace[] = []
  const duplicateGroups: DuplicateGroup[] = []

  for (const place of places) {
    // Assure la normalisation des champs avant check
    if (place.phone && !place.phoneNormalized) {
      place.phoneNormalized = normalizePhone(place.phone) || undefined
    }
    if (place.email) {
      const norm = normalizeEmail(place.email)
      if (norm) place.email = norm
    }
    if (place.website) {
      const norm = normalizeUrl(place.website)
      if (norm) place.website = norm
    }

    const match = checkDuplicate(place, index)

    if (match.isDuplicate && match.duplicateOf) {
      // Ajoute au groupe existant ou crée un nouveau
      let group = duplicateGroups.find((g) => g.canonicalId === match.duplicateOf!.placeId || g.canonicalName === match.duplicateOf!.name)
      if (!group) {
        group = {
          canonicalId: match.duplicateOf.placeId || match.duplicateOf.name,
          canonicalName: match.duplicateOf.name,
          duplicates: [],
          confidence: match.similarity,
        }
        duplicateGroups.push(group)
      }
      group.duplicates.push({
        id: place.placeId || place.name,
        name: place.name,
        similarity: match.similarity,
        reason: match.reason,
      })
      group.confidence = Math.max(group.confidence, match.similarity)
    } else {
      unique.push(place)
      addToIndex(index, place)
    }
  }

  return { unique, duplicates: duplicateGroups }
}

// ============================================================================
// ALGORITHMES DE SIMILARITÉ
// ============================================================================

/**
 * Distance haversine entre 2 points GPS (en km)
 */
export function haversineDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371 // rayon Terre en km
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Similarité Jaro-Winkler entre 2 chaînes (0 à 1)
 * Bonne pour les noms d'entreprises (préfixes communs comptent plus)
 */
export function jaroWinkler(s1: string, s2: string): number {
  if (!s1 || !s2) return 0
  if (s1 === s2) return 1

  const jaro = jaroSimilarity(s1, s2)
  // Bonus de préfixe commun (max 4 caractères)
  let prefixLen = 0
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length))
  for (let i = 0; i < maxPrefix && s1[i] === s2[i]; i++) {
    prefixLen++
  }
  return jaro + prefixLen * 0.1 * (1 - jaro)
}

function jaroSimilarity(s1: string, s2: string): number {
  const len1 = s1.length
  const len2 = s2.length
  if (len1 === 0 || len2 === 0) return 0

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1
  const s1Matches = new Array(len1).fill(false)
  const s2Matches = new Array(len2).fill(false)

  let matches = 0
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance)
    const end = Math.min(i + matchDistance + 1, len2)
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0

  // Compte les transpositions
  let transpositions = 0
  let k = 0
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }
  transpositions /= 2

  return (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3
}
