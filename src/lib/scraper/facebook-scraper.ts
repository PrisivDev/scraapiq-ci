/**
 * Moteur de scraping Facebook Pages — Playwright
 *
 * Architecture :
 *  1. Lance Chromium avec cookies de session Facebook (requis)
 *  2. Recherche des pages par mot-clé + localisation
 *     OU navigue directement vers une page fournie
 *  3. Pour chaque page, visite la sous-page /about/ pour extraire les coordonnées
 *  4. Extrait : nom, catégorie, téléphone, WhatsApp, Messenger, email, site, adresse,
 *     horaires, description, images, lien Google Maps
 *  5. Détecte login wall, consent, bot detection
 *  6. Déduplique via le module commun
 *
 * Utilise la version mobile m.facebook.com (plus légère, moins de JS, moins de bot detection)
 */

import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright"
import type {
  FacebookSearchQuery,
  FacebookScraperConfig,
  FacebookPlace,
  FacebookScrapeEvent,
  FacebookCookie,
} from "./facebook-types"
import { parseFacebookCookies, validateFacebookCookies } from "./facebook-types"
import { normalizePhone, normalizeEmail, normalizeUrl, parseGpsFromUrl } from "./normalize"
import { deduplicatePlaces } from "./dedup"
import { detectFacebookBlock, acceptFacebookConsent, FacebookBlockError } from "./facebook-block-detector"
import { RateLimiter, randomUserAgent, humanDelay, exponentialBackoff } from "./rate-limiter"
import type { ScrapeEvent, ScrapeResult, DayHours, Photo } from "./types"

// User-agents mobiles (m.facebook.com est plus tolérant)
const MOBILE_UAS = [
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
]

const FB_MOBILE_BASE = "https://m.facebook.com"
const FB_DESKTOP_BASE = "https://www.facebook.com"

interface ListedPage {
  name: string
  url: string
  category?: string
}

export class FacebookScraper {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private config: Required<FacebookScraperConfig>
  private listeners: ((event: FacebookScrapeEvent | ScrapeEvent) => void)[] = []
  private rateLimiter: RateLimiter
  private cancelled = false
  private cookies: FacebookCookie[] = []

  constructor(config: FacebookScraperConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      cookies: config.cookies ?? "",
      userAgent: config.userAgent ?? "",
      minDelay: config.minDelay ?? 1500,
      maxDelay: config.maxDelay ?? 3500,
      pageTimeout: config.pageTimeout ?? 30000,
      retries: config.retries ?? 2,
      backoffMs: config.backoffMs ?? 3000,
      extractImages: config.extractImages ?? true,
      maxImages: config.maxImages ?? 3,
      mobileVersion: config.mobileVersion ?? true,
    }
    this.rateLimiter = new RateLimiter(this.config.minDelay, 12) // FB est plus restrictif
    this.cookies = parseFacebookCookies(this.config.cookies)
  }

  on(listener: (event: FacebookScrapeEvent | ScrapeEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private emit(event: FacebookScrapeEvent | ScrapeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error("[fb-scraper] listener error:", err)
      }
    }
  }

  cancel(): void {
    this.cancelled = true
    this.emit({ type: "cancelled" })
  }

  /**
   * Lance un job de scraping Facebook
   */
  async scrape(jobId: string, query: FacebookSearchQuery): Promise<ScrapeResult> {
    const startedAt = new Date()
    this.cancelled = false
    let blocksEncountered = 0
    let retries = 0
    let pagesScraped = 0
    const errors: string[] = []

    this.emit({ type: "start", jobId, query: query as unknown as Record<string, unknown> } as ScrapeEvent)

    try {
      // 0. Validation des cookies
      if (this.cookies.length > 0) {
        const validation = validateFacebookCookies(this.cookies)
        if (!validation.valid) {
          this.emit({
            type: "fb-login-required",
            message: `Cookies Facebook essentiels manquants: ${validation.missing.join(", ")}`,
          } as FacebookScrapeEvent)
          this.emit({
            type: "error",
            message: `Cookies Facebook manquants: ${validation.missing.join(", ")}. Sans cookies d'authentification, Facebook redirige vers la page de connexion.`,
            recoverable: false,
          } as ScrapeEvent)
        }
      } else {
        this.emit({
          type: "fb-login-required",
          message: "Aucun cookie Facebook fourni. La plupart des pages nécessitent une authentification.",
        } as FacebookScrapeEvent)
      }

      // 1. Init navigateur
      await this.initBrowser()
      this.emit({ type: "progress", progress: 5, phase: "init" } as ScrapeEvent)

      const page = await this.context!.newPage()
      await this.configurePage(page)

      // 2. Si une pageUrl directe est fournie, on scrape cette page
      let pagesToScrape: ListedPage[] = []

      if (query.pageUrl) {
        // Page unique fournie
        const pageName = this.extractPageNameFromUrl(query.pageUrl)
        pagesToScrape = [{ name: pageName, url: query.pageUrl }]
        this.emit({
          type: "fb-search-loaded",
          resultsCount: 1,
        } as FacebookScrapeEvent)
      } else {
        // Recherche par mot-clé
        this.emit({ type: "progress", progress: 10, phase: "searching" } as ScrapeEvent)
        pagesToScrape = await this.searchPages(page, query)
        pagesScraped++

        if (pagesToScrape.length === 0) {
          throw new FacebookBlockError(
            "page_unavailable",
            "Aucune page trouvée. Facebook peut nécessiter des cookies de session ou la recherche ne retourne rien.",
            false
          )
        }

        this.emit({
          type: "fb-search-loaded",
          resultsCount: pagesToScrape.length,
        } as FacebookScrapeEvent)
      }

      this.emit({ type: "progress", progress: 25, phase: "listing" } as ScrapeEvent)

      // 3. Extraction détaillée de chaque page
      const places: FacebookPlace[] = []
      const total = Math.min(pagesToScrape.length, query.maxResults || 10)

      for (let i = 0; i < total && !this.cancelled; i++) {
        const pageInfo = pagesToScrape[i]
        try {
          this.emit({
            type: "progress",
            progress: 25 + Math.floor((i / total) * 65),
            phase: "extracting",
          } as ScrapeEvent)

          const place = await this.extractPageDetails(page, pageInfo)
          if (place) {
            places.push(place)
            this.emit({ type: "fb-extracted", place, index: i } as FacebookScrapeEvent)
          }
        } catch (err) {
          const msg = `Erreur extraction page ${pageInfo.name}: ${(err as Error).message}`
          errors.push(msg)
          this.emit({
            type: "fb-error",
            message: msg,
            pageUrl: pageInfo.url,
          } as FacebookScrapeEvent)
        }

        await humanDelay(this.config.minDelay, this.config.maxDelay)
      }

      // 4. Déduplication
      this.emit({ type: "progress", progress: 92, phase: "deduplicating" } as ScrapeEvent)
      const { unique, duplicates } = deduplicatePlaces(places)

      // 5. Finalisation
      const completedAt = new Date()
      this.emit({ type: "progress", progress: 100, phase: "done" } as ScrapeEvent)
      this.emit({
        type: "complete",
        results: unique,
        duplicates: duplicates.length,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      } as ScrapeEvent)

      return {
        jobId,
        query: query as unknown as Record<string, unknown>,
        status: this.cancelled ? "cancelled" : "completed",
        places: unique,
        duplicates,
        stats: {
          totalExtracted: places.length,
          uniqueCount: unique.length,
          duplicatesCount: duplicates.length,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          pagesScraped,
          blocksEncountered,
          retries,
        },
        errors,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
      }
    } catch (err) {
      const completedAt = new Date()
      errors.push((err as Error).message)
      this.emit({ type: "error", message: (err as Error).message, recoverable: false } as ScrapeEvent)

      return {
        jobId,
        query: query as unknown as Record<string, unknown>,
        status: "failed",
        places: [],
        duplicates: [],
        stats: {
          totalExtracted: 0,
          uniqueCount: 0,
          duplicatesCount: 0,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          pagesScraped,
          blocksEncountered,
          retries,
        },
        errors,
        startedAt: startedAt.toISOString(),
        completedAt: completedAt.toISOString(),
      }
    } finally {
      await this.closeBrowser()
    }
  }

  // ============================================================================
  // MÉTHODES PRIVÉES
  // ============================================================================

  private async initBrowser(): Promise<void> {
    const base = this.config.mobileVersion ? FB_MOBILE_BASE : FB_DESKTOP_BASE
    const isMobile = this.config.mobileVersion

    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        isMobile ? `--lang=fr-FR` : `--lang=fr-FR`,
      ],
    })

    this.context = await this.browser.newContext({
      viewport: isMobile
        ? { width: 412, height: 915 }
        : { width: 1440, height: 900 },
      userAgent: this.config.userAgent || (isMobile ? MOBILE_UAS[0] : randomUserAgent()),
      locale: "fr-FR",
      timezoneId: "Africa/Abidjan",
      isMobile,
      hasTouch: isMobile,
      extraHTTPHeaders: {
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
      },
    })

    // Stealth
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false })
      // Supprime les propriétés qui révèlent Playwright
      // Cast Record<string, unknown> makes `delete` type-safe — no @ts-expect-error needed
      delete (window as unknown as Record<string, unknown>).__playwright
      delete (window as unknown as Record<string, unknown>).__pw_manual
    })

    // Injecte les cookies de session Facebook si fournis
    if (this.cookies.length > 0) {
      const cookieObjects = this.cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        httpOnly: ["xs", "c_user", "datr", "fr"].includes(c.name),
        secure: true,
        sameSite: "Lax" as const,
      }))
      await this.context.addCookies(cookieObjects)
    }

    // Pré-charge Facebook pour valider les cookies
    const initPage = await this.context.newPage()
    try {
      await this.rateLimiter.waitForNextSlot()
      await initPage.goto(base, { waitUntil: "domcontentloaded", timeout: this.config.pageTimeout })
      await humanDelay(1000, 2000)

      // Accepte le consent si présent
      const block = await detectFacebookBlock(initPage)
      if (block.reason === "consent_required") {
        await acceptFacebookConsent(initPage)
        await humanDelay(1500, 2500)
      }
    } catch {
      // ignore — la suite gérera
    } finally {
      await initPage.close()
    }
  }

  private async configurePage(page: Page): Promise<void> {
    page.setDefaultTimeout(this.config.pageTimeout)

    // Bloque les ressources non essentielles
    await page.route("**/*", (route: Route) => {
      const type = route.request().resourceType()
      const url = route.request().url()

      if (["media", "font"].includes(type)) {
        return route.abort()
      }
      // Bloque ads et trackers
      if (
        url.includes("doubleclick.net") ||
        url.includes("google-analytics") ||
        url.includes("facebook.com/tr") ||
        url.includes("connect.facebook") ||
        url.includes("staticxx.facebook") ||
        url.includes("graph.facebook.com/v") // API GraphQL (sauf si nécessaire)
      ) {
        return route.abort()
      }
      return route.continue()
    })
  }

  private async closeBrowser(): Promise<void> {
    try {
      if (this.context) await this.context.close()
      if (this.browser) await this.browser.close()
    } catch {
      // ignore
    } finally {
      this.context = null
      this.browser = null
    }
  }

  /**
   * Extrait le nom de page depuis une URL Facebook
   * https://m.facebook.com/orangecotedivoire/about → "orangecotedivoire"
   * https://www.facebook.com/Orange-CI-12345 → "Orange-CI-12345"
   */
  private extractPageNameFromUrl(url: string): string {
    try {
      const u = new URL(url)
      const parts = u.pathname.split("/").filter(Boolean)
      return parts[0] || "page"
    } catch {
      return "page"
    }
  }

  /**
   * Recherche des pages Facebook par mot-clé + localisation
   * Utilise la page de recherche mobile : /search/pages/?q=...
   */
  private async searchPages(page: Page, query: FacebookSearchQuery): Promise<ListedPage[]> {
    const searchQuery = [query.keyword]
    if (query.neighborhood) searchQuery.push(query.neighborhood)
    if (query.commune) searchQuery.push(query.commune)
    if (query.city) searchQuery.push(query.city)
    if (query.country) searchQuery.push(query.country)
    const q = searchQuery.join(" ")

    const searchUrl = `${FB_MOBILE_BASE}/search/pages/?q=${encodeURIComponent(q)}&ref=content_filter&source=filter`

    let loaded = false
    for (let attempt = 0; attempt < this.config.retries && !loaded && !this.cancelled; attempt++) {
      try {
        await this.rateLimiter.waitForNextSlot()
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: this.config.pageTimeout })
        await humanDelay(2000, 3500)

        const block = await detectFacebookBlock(page)
        if (block.blocked) {
          if (block.reason === "consent_required" && block.recoverable) {
            await acceptFacebookConsent(page)
            await humanDelay(1500, 2500)
            continue
          }
          if (block.reason === "rate_limited" && block.recoverable) {
            this.emit({ type: "block-detected", reason: block.reason, retrying: true } as ScrapeEvent)
            await exponentialBackoff(attempt, this.config.backoffMs * 3)
            // NOTE: `retries` is not in scope here — the for-loop already increments `attempt`.
            continue
          }
          // Login required ou bot detected : non récupérable sans cookies
          throw new FacebookBlockError(block.reason!, block.message || "Blocked", block.recoverable)
        }

        loaded = true
      } catch (err) {
        if (err instanceof FacebookBlockError && !err.recoverable) throw err
        // NOTE: removed undefined `retries++` — the for-loop already increments `attempt`.
        if (attempt === this.config.retries - 1) throw err
        this.emit({
          type: "error",
          message: `Tentative ${attempt + 1} échouée: ${(err as Error).message}`,
          recoverable: true,
        } as ScrapeEvent)
        await exponentialBackoff(attempt, this.config.backoffMs)
      }
    }

    if (!loaded) {
      throw new Error("Impossible de charger la page de recherche Facebook")
    }

    // Parse les résultats de recherche
    return await this.parseSearchResults(page)
  }

  /**
   * Parse la page de résultats de recherche Facebook mobile
   */
  private async parseSearchResults(page: Page): Promise<ListedPage[]> {
    const results: ListedPage[] = []
    const seen = new Set<string>()

    // Plusieurs sélecteurs possibles pour les liens de pages dans les résultats de recherche
    const selectors = [
      'a[href*="/"][data-sigil*="page"]', // mobile data-sigil
      'a[href*="m.facebook.com/"]:not([href*="/login"]):not([href*="/search"])',
      'a[href^="/"]:not([href="/"]):not([href*="/login"]):not([href*="/search"])',
      'div[data-sigil*="pages-unit"] a',
      'div[role="article"] a[href*="facebook"]',
    ]

    for (const sel of selectors) {
      const links = await page.$$(sel).catch(() => [])
      for (const link of links) {
        if (results.length >= 30) break
        try {
          const href = await link.getAttribute("href") || ""
          if (!href) continue

          // Normalise l'URL
          let url = href
          if (url.startsWith("/")) url = FB_MOBILE_BASE + url
          if (!url.includes("facebook.com")) continue

          // Filtre les URLs non-page (login, search, help, etc.)
          const path = new URL(url).pathname
          if (
            path === "/" ||
            path.startsWith("/login") ||
            path.startsWith("/search") ||
            path.startsWith("/help") ||
            path.startsWith("/policies") ||
            path.startsWith("/settings") ||
            path.startsWith("/bookmarks") ||
            path.startsWith("/home.php") ||
            path.startsWith("/profile.php")
          ) {
            continue
          }

          // Extrait le nom de page du path
          const pageSlug = path.split("/").filter(Boolean)[0] || ""
          if (!pageSlug || seen.has(pageSlug)) continue
          seen.add(pageSlug)

          // Le texte du lien est souvent le nom de la page
          const name = (await link.textContent())?.trim() || pageSlug
          if (name.length < 2) continue

          results.push({
            name,
            url: `${FB_MOBILE_BASE}/${pageSlug}`,
            category: undefined,
          })
        } catch {
          // skip
        }
      }
      if (results.length >= 30) break
    }

    return results
  }

  /**
   * Extrait tous les détails d'une page Facebook
   * Navigue vers /about/ qui contient toutes les coordonnées
   */
  private async extractPageDetails(page: Page, pageInfo: ListedPage): Promise<FacebookPlace | null> {
    const place: FacebookPlace = {
      name: pageInfo.name,
      pageName: pageInfo.name,
      pageUrl: pageInfo.url,
      scrapedAt: new Date().toISOString(),
      sourceUrl: pageInfo.url,
    }

    try {
      // Construit l'URL /about/
      const aboutUrl = this.buildAboutUrl(pageInfo.url)

      await this.rateLimiter.waitForNextSlot()
      await page.goto(aboutUrl, { waitUntil: "domcontentloaded", timeout: this.config.pageTimeout })

      // Vérifie les blocages
      const block = await detectFacebookBlock(page)
      if (block.blocked) {
        if (block.reason === "consent_required") {
          await acceptFacebookConsent(page)
          await humanDelay(1500, 2500)
        } else {
          this.emit({
            type: "fb-error",
            message: `Page ${pageInfo.name} bloquée: ${block.message}`,
            pageUrl: aboutUrl,
          } as FacebookScrapeEvent)
          return null
        }
      }

      // Attend le rendu
      await humanDelay(2500, 4000)

      this.emit({
        type: "fb-page-loaded",
        pageUrl: aboutUrl,
        pageName: pageInfo.name,
      } as FacebookScrapeEvent)

      // Extraction via evaluate
      const extracted = await page.evaluate((maxImages) => {
        const result: Record<string, unknown> = {}
        const bodyText = document.body?.innerText || ""

        // Nom de la page — h1 ou titre header
        const nameEl = document.querySelector("h1, header strong, [data-sigil='profile-name']") as HTMLElement | null
        result.name = nameEl?.textContent?.trim() || undefined

        // Catégorie — souvent sous le nom, dans un élément spécifique
        const catSelectors = [
          "[data-sigil='profile-category']",
          "header + * [data-sigil]",
          "div[role='heading'][aria-level='2']",
          ".category",
        ]
        for (const sel of catSelectors) {
          const el = document.querySelector(sel) as HTMLElement | null
          if (el && el.textContent && el.textContent.trim().length > 2) {
            result.category = el.textContent.trim()
            break
          }
        }

        // Vérifié (badge bleu)
        const verified = document.querySelector("[data-sigil='verified-badge'], .verified-badge, svg[aria-label*='érifié']")
        result.isVerified = !!verified

        // Likes / followers — cherche des patterns numériques
        const likesMatch = bodyText.match(/(\d[\d\s.,]*[kKmM]?)\s*(?:j'aime|likes|likes\b)/i)
        if (likesMatch) result.likesText = likesMatch[1]
        const followersMatch = bodyText.match(/(\d[\d\s.,]*[kKmM]?)\s*(?:abonnés|followers)/i)
        if (followersMatch) result.followersText = followersMatch[1]

        // Description / bio — section "À propos"
        const aboutSelectors = [
          "[data-sigil='profile-description']",
          "[data-sigil='profile-bio']",
          "div[role='article']",
          ".bio",
        ]
        for (const sel of aboutSelectors) {
          const el = document.querySelector(sel) as HTMLElement | null
          if (el && el.textContent && el.textContent.trim().length > 20) {
            result.description = el.textContent.trim().slice(0, 1000)
            break
          }
        }
        // Fallback : premier paragraphe long
        if (!result.description) {
          const paras = document.querySelectorAll("p, div[data-sigil]")
          for (const p of paras) {
            const t = (p as HTMLElement).textContent?.trim() || ""
            if (t.length > 50 && !t.includes("Connexion") && !t.includes("cookies")) {
              result.description = t.slice(0, 1000)
              break
            }
          }
        }

        // ===== COORDONNÉES (extraction par label, plus robuste) =====
        // Facebook organise les infos par sections avec des labels
        // On cherche les labels connus et on prend le texte adjacent

        const findFieldAfterLabel = (labels: string[]): string | undefined => {
          for (const label of labels) {
            // Cherche un élément contenant ce label
            const allEls = document.querySelectorAll("*")
            for (const el of allEls) {
              const text = (el as HTMLElement).textContent?.trim() || ""
              if (text === label || text.startsWith(label)) {
                // Le contenu est dans le frère suivant ou l'enfant suivant
                const next = el.nextElementSibling as HTMLElement | null
                if (next && next.textContent) {
                  const v = next.textContent.trim()
                  if (v && v !== label && v.length < 200) return v
                }
                // Ou dans le parent suivant
                const parent = el.parentElement?.nextElementSibling as HTMLElement | null
                if (parent && parent.textContent) {
                  const v = parent.textContent.trim()
                  if (v && v !== label && v.length < 200) return v
                }
              }
            }
          }
          return undefined
        }

        // Téléphone
        result.phone = findFieldAfterLabel(["Téléphone", "Phone", "Numéro de téléphone", "Mobile"])

        // WhatsApp — souvent mentionné dans le contenu
        const whatsappMatch = bodyText.match(/(?:WhatsApp|whatsapp)[:\s]*\+?(\d[\d\s-]{6,})/i)
        if (whatsappMatch) result.whatsapp = "+" + whatsappMatch[1].replace(/[^\d]/g, "")
        // Ou un numéro ivoirien mentionné près du mot WhatsApp
        const whatsappIvorian = bodyText.match(/whatsapp[^+]*\+?(225[\d\s]{10,})/i)
        if (whatsappIvorian) result.whatsapp = "+" + whatsappIvorian[1].replace(/[^\d]/g, "")

        // Email — regex sur le body
        const emailMatch = bodyText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i)
        if (emailMatch) result.email = emailMatch[0]

        // Site web — lien externe (pas facebook.com)
        const externalLinks = document.querySelectorAll("a[href]")
        for (const a of externalLinks) {
          const href = (a as HTMLAnchorElement).href || ""
          if (
            href &&
            !href.includes("facebook.com") &&
            !href.includes("fb.me") &&
            !href.includes("m.me") &&
            !href.includes("wa.me") &&
            !href.includes("mailto:") &&
            !href.includes("tel:") &&
            (href.startsWith("http://") || href.startsWith("https://"))
          ) {
            result.website = href
            result.websiteText = (a as HTMLAnchorElement).textContent?.trim() || undefined
            break
          }
        }
        // Fallback : cherche un domaine dans le texte
        if (!result.website) {
          const siteMatch = bodyText.match(/(?:Site web|Website|Site)[:\s]*(https?:\/\/[^\s,]+)/i)
          if (siteMatch) result.website = siteMatch[1]
        }

        // Adresse
        result.address = findFieldAfterLabel(["Adresse", "Address", "Localisation", "Location", "Quartier"])

        // Horaires
        result.hoursText = findFieldAfterLabel(["Horaires", "Hours", "Heures d'ouverture", "Ouvert"])

        // ===== IMAGES =====
        if (maxImages > 0) {
          const imgEls = document.querySelectorAll("img[src]")
          const images: Array<{ url: string; alt?: string }> = []
          for (const el of imgEls) {
            if (images.length >= maxImages) break
            const img = el as HTMLImageElement
            if (
              img.src &&
              (img.src.includes("fbcdn") || img.src.includes("scontent")) &&
              img.naturalWidth > 50
            ) {
              images.push({ url: img.src, alt: img.alt })
            }
          }
          result.images = images
        }

        // Facebook ID — depuis l'URL ou les data
        const url = window.location.href
        const idMatch = url.match(/facebook\.com\/(?:profile\.php\?id=)?(\d{5,})/)
        if (idMatch) result.facebookId = idMatch[1]

        // Messenger — construit depuis le slug ou l'ID
        const slugMatch = url.match(/facebook\.com\/([^/?#]+)/)
        if (slugMatch && slugMatch[1] !== "profile.php") {
          result.messenger = `https://m.me/${slugMatch[1]}`
        } else if (result.facebookId) {
          result.messenger = `https://m.me/${result.facebookId}`
        }

        return result
      }, this.config.maxImages).catch(() => ({}))

      // Mapping vers l'objet FacebookPlace
      if (extracted.name) place.name = extracted.name as string
      place.pageName = (extracted.name as string) || pageInfo.name
      place.category = extracted.category as string | undefined
      place.description = extracted.description as string | undefined
      place.isVerified = extracted.isVerified as boolean | undefined
      place.phone = extracted.phone as string | undefined
      if (place.phone) place.phoneNormalized = normalizePhone(place.phone) || undefined
      place.whatsapp = extracted.whatsapp as string | undefined
      if (place.whatsapp) {
        const norm = normalizePhone(place.whatsapp)
        if (norm) place.whatsapp = norm
      }
      if (extracted.email) {
        const email = normalizeEmail(extracted.email as string)
        if (email) place.email = email
      }
      if (extracted.website) {
        place.website = normalizeUrl(extracted.website as string) || undefined
      }
      place.address = extracted.address as string | undefined
      if (extracted.hoursText) {
        place.hours = parseFacebookHours(extracted.hoursText as string)
      }
      if (extracted.images && Array.isArray(extracted.images)) {
        place.photos = (extracted.images as Array<{ url: string; alt?: string }>).map((p) => ({
          url: p.url,
          alt: p.alt,
        })) as Photo[]
      }
      place.messenger = extracted.messenger as string | undefined
      place.facebookId = extracted.facebookId as string | undefined

      // Likes / followers
      if (extracted.likesText) {
        place.likesCount = parseCount(extracted.likesText as string)
      }
      if (extracted.followersText) {
        place.followersCount = parseCount(extracted.followersText as string)
      }

      // Construit le lien Google Maps depuis l'adresse
      if (place.address) {
        place.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${place.name} ${place.address}`
        )}`
      } else if (place.name) {
        // Fallback : recherche par nom + localisation
        const loc = [place.name]
        if (query_keywords_locality) loc.push(query_keywords_locality)
        place.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc.join(" "))}`
      }

      return place
    } catch (err) {
      this.emit({
        type: "fb-error",
        message: `Erreur extraction ${pageInfo.name}: ${(err as Error).message}`,
        pageUrl: pageInfo.url,
      } as FacebookScrapeEvent)
      return null
    }
  }

  /** Construit l'URL /about/ d'une page Facebook */
  private buildAboutUrl(pageUrl: string): string {
    try {
      const u = new URL(pageUrl)
      const parts = u.pathname.split("/").filter(Boolean)
      const slug = parts[0] || ""
      const base = this.config.mobileVersion ? FB_MOBILE_BASE : FB_DESKTOP_BASE
      return `${base}/${slug}/about/`
    } catch {
      // Si URL invalide, retourne telle quelle
      return pageUrl.endsWith("/about/") ? pageUrl : pageUrl + "/about/"
    }
  }
}

// Variable pour passer la localité au moment de l'extraction
// (contournement : l'evaluate ne peut pas capturer la closure complète)
let query_keywords_locality = ""

/**
 * Setter pour la localité courante (utilisé par scrape())
 */
export function setSearchLocality(locality: string): void {
  query_keywords_locality = locality
}

// ============================================================================
// HELPERS
// ============================================================================

/** Parse un texte d'horaires Facebook en DayHours[] */
function parseFacebookHours(text: string): DayHours[] {
  if (!text) return []
  const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
  const result: DayHours[] = []
  const regex = new RegExp(`(${days.join("|")})[\\.\\s:]+([^\\n]+?)(?=(?:${days.join("|")})|$)`, "gi")
  let match
  while ((match = regex.exec(text)) !== null) {
    result.push({ day: match[1], hours: match[2].trim() })
  }
  if (result.length === 0 && text.length > 0) {
    result.push({ day: "Aujourd'hui", hours: text.slice(0, 100) })
  }
  return result
}

/** Parse un compteur "1,2 k" ou "12345" ou "1,2M" en nombre */
function parseCount(text: string): number {
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
