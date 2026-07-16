/**
 * Détection de blocages Google : captcha, 429, consentement, IP bannie
 *
 * Google Maps peut bloquer de plusieurs façons :
 *  1. CAPTCHA "Unusual traffic" — page redirect vers /sorry/
 *  2. HTTP 429 — rate limit explicite
 *  3. Consentement RGPD (Cookies) — bloque le contenu
 *  4. Page vide ou sans résultats (timeout)
 *  5. "Couldn't find this place"
 *  6. Challenge JavaScript (Percipient, reCAPTCHA)
 *  7. Page de connexion Google demandée
 */

import type { Page } from "playwright"

export type BlockReason =
  | "captcha"
  | "rate_limit_429"
  | "ip_blocked"
  | "consent_required"
  | "login_required"
  | "no_results"
  | "timeout"
  | "challenge"
  | "unknown"

export interface BlockDetection {
  blocked: boolean
  reason?: BlockReason
  message?: string
  recoverable: boolean
}

/**
 * Détecte si la page courante est bloquée
 */
export async function detectBlock(page: Page): Promise<BlockDetection> {
  try {
    const url = page.url()
    const title = await page.title().catch(() => "")

    // 1. CAPTCHA / unusual traffic — URL contient /sorry/ ou /recaptcha/
    if (url.includes("/sorry/") || url.includes("recaptcha")) {
      return {
        blocked: true,
        reason: "captcha",
        message: "CAPTCHA détecté — Google suspecte un trafic inhabituel",
        recoverable: false, // nécessite CAPTCHA solving ou proxy rotation
      }
    }

    // 2. Titre indicatif
    const lowerTitle = title.toLowerCase()
    if (lowerTitle.includes("unusual traffic") || lowerTitle.includes("captcha")) {
      return {
        blocked: true,
        reason: "captcha",
        message: "Page 'Unusual traffic' détectée",
        recoverable: false,
      }
    }

    // 3. Challenge JavaScript (page intermédiaire)
    if (lowerTitle.includes("just a moment") || lowerTitle.includes("checking your browser")) {
      return {
        blocked: true,
        reason: "challenge",
        message: "Challenge JavaScript en cours",
        recoverable: true, // attendre quelques secondes
      }
    }

    // 4. Page de connexion Google demandée
    if (url.includes("accounts.google.com") || lowerTitle.includes("sign in")) {
      return {
        blocked: true,
        reason: "login_required",
        message: "Google demande une connexion",
        recoverable: false,
      }
    }

    // 5. Consentement cookies (RGPD)
    const consentSelectors = [
      "iframe[src*='consent.google']",
      "button:has-text('Accept all')",
      "button:has-text('Tout accepter')",
      "button:has-text('I agree')",
      "button:has-text('J'accepte')",
      "[aria-label='Accept all']",
    ]
    for (const sel of consentSelectors) {
      const el = await page.$(sel).catch(() => null)
      if (el) {
        return {
          blocked: true,
          reason: "consent_required",
          message: "Bannière de consentement cookies détectée",
          recoverable: true, // peut être acceptée
        }
      }
    }

    // 6. HTTP 429 dans le contenu ou erreur réseau
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) || "").catch(() => "")
    if (bodyText.includes("429") && bodyText.toLowerCase().includes("too many")) {
      return {
        blocked: true,
        reason: "rate_limit_429",
        message: "Rate limit 429 détecté",
        recoverable: true, // backoff long
      }
    }

    // 7. Page sans résultats
    const noResultsSelectors = [
      ":text('No results found')",
      ":text('Aucun résultat')",
      ":text('Couldn't find')",
      ":text('Nous n'avons trouvé aucun résultat')",
    ]
    for (const sel of noResultsSelectors) {
      try {
        const el = await page.$(sel).catch(() => null)
        if (el) {
          return {
            blocked: true,
            reason: "no_results",
            message: "Aucun résultat trouvé pour cette requête",
            recoverable: false,
          }
        }
      } catch {
        // sélecteur :text() non supporté en playwright pur
      }
    }

    // 8. Vérification finale : la liste des résultats est-elle présente ?
    const hasResults = await page
      .$('[role="feed"], [aria-label*="Results"], div[jstcache]')
      .catch(() => null)

    if (!hasResults && bodyText.length < 200) {
      return {
        blocked: true,
        reason: "unknown",
        message: "Page vide ou contenu inattendu",
        recoverable: true,
      }
    }

    return { blocked: false, recoverable: false }
  } catch (err) {
    return {
      blocked: true,
      reason: "unknown",
      message: `Erreur lors de la détection: ${(err as Error).message}`,
      recoverable: true,
    }
  }
}

/**
 * Tente d'accepter la bannière de consentement cookies
 */
export async function acceptConsent(page: Page): Promise<boolean> {
  const consentButtons = [
    "iframe[src*='consent.google']",
  ]
  // Tente d'abord l'iframe de consentement
  for (const sel of consentButtons) {
    const frame = page.frameLocator(sel)
    if (frame) {
      try {
        await frame.locator("button:has-text('Accept all'), button:has-text('Tout accepter')").first().click({ timeout: 2000 })
        await page.waitForTimeout(1500)
        return true
      } catch {
        // continue
      }
    }
  }

  // Puis les boutons directs
  const directButtons = [
    "button:has-text('Accept all')",
    "button:has-text('Tout accepter')",
    "button:has-text('I agree')",
    "button:has-text('J'accepte')",
    "[aria-label='Accept all']",
  ]
  for (const sel of directButtons) {
    try {
      const btn = page.locator(sel).first()
      if (await btn.isVisible({ timeout: 1000 })) {
        await btn.click({ timeout: 2000 })
        await page.waitForTimeout(1500)
        return true
      }
    } catch {
      // continue
    }
  }

  return false
}

/**
 * Vérifie si l'URL est l'URL de recherche Google Maps attendue
 * (anti-redirect malveillant)
 */
export function isExpectedGoogleMapsUrl(url: string): boolean {
  return (
    url.includes("google.com/maps") ||
    url.includes("maps.google.") ||
    url.includes("www.google.ci/maps") ||
    url.includes("google.com/maps")
  )
}

/**
 * Statut d'un job — utilisé pour signaler un blocage au caller
 */
export class BlockError extends Error {
  constructor(
    public reason: BlockReason,
    message: string,
    public recoverable: boolean
  ) {
    super(message)
    this.name = "BlockError"
  }
}
