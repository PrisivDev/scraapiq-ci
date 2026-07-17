/**
 * Détecteur de blocages spécifiques à LinkedIn
 *
 * LinkedIn bloque agressivement :
 *  1. Auth wall — "Join now" / "S'inscrire" page
 *  2. Login wall — page de connexion
 *  3. CAPTCHA / security check — "Vérification de sécurité"
 *  4. Rate limit — "You've viewed a lot of pages"
 *  5. Page inexistante — "This page doesn't exist"
 *  6. Bot detection — challenge Intuitionism
 *  7. Restricted profile
 *  8. Sales Navigator lock
 */

import type { Page } from "playwright"

export type LinkedInBlockReason =
  | "auth_required"
  | "login_required"
  | "captcha"
  | "rate_limited"
  | "page_not_found"
  | "bot_detected"
  | "restricted"
  | "unknown"

export interface LinkedInBlockDetection {
  blocked: boolean
  reason?: LinkedInBlockReason
  message?: string
  recoverable: boolean
}

export async function detectLinkedInBlock(page: Page): Promise<LinkedInBlockDetection> {
  try {
    const url = page.url()
    const title = await page.title().catch(() => "")
    const lowerTitle = title.toLowerCase()
    const lowerUrl = url.toLowerCase()

    // 1. Auth wall / login — titre "S'inscrire | LinkedIn" ou "Sign Up | LinkedIn"
    if (
      lowerTitle.includes("s'inscrire") ||
      lowerTitle.includes("sign up") ||
      lowerTitle.includes("sign in") ||
      lowerTitle.includes("se connecter") ||
      lowerTitle.includes("join now")
    ) {
      return {
        blocked: true,
        reason: "auth_required",
        message: "LinkedIn demande une inscription/connexion. Fournissez des cookies (li_at) pour accéder.",
        recoverable: false,
      }
    }

    // 2. URL d'auth
    if (
      lowerUrl.includes("/login") ||
      lowerUrl.includes("/signup") ||
      lowerUrl.includes("/authwall") ||
      lowerUrl.includes("/checkpoint")
    ) {
      return {
        blocked: true,
        reason: "auth_required",
        message: "Page d'authentification LinkedIn. Cookies requis (li_at).",
        recoverable: false,
      }
    }

    // 3. CAPTCHA / security check
    if (
      lowerTitle.includes("vérification de sécurité") ||
      lowerTitle.includes("security verification") ||
      lowerTitle.includes("captcha")
    ) {
      return {
        blocked: true,
        reason: "captcha",
        message: "Vérification de sécurité LinkedIn (CAPTCHA).",
        recoverable: false,
      }
    }

    // 4. Page inexistante
    if (
      lowerTitle.includes("page not found") ||
      lowerTitle.includes("page introuvable") ||
      lowerTitle.includes("doesn't exist")
    ) {
      return {
        blocked: true,
        reason: "page_not_found",
        message: "Page LinkedIn introuvable. Le slug est peut-être incorrect.",
        recoverable: false,
      }
    }

    // 5. Vérifie le contenu
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 1500) || "").catch(() => "")
    const lowerBody = bodyText.toLowerCase()

    // Rate limit
    if (
      lowerBody.includes("you've viewed") ||
      lowerBody.includes("vous avez consulté") ||
      lowerBody.includes("try again later") ||
      lowerBody.includes("temporarily restricted")
    ) {
      return {
        blocked: true,
        reason: "rate_limited",
        message: "LinkedIn restreint temporairement l'accès. Attendez quelques minutes.",
        recoverable: true,
      }
    }

    // Restricted
    if (lowerBody.includes("restricted") || lowerBody.includes("restreint")) {
      return {
        blocked: true,
        reason: "restricted",
        message: "Profil/page restreint par LinkedIn",
        recoverable: false,
      }
    }

    // 6. Vérifie qu'il y a du contenu (sinon = page blanche = bloqué)
    // Important : LinkedIn a TOUJOURS un login form dans le header, même sur les pages publiques
    // des grandes entreprises. On ne déclenche login_required QUE si la page est quasi vide.
    if (bodyText.length < 500 && !lowerUrl.includes("/search/")) {
      // Soit auth wall sans titre clair, soit page vide
      const hasLoginForm = await page.$("input[name='session_key'], input[name='session_password'], #session_key").catch(() => null)
      if (hasLoginForm) {
        return {
          blocked: true,
          reason: "login_required",
          message: "Formulaire de connexion LinkedIn affiché (page vide)",
          recoverable: false,
        }
      }
    }

    // 7. Vérifie qu'il y a bien un h1 (nom d'entreprise) — sinon c'est probablement bloqué
    const hasH1 = await page.$("h1").catch(() => null)
    if (!hasH1 && bodyText.length < 1000) {
      return {
        blocked: true,
        reason: "unknown",
        message: "Page LinkedIn sans contenu principal — probablement auth wall",
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

export class LinkedInBlockError extends Error {
  constructor(
    public reason: LinkedInBlockReason,
    message: string,
    public recoverable: boolean
  ) {
    super(message)
    this.name = "LinkedInBlockError"
  }
}
