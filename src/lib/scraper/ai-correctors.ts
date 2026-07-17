/**
 * Correcteurs déterministes (sans IA) pour téléphones, emails, adresses
 * Plus rapides et fiables que le LLM pour les corrections simples
 */

import type { CleanedEntity } from "./ai-cleaner-types"
import { DISPOSABLE_EMAIL_DOMAINS } from "./ai-cleaner-types"

// ============================================================================
// TÉLÉPHONE
// ============================================================================

/**
 * Corrige un numéro de téléphone ivoirien/international
 *
 * Corrections courantes :
 *  - "07 08 12 34 56" → "+225 07 08 12 34 56"
 *  - "002250708123456" → "+225 07 08 12 34 56"
 *  - "+2250708123456" → "+225 07 08 12 34 56"
 *  - "2250708123456" → "+225 07 08 12 34 56"
 *  - Numéro trop court (8 chiffres avant 2021) → ajoute indicatif
 *  - Doublons de chiffres → corrige
 *  - Espaces/tirets mal placés → normalise
 */
export function fixPhone(input: string): {
  cleaned: string | null
  corrected: boolean
  method: string
} {
  if (!input) return { cleaned: null, corrected: false, method: "empty" }

  // Nettoie tout sauf les chiffres et le +
  let cleaned = input.replace(/[^\d+]/g, "")
  if (!cleaned) return { cleaned: null, corrected: false, method: "empty" }

  // Cas 1 : format international +225...
  if (cleaned.startsWith("+225")) {
    const rest = cleaned.slice(4)
    // Si plus de 10 chiffres après +225, tronque à 10
    if (rest.length > 10) {
      return {
        cleaned: formatIvorian(rest.slice(0, 10)),
        corrected: true,
        method: "ivorian_truncate",
      }
    }
    if (rest.length === 10) {
      return {
        cleaned: formatIvorian(rest),
        corrected: input.replace(/[^\d+]/g, "") !== cleaned,
        method: "ivorian_normalize",
      }
    }
    // Si 8 chiffres (ancien format avant 2021), préfixe avec 0
    if (rest.length === 8) {
      return {
        cleaned: formatIvorian("0" + rest),
        corrected: true,
        method: "ivorian_legacy_prefix",
      }
    }
  }

  // Cas 2 : 00225 (format international alternatif)
  if (cleaned.startsWith("00225")) {
    return fixPhone("+" + cleaned.slice(2))
  }

  // Cas 3 : 2250708123456 (12 chiffres sans +)
  if (cleaned.length === 12 && cleaned.startsWith("225")) {
    return fixPhone("+" + cleaned)
  }

  // Cas 4 : numéro ivoirien 10 chiffres (27/07/05/01)
  if (cleaned.length === 10 && /^(27|07|05|01)/.test(cleaned)) {
    return {
      cleaned: formatIvorian(cleaned),
      corrected: true,
      method: "ivorian_add_prefix",
    }
  }

  // Cas 5 : numéro ivoirien ancien format 8 chiffres
  if (cleaned.length === 8 && /^(2[0-9]|0[0-9])/.test(cleaned)) {
    // Devine le préfixe : 20→2720, 21→0721, etc.
    // Avant 2021 : 27 → fixe, 07 → mobile, 05 → mobile, 01 → mobile
    // Le format 8 chiffres commençait par 20-27 (fixe) ou 07/05/01 (mobile)
    // On suppose fixe si commence par 2, mobile sinon
    const prefix = cleaned.startsWith("2") ? "27" : "07"
    return {
      cleaned: formatIvorian(prefix + cleaned),
      corrected: true,
      method: "ivorian_legacy_full",
    }
  }

  // Cas 6 : numéro international générique avec +
  if (cleaned.startsWith("+") && cleaned.length >= 8) {
    return {
      cleaned: cleaned,
      corrected: input.replace(/[^\d+]/g, "") !== cleaned,
      method: "international_normalize",
    }
  }

  // Cas 7 : numéro sans indicatif — suppose Côte d'Ivoire
  if (cleaned.length >= 8 && !cleaned.startsWith("+")) {
    return {
      cleaned: "+225" + cleaned.slice(0, 10),
      corrected: true,
      method: "ivorian_default_prefix",
    }
  }

  return { cleaned: null, corrected: false, method: "unrecognized" }
}

/** Formate un numéro ivoirien 10 chiffres → "+225 XX XX XX XX XX" */
function formatIvorian(digits10: string): string {
  return `+225 ${digits10.slice(0, 2)} ${digits10.slice(2, 4)} ${digits10.slice(4, 6)} ${digits10.slice(6, 8)} ${digits10.slice(8, 10)}`
}

// ============================================================================
// EMAIL
// ============================================================================

/** Typos courantes sur les TLDs et domaines */
const DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.fr": "gmail.com",
  "gmal.com": "gmail.com",
  "gnail.com": "gmail.com",
  "yahooo.com": "yahoo.com",
  "yaho.com": "yahoo.com",
  "yahoo.fr": "yahoo.fr", // garde
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloook.com": "outlook.com",
  "oranige.ci": "orange.ci",
  "orane.ci": "orange.ci",
  "orangeci": "orange.ci",
  "yhaoo.com": "yahoo.com",
  "icoud.com": "icloud.com",
  "iclod.com": "icloud.com",
}

/** Typos courantes sur les séparateurs */
const COMMON_TYPOS = [
  { pattern: /\.\.$/, replacement: "." }, // double point final
  { pattern: /,,/g, replacement: "." }, // virgule au lieu de point
  { pattern: /\s+/g, replacement: "" }, // espaces
  { pattern: /;$/g, replacement: "" }, // point-virgule final
]

/**
 * Corrige un email (typos, domaine, syntaxe)
 */
export function fixEmail(input: string): {
  cleaned: string | null
  corrected: boolean
  method: string
  valid: boolean
} {
  if (!input) return { cleaned: null, corrected: false, method: "empty", valid: false }

  let email = input.trim().toLowerCase()

  // Corrige les typos courantes
  for (const typo of COMMON_TYPOS) {
    if (typo.pattern.test(email)) {
      email = email.replace(typo.pattern, typo.replacement)
    }
  }

  // Retire les espaces
  email = email.replace(/\s/g, "")

  // Valide la syntaxe de base
  const parts = email.split("@")
  if (parts.length !== 2) {
    return { cleaned: null, corrected: false, method: "invalid_syntax", valid: false }
  }

  let [local, domain] = parts

  // Corrige le domaine
  domain = domain.replace(/,$/, ".") // virgule finale → point
  if (DOMAIN_TYPOS[domain]) {
    const corrected = DOMAIN_TYPOS[domain]
    if (corrected !== domain) {
      domain = corrected
      email = `${local}@${domain}`
      return { cleaned: email, corrected: true, method: "domain_typo", valid: true }
    }
  }

  // Valide la syntaxe finale
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i
  if (!emailRegex.test(email)) {
    return { cleaned: null, corrected: false, method: "invalid_format", valid: false }
  }

  // Vérifie domaines jetables
  if (DISPOSABLE_EMAIL_DOMAINS.some((d) => domain.includes(d))) {
    return { cleaned: email, corrected: false, method: "disposable_domain", valid: false }
  }

  // Vérifie cohérence (TLD doit avoir au moins 2 lettres)
  const tld = domain.split(".").pop() || ""
  if (tld.length < 2) {
    return { cleaned: null, corrected: false, method: "invalid_tld", valid: false }
  }

  return {
    cleaned: email,
    corrected: email !== input.trim().toLowerCase(),
    method: "valid",
    valid: true,
  }
}

// ============================================================================
// ADRESSE
// ============================================================================

/** Communes d'Abidjan et villes principales CI */
const CI_COMMUNES = [
  "Cocody", "Plateau", "Yopougon", "Marcory", "Treichville",
  "Koumassi", "Abobo", "Adjamé", "Port-Bouët", "Bingerville",
  "Attécoubé", "Songon", "Bingerville",
]
const CI_CITIES = [
  "Abidjan", "Bouaké", "Yamoussoukro", "San-Pédro", "Korhogo",
  "Daloa", "Man", "Gagnoa", "Divo", "Abengourou", "Dabou",
  "Issia", "Sinfra", "Soubré", "Séguéla", "Touba", "Odienné",
]

/** Quartiers connus d'Abidjan */
const CI_NEIGHBORHOODS = [
  "Riviera", "Riviera 2", "Riviera 3", "Riviera 4", "Riviera Palmeraie",
  "Angré", "Bingerville", "Cocody Angré", "Cocody Riviera",
  "II Plateaux", "2 Plateaux", "Les 2 Plateaux",
  "Plateau", "Adjamé", "Abobo", "Williamsville",
  "Marcory Zone 4", "Marcory Zone 4C", "Treichville",
  "Koumassi", "Koumassi Zone Industrielle",
  "Yopougon", "Yopougon Sicogi", "Yopougon Selmer",
  "Port-Bouët", "Vridi", "Treichville-Lagune",
  "Adjamé Bracodi", "Adjamé Williamsville",
]

/**
 * Normalise une adresse postale ivoirienne
 * - Sépare les composantes (rue, numéro, commune, ville)
 * - Standardise les abréviations
 * - Retire les doublons
 */
export function normalizeAddress(input: string): {
  cleaned: string
  components: CleanedEntity["addressComponents"]
  corrected: boolean
} {
  if (!input) {
    return { cleaned: "", components: {}, corrected: false }
  }

  let cleaned = input.trim()
    .replace(/\s+/g, " ") // collapse espaces
    .replace(/,\s*,/g, ",") // virgules multiples
    .replace(/^,\s*|,\s*$/g, "") // virgules début/fin
    .trim()

  // Standardise les abréviations courantes
  const abbr: Record<string, string> = {
    "bd": "Boulevard",
    "av": "Avenue",
    "av.": "Avenue",
    "rue ": "Rue ",
    "bp": "BP",
    "b.p.": "BP",
    "imm ": "Immeuble ",
    "imm.": "Immeuble",
    "st": "Saint",
    "ste": "Sainte",
    "cite": "Cité",
    "zt": "Zone Technique",
    "zi": "Zone Industrielle",
  }
  for (const [from, to] of Object.entries(abbr)) {
    cleaned = cleaned.replace(new RegExp(`\\b${from}\\b`, "gi"), to)
  }

  // Capitalise correctement
  cleaned = cleaned
    .split(" ")
    .map((w) => {
      if (w.length <= 2) return w.toUpperCase() // BP, ZI, etc.
      // Garde les mots déjà en majuscules (acronymes)
      if (w === w.toUpperCase()) return w
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(" ")

  // Parse les composantes
  const components: CleanedEntity["addressComponents"] = {}

  // Détection ville (CI)
  for (const city of CI_CITIES) {
    const regex = new RegExp(`\\b${city}\\b`, "i")
    if (regex.test(cleaned)) {
      components.city = city
      // Si la ville n'est pas Abidjan, le pays est CI
      components.country = "Côte d'Ivoire"
      break
    }
  }

  // Détection commune (Abidjan)
  for (const commune of CI_COMMUNES) {
    const regex = new RegExp(`\\b${commune}\\b`, "i")
    if (regex.test(cleaned)) {
      components.commune = commune
      if (!components.city) components.city = "Abidjan"
      components.country = "Côte d'Ivoire"
      break
    }
  }

  // Détection quartier
  for (const neighborhood of CI_NEIGHBORHOODS) {
    const regex = new RegExp(neighborhood.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    if (regex.test(cleaned)) {
      // Stocke dans commune si pas déjà détecté
      if (!components.commune) {
        components.commune = neighborhood
      }
      break
    }
  }

  // Numéro de rue
  const numberMatch = cleaned.match(/^(\d+)\s+/)
  if (numberMatch) {
    components.number = numberMatch[1]
  }

  // BP (boîte postale)
  const bpMatch = cleaned.match(/BP\s*(\d+)/i)
  if (bpMatch) {
    components.postalCode = "BP " + bpMatch[1]
  }

  // Rue/Boulevard/Avenue
  const streetMatch = cleaned.match(/(Boulevard|Rue|Avenue|Impasse|Place)\s+([A-Za-zÀ-ÿ\s]+)/i)
  if (streetMatch) {
    components.street = `${streetMatch[1]} ${streetMatch[2].trim()}`
  }

  return {
    cleaned,
    components,
    corrected: cleaned !== input.trim(),
  }
}

// ============================================================================
// NOM D'ENTREPRISE
// ============================================================================

/** Suffixes légaux à retirer pour le matching */
const LEGAL_SUFFIXES = [
  "SARL", "SARL CI", "S.A.R.L", "SA", "S.A.", "EURL", "SASU", "SAS",
  "SCI", "SNC", "SCS", "SCA", "SARLCI", "GIE", "Groupe", "Group",
  "Ltd", "Inc", "Corp", "Corporation", "LLC", "LLP",
  "Entreprise", "Company", "Etablissement", "Ets", "Etab",
  "& Cie", "et Compagnie", "& Co",
]

/**
 * Nettoie un nom d'entreprise :
 *  - retire les suffixes légaux (SARL, SA, etc.)
 *  - normalise les espaces
 *  - retire les caractères spéciaux en début/fin
 *  - corrige la capitalisation
 */
export function cleanBusinessName(input: string): {
  cleaned: string
  corrected: boolean
  removedSuffix?: string
} {
  if (!input) return { cleaned: "", corrected: false }

  let cleaned = input.trim()
  let removedSuffix: string | undefined

  // Retire les suffixes légaux (en fin de nom)
  for (const suffix of LEGAL_SUFFIXES) {
    const regex = new RegExp(`\\s+${suffix.replace(/\./g, "\\.")}\\.?\\s*$`, "i")
    if (regex.test(cleaned)) {
      removedSuffix = suffix
      cleaned = cleaned.replace(regex, "").trim()
      break
    }
  }

  // Retire les parenthèses en fin
  cleaned = cleaned.replace(/\s*\([^)]*\)\s*$/, "").trim()

  // Retire les crochets en fin
  cleaned = cleaned.replace(/\s*\[[^\]]*\]\s*$/, "").trim()

  // Collapse espaces
  cleaned = cleaned.replace(/\s+/g, " ").trim()

  // Retire les caractères spéciaux en début/fin
  cleaned = cleaned.replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9]+$/g, "")

  // Capitalise correctement (première lettre majuscule, reste minuscule)
  // Garde les acronymes (tout majuscules)
  cleaned = cleaned
    .split(" ")
    .map((w) => {
      if (w.length <= 3 && w === w.toUpperCase()) return w // acronyme
      if (w.includes("-")) {
        return w.split("-").map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("-")
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(" ")

  return {
    cleaned,
    corrected: cleaned !== input.trim(),
    removedSuffix,
  }
}
