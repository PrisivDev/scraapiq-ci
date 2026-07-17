/**
 * Détecteur de blocages spécifiques à Facebook
 *
 * Facebook bloque de nombreuses façons :
 *  1. Login wall — redirige vers /login.php ou m.facebook.com/?next=...
 *  2. Consent RGPD — bannière cookies
 *  3. Bot detection — page "Confirm Your Identity" ou checkpoint
 *  4. Rate limit — "You're temporarily blocked"
 *  5. Page inexistante — "This page isn't available"
 *  6. Challenge CAPTCHA
 *  7. 2FA demandé
 */

import type { Page } from "playwright"

export type FacebookBlockReason =
  | "login_required"
  | "consent_required"
  | "bot_detected"
  | "rate_limited"
  | "page_unavailable"
  | "captcha"
  | "two_factor_required"
  | "checkpoint"
  | "unknown"

export interface FacebookBlockDetection {
  blocked: boolean
  reason?: FacebookBlockReason
  message?: string
  recoverable: boolean
}

/**
 * Détecte si la page courante est bloquée
 */
export async function detectFacebookBlock(page: Page): Promise<FacebookBlockDetection> {
  try {
    const url = page.url()
    const title = await page.title().catch(() => "")
    const lowerTitle = title.toLowerCase()
    const lowerUrl = url.toLowerCase()

    // 1. Login wall — URL contient /login ou /?next= ou /login.php
    if (
      lowerUrl.includes("/login") ||
      lowerUrl.includes("login.php") ||
      lowerUrl.includes("?next=") ||
      lowerUrl.includes("/recover/") ||
      lowerTitle.includes("connexion ou inscription") ||
      lowerTitle.includes("log in or sign up")
    ) {
      return {
        blocked: true,
        reason: "login_required",
        message: "Facebook demande une connexion. Fournissez des cookies de session valides (c_user, xs).",
        recoverable: false, // nécessite cookies
      }
    }

    // 2. Checkpoint / bot detection
    if (
      lowerUrl.includes("/checkpoint") ||
      lowerUrl.includes("/security/") ||
      lowerTitle.includes("confirm your identity") ||
      lowerTitle.includes("vérification de sécurité") ||
      lowerTitle.includes("suspicious")
    ) {
      return {
        blocked: true,
        reason: "bot_detected",
        message: "Facebook a détecté un comportement suspect. Cookies invalides ou IP marquée.",
        recoverable: false,
      }
    }

    // 3. CAPTCHA
    if (lowerTitle.includes("captcha") || lowerUrl.includes("/captcha/")) {
      return {
        blocked: true,
        reason: "captcha",
        message: "CAPTCHA Facebook détecté",
        recoverable: false,
      }
    }

    // 4. 2FA demandé
    if (lowerUrl.includes("/two_factor") || lowerTitle.includes("two-factor")) {
      return {
        blocked: true,
        reason: "two_factor_required",
        message: "Authentification 2FA requise",
        recoverable: false,
      }
    }

    // 5. Vérifie le contenu de la page
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) || "").catch(() => "")
    const lowerBody = bodyText.toLowerCase()

    // Rate limit
    if (
      lowerBody.includes("temporarily blocked") ||
      lowerBody.includes("temporairement bloqué") ||
      lowerBody.includes("you've been temporarily blocked") ||
      lowerBody.includes("try again later")
    ) {
      return {
        blocked: true,
        reason: "rate_limited",
        message: "Facebook vous a temporairement bloqué. Attendez quelques heures.",
        recoverable: true, // backoff long
      }
    }

    // Page indisponible
    if (
      lowerBody.includes("this page isn't available") ||
      lowerBody.includes("cette page n'est pas disponible") ||
      lowerBody.includes("the link you followed may be broken") ||
      lowerBody.includes("page has been removed")
    ) {
      return {
        blocked: true,
        reason: "page_unavailable",
        message: "Page Facebook indisponible ou supprimée",
        recoverable: false,
      }
    }

    // 6. Consent RGPD — boutons "Accept" ou iframe
    const consentSelectors = [
      "button[data-cookiebanner='accept_button']",
      "button[name='accept_all']",
      "[data-sigil='cookies-disclaimer-accept']",
      "button:has-text('Autoriser les cookies essentiels')",
      "button:has-text('Allow essential cookies')",
      "button:has-text('Tout accepter')",
      "button:has-text('Accept all')",
    ]
    for (const sel of consentSelectors) {
      const el = await page.$(sel).catch(() => null)
      if (el) {
        return {
          blocked: true,
          reason: "consent_required",
          message: "Bannière de consentement cookies Facebook détectée",
          recoverable: true,
        }
      }
    }

    // 7. Login form détecté sur la page courante
    const loginForm = await page.$("input[name='email'], input[name='pass'], #login_form").catch(() => null)
    if (loginForm && !lowerUrl.includes("/about") && bodyText.length < 500) {
      return {
        blocked: true,
        reason: "login_required",
        message: "Formulaire de connexion Facebook affiché — cookies de session manquants ou expirés",
        recoverable: false,
      }
    }

    return { blocked: false, recoverable: false }
  } catch (err) {
    return {
      blocked: true,
      reason: "unknown",
      message: `Erreur détection: ${(err as Error).message}`,
      recoverable: true,
    }
  }
}

/**
 * Tente d'accepter la bannière de consentement Facebook
 */
export async function acceptFacebookConsent(page: Page): Promise<boolean> {
  const buttons = [
    "button[data-cookiebanner='accept_button']",
    "button[name='accept_all']",
    "[data-sigil='cookies-disclaimer-accept']",
    "button:has-text('Tout accepter')",
    "button:has-text('Accept all')",
    "button:has-text('Autoriser les cookies essentiels')",
  ]
  for (const sel of buttons) {
    try {
      const btn = page.locator(sel).first()
      if (await btn.isVisible({ timeout: 1500 })) {
        await btn.click({ timeout: 3000 })
        await page.waitForTimeout(2000)
        return true
      }
    } catch {
      // continue
    }
  }
  return false
}

/**
 * Erreur personnalisée pour blocage Facebook
 */
export class FacebookBlockError extends Error {
  constructor(
    public reason: FacebookBlockReason,
    message: string,
    public recoverable: boolean
  ) {
    super(message)
    this.name = "FacebookBlockError"
  }
}
