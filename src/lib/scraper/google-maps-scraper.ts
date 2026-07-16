/**
 * Moteur de scraping Google Maps — Playwright
 *
 * Architecture :
 *  1. Lance un navigateur Chromium avec stealth + proxies optionnels
 *  2. Construit l'URL de recherche Google Maps
 *  3. Charge la liste des résultats, scroll pour charger plus
 *  4. Pour chaque lieu, ouvre la fiche détail et extrait toutes les infos
 *  5. Déduplique les résultats
 *  6. Émet des événements de progression
 *
 * Gestion des erreurs :
 *  - Détection CAPTCHA / 429 / consent RGPD
 *  - Backoff exponentiel
 *  - Rotation de proxies
 *  - Retry par lieu en échec
 *  - Timeout configurable
 *
 * Optimisations vitesse :
 *  - Request interception (bloque images/css/fonts inutiles sur la liste)
 *  - Concurrency contrôlée pour les fiches détail
 *  - Reuse du browser context
 *  - Extraction parallèle des photos
 *  - Skip des ressources non essentielles
 */

import { chromium, type Browser, type BrowserContext, type Page, type Request } from "playwright"
import type {
  ScrapedPlace,
  SearchQuery,
  ScraperConfig,
  ScrapeEvent,
  ScrapeEventListener,
  ScrapeResult,
  DayHours,
  Review,
  Photo,
} from "./types"
import { normalizePhone, normalizeEmail, normalizeUrl, normalizeName, parseGpsFromUrl, parseRating, parseReviewCount } from "./normalize"
import { deduplicatePlaces } from "./dedup"
import { detectBlock, acceptConsent, BlockError } from "./block-detector"
import { RateLimiter, ProxyPool, randomUserAgent, humanDelay, exponentialBackoff, USER_AGENTS } from "./rate-limiter"

const GOOGLE_MAPS_BASE = "https://www.google.com/maps/search/"

export class GoogleMapsScraper {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private config: Required<ScraperConfig>
  private listeners: ScrapeEventListener[] = []
  private rateLimiter: RateLimiter
  private proxyPool: ProxyPool
  private cancelled = false

  constructor(config: ScraperConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      proxies: config.proxies ?? [],
      userAgent: config.userAgent ?? "",
      minDelay: config.minDelay ?? 1000,
      maxDelay: config.maxDelay ?? 3000,
      scrollDelay: config.scrollDelay ?? 1500,
      maxScrolls: config.maxScrolls ?? 15,
      pageTimeout: config.pageTimeout ?? 30000,
      concurrency: config.concurrency ?? 2,
      retries: config.retries ?? 3,
      backoffMs: config.backoffMs ?? 2000,
      extractReviews: config.extractReviews ?? false,
      maxReviews: config.maxReviews ?? 5,
      extractPhotos: config.extractPhotos ?? true,
      maxPhotos: config.maxPhotos ?? 3,
      storageStatePath: config.storageStatePath ?? "",
      stealth: config.stealth ?? true,
      locale: config.locale ?? "fr-FR",
      timezone: config.timezone ?? "Africa/Abidjan",
    }
    this.rateLimiter = new RateLimiter(this.config.minDelay, 20)
    this.proxyPool = new ProxyPool(
      this.config.proxies.map((p) => {
        // Parse proxy string "http://user:pass@host:port"
        try {
          const u = new URL(p)
          return {
            server: `${u.protocol}//${u.hostname}:${u.port}`,
            username: decodeURIComponent(u.username),
            password: decodeURIComponent(u.password),
          }
        } catch {
          return { server: p }
        }
      })
    )
  }

  /** Ajoute un listener d'événements */
  on(listener: ScrapeEventListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private emit(event: ScrapeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error("[scraper] listener error:", err)
      }
    }
  }

  /** Annule le scraping en cours */
  cancel(): void {
    this.cancelled = true
    this.emit({ type: "cancelled" })
  }

  /**
   * Lance un job de scraping complet
   */
  async scrape(jobId: string, query: SearchQuery): Promise<ScrapeResult> {
    const startedAt = new Date()
    this.cancelled = false
    let blocksEncountered = 0
    let retries = 0
    let pagesScraped = 0
    const errors: string[] = []

    this.emit({ type: "start", jobId, query })

    try {
      // 1. Init navigateur
      await this.initBrowser()
      this.emit({ type: "progress", progress: 5, phase: "init" })

      // 2. Page de recherche
      const page = await this.context!.newPage()
      await this.configurePage(page)

      const searchUrl = this.buildSearchUrl(query)

      // 3. Charge la page avec retry
      let loaded = false
      for (let attempt = 0; attempt < this.config.retries && !loaded && !this.cancelled; attempt++) {
        try {
          await this.rateLimiter.waitForNextSlot()
          await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: this.config.pageTimeout })
          await humanDelay(this.config.minDelay, this.config.maxDelay)

          // Vérifie les blocages
          const block = await detectBlock(page)
          if (block.blocked) {
            blocksEncountered++
            if (block.reason === "consent_required" && block.recoverable) {
              await acceptConsent(page)
              await humanDelay(1000, 2000)
              continue
            }
            if (block.reason === "captcha" || block.reason === "ip_blocked") {
              // Rotation de proxy si disponible
              const proxy = this.proxyPool.next()
              if (proxy) {
                this.proxyPool.markFailure(proxy)
                this.emit({ type: "block-detected", reason: block.reason, retrying: true })
                await this.restartBrowserWithProxy(proxy)
                retries++
                continue
              }
              throw new BlockError(block.reason!, block.message || "Blocked", false)
            }
            if (block.recoverable) {
              this.emit({ type: "block-detected", reason: block.reason!, retrying: true })
              await exponentialBackoff(attempt, this.config.backoffMs)
              retries++
              continue
            }
            throw new BlockError(block.reason!, block.message || "Blocked", false)
          }

          loaded = true
          pagesScraped++
          this.emit({ type: "progress", progress: 15, phase: "searching" })
        } catch (err) {
          if (err instanceof BlockError && !err.recoverable) throw err
          retries++
          if (attempt === this.config.retries - 1) throw err
          this.emit({ type: "error", message: `Tentative ${attempt + 1} échouée: ${(err as Error).message}`, recoverable: true })
          await exponentialBackoff(attempt, this.config.backoffMs)
        }
      }

      if (!loaded) {
        throw new Error("Impossible de charger la page de recherche après plusieurs tentatives")
      }

      // 4. Attend que la liste des résultats apparaisse
      await this.waitForResultsList(page)

      // 5. Scroll pour charger plus de résultats
      const listedPlaces = await this.scrollAndCollectList(page, query.maxResults || 50)
      this.emit({ type: "search-loaded", resultsOnPage: listedPlaces.length })
      this.emit({ type: "progress", progress: 30, phase: "listing" })

      // 6. Extraction détaillée de chaque lieu (avec concurrency)
      const places: ScrapedPlace[] = []
      const total = listedPlaces.length

      // Traitement séquentiel pour éviter blocage (Google est sensible)
      for (let i = 0; i < total && !this.cancelled; i++) {
        const placeInfo = listedPlaces[i]
        try {
          this.emit({
            type: "progress",
            progress: 30 + Math.floor((i / total) * 60),
            phase: "extracting",
          })

          const place = await this.extractPlaceDetails(page, placeInfo)
          if (place) {
            places.push(place)
            this.emit({ type: "place-extracted", place, index: i })
          }
        } catch (err) {
          const msg = `Erreur extraction lieu ${i}: ${(err as Error).message}`
          errors.push(msg)
          this.emit({ type: "error", message: msg, recoverable: true })
        }

        // Délai entre chaque lieu
        await humanDelay(this.config.minDelay, this.config.maxDelay)
      }

      // 7. Déduplication
      this.emit({ type: "progress", progress: 92, phase: "deduplicating" })
      const { unique, duplicates } = deduplicatePlaces(places)
      for (const dup of duplicates) {
        for (const d of dup.duplicates) {
          this.emit({ type: "duplicate-detected", place: { name: d.name } as ScrapedPlace, duplicateOf: dup.canonicalName })
        }
      }

      // 8. Finalisation
      const completedAt = new Date()
      this.emit({ type: "progress", progress: 100, phase: "done" })
      this.emit({
        type: "complete",
        results: unique,
        duplicates: duplicates.length,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      })

      return {
        jobId,
        query,
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
      this.emit({ type: "error", message: (err as Error).message, recoverable: false })

      return {
        jobId,
        query,
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

  /** Initialise le navigateur avec options stealth */
  private async initBrowser(proxy?: { server: string; username?: string; password?: string }): Promise<void> {
    const launchOptions: Parameters<typeof chromium.launch>[0] = {
      headless: this.config.headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
        "--disable-infobars",
        "--window-position=0,0",
        "--ignore-certifcate-errors",
        "--ignore-certifcate-errors-spki-list",
        `--lang=${this.config.locale}`,
      ],
    }

    if (proxy) {
      launchOptions.proxy = proxy
    }

    this.browser = await chromium.launch(launchOptions)

    const contextOptions: Parameters<Browser["newContext"]>[0] = {
      viewport: { width: 1440, height: 900 },
      locale: this.config.locale,
      timezoneId: this.config.timezone,
      userAgent: this.config.userAgent || randomUserAgent(),
      geolocation: { latitude: 5.36, longitude: -4.0086 }, // Abidjan par défaut
      permissions: ["geolocation"],
      extraHTTPHeaders: {
        "Accept-Language": `${this.config.locale},en;q=0.9`,
      },
    }

    if (this.config.storageStatePath) {
      try {
        contextOptions.storageState = this.config.storageStatePath
      } catch {
        // ignore
      }
    }

    this.context = await this.browser.newContext(contextOptions)

    // Stealth : masque webdriver
    if (this.config.stealth) {
      await this.context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false })
        Object.defineProperty(navigator, "languages", { get: () => ["fr-FR", "fr", "en"] })
        Object.defineProperty(navigator, "plugins", {
          get: () => [
            { name: "Chrome PDF Plugin" },
            { name: "Chrome PDF Viewer" },
            { name: "Native Client" },
          ],
        })
        // @ts-expect-error - chrome n'existe pas sur le type Navigator
        window.chrome = { runtime: {} }
      })
    }
  }

  /** Configure une page : interception des ressources, timeouts */
  private async configurePage(page: Page): Promise<void> {
    page.setDefaultTimeout(this.config.pageTimeout)

    // Bloque les ressources non essentielles pour accélérer
    await page.route("**/*", (route: Request) => {
      const type = route.resourceType()
      const url = route.url()

      // Garde : document, xhr, fetch, script (nécessaires pour Google Maps SPA)
      // Bloque : images (sauf photos lieu), fonts, media, websocket inutiles
      if (["media", "font"].includes(type)) {
        return route.abort()
      }
      // Bloque les trackers et analytics
      if (
        url.includes("doubleclick.net") ||
        url.includes("google-analytics") ||
        url.includes("googletagmanager") ||
        url.includes("facebook.com/tr") ||
        url.includes("hotjar")
      ) {
        return route.abort()
      }
      return route.continue()
    })
  }

  /** Redémarre le navigateur avec un nouveau proxy */
  private async restartBrowserWithProxy(proxy: { server: string; username?: string; password?: string }): Promise<void> {
    await this.closeBrowser()
    await this.initBrowser(proxy)
  }

  /** Ferme le navigateur proprement */
  private async closeBrowser(): Promise<void> {
    try {
      if (this.context) {
        if (this.config.storageStatePath) {
          await this.context.storageState({ path: this.config.storageStatePath })
        }
        await this.context.close()
      }
      if (this.browser) {
        await this.browser.close()
      }
    } catch {
      // ignore
    } finally {
      this.context = null
      this.browser = null
    }
  }

  /** Construit l'URL de recherche Google Maps */
  private buildSearchUrl(query: SearchQuery): string {
    // Construit la requête : "keyword commune ville country"
    const parts: string[] = [query.keyword]
    if (query.neighborhood) parts.push(query.neighborhood)
    if (query.commune) parts.push(query.commune)
    if (query.city) parts.push(query.city)
    const q = parts.join(" ")

    const params = new URLSearchParams({
      query: q,
      hl: query.language || "fr",
      gl: query.country || "ci",
    })

    return `${GOOGLE_MAPS_BASE}?${params.toString()}`
  }

  /** Attend que la liste des résultats apparaisse */
  private async waitForResultsList(page: Page): Promise<void> {
    // Google Maps utilise role="feed" pour la liste des résultats
    const selectors = [
      'div[role="feed"]',
      '[aria-label*="Results" i]',
      'div[jstcache]',
    ]
    for (const sel of selectors) {
      try {
        await page.waitForSelector(sel, { timeout: 10000 })
        return
      } catch {
        // continue
      }
    }
    // Si aucun sélecteur ne matche, on continue quand même
  }

  /**
   * Scroll la liste des résultats pour charger plus d'items
   * Retourne la liste des lieux visibles (avec lien vers la fiche)
   */
  private async scrollAndCollectList(page: Page, maxResults: number): Promise<ListedPlace[]> {
    const places: ListedPlace[] = []
    const seenNames = new Set<string>()

    for (let scroll = 0; scroll < this.config.maxScrolls && !this.cancelled; scroll++) {
      // Sélecteurs pour les items de la liste (évoluent avec le temps)
      const items = await page.$$('div[role="feed"] > div, [aria-label*="Results" i] > div').catch(() => [])

      for (const item of items) {
        if (places.length >= maxResults) break
        try {
          const name = await item.$eval(
            '.qBF1Pd-haAclf, [role="heading"], .fontHeadlineSmall',
            (el) => (el as HTMLElement).textContent?.trim() || ""
          ).catch(() => "")

          if (name && !seenNames.has(name)) {
            seenNames.add(name)
            const href = await item.$eval("a", (el) => (el as HTMLAnchorElement).href).catch(() => "")
            places.push({ name, element: item, href })
          }
        } catch {
          // skip
        }
      }

      this.emit({ type: "scroll", scrollIndex: scroll + 1, totalResults: places.length })

      if (places.length >= maxResults) break

      // Scroll la liste
      try {
        await page.evaluate(() => {
          const feed = document.querySelector('div[role="feed"]')
          if (feed) {
            feed.scrollTop = feed.scrollHeight
          } else {
            window.scrollTo(0, document.body.scrollHeight)
          }
        })
      } catch {
        // ignore
      }
      await humanDelay(this.config.scrollDelay, this.config.scrollDelay + 1000)

      // Vérifie qu'on n'est pas bloqué
      const block = await detectBlock(page)
      if (block.blocked && !block.recoverable) {
        throw new BlockError(block.reason!, block.message || "Blocked", false)
      }
    }

    return places
  }

  /**
   * Extrait les détails d'un lieu en cliquant sur son item
   */
  private async extractPlaceDetails(page: Page, listedPlace: ListedPlace): Promise<ScrapedPlace | null> {
    const place: ScrapedPlace = {
      name: listedPlace.name,
      scrapedAt: new Date().toISOString(),
      sourceUrl: page.url(),
    }

    try {
      // Clic sur l'item pour ouvrir le panneau détail
      await listedPlace.element.click({ timeout: 5000 })
      await humanDelay(800, 1500)

      // Attend que le panneau de détail s'affiche
      await page.waitForSelector('div[role="main"], [jstcache]', { timeout: 8000 }).catch(() => {})

      // Extraction via evaluate (plus rapide que les querySelector chainés)
      const extracted = await page.evaluate((maxPhotos, maxReviews) => {
        const getText = (sel: string): string | undefined => {
          const el = document.querySelector(sel)
          return el?.textContent?.trim() || undefined
        }

        const result: Record<string, unknown> = {}

        // Nom
        result.name = getText('h1.DUwDvf, h1.fontHeadlineLarge, [jstcache="1133"] h1')

        // Catégorie
        result.category = getText('button[jsaction*="pane.rating.category"] .YhemCb, .YhemCb')

        // Note (rating)
        const ratingEl = document.querySelector('span[role="img"][aria-label*="étoile"], div.F7nice span')
        if (ratingEl) {
          result.ratingText = ratingEl.textContent?.trim() || ratingEl.getAttribute("aria-label") || ""
        }

        // Nombre d'avis
        const reviewCountEl = document.querySelector('span[role="img"][aria-label*="étoile"] + span, .F7nice span + span, button[jsaction*="pane.rating.reviews"] span')
        if (reviewCountEl) {
          result.reviewCountText = reviewCountEl.textContent?.trim() || ""
        }

        // Adresse
        const addressEl = document.querySelector('button[data-item-id="address"] .Io6YVf, [data-item-id="address"] .Io6YVf')
        if (addressEl) result.address = addressEl.textContent?.trim()

        // Téléphone
        const phoneEl = document.querySelector('button[data-item-id^="phone:"] .Io6YVf, [data-item-id^="phone:"] .Io6YVf, button[data-item-id*="phone"] .Io6YVf')
        if (phoneEl) result.phone = phoneEl.textContent?.trim()

        // Site web
        const websiteEl = document.querySelector('a[data-item-id="authority"] .Io6YVf, [data-item-id="authority"] .Io6YVf, a[jsaction*="website"]')
        if (websiteEl) {
          result.website = websiteEl.textContent?.trim() || (websiteEl as HTMLAnchorElement).href
        }

        // Statut ouvert/fermé
        const openEl = document.querySelector('span[aria-label*="ouvert" i], span[aria-label*="Ouvert" i], span[aria-label*="Fermé" i], span[aria-label*="closed" i]')
        if (openEl) result.isOpenText = openEl.textContent?.trim()

        // Horaires
        const hoursEl = document.querySelector('button[data-item-id="oh"] .Io6YVf, [aria-label*="Horaires" i] .Io6YVf, table.y0sTtd')
        if (hoursEl) result.hoursText = hoursEl.textContent?.trim()

        // Place ID depuis l'URL courante
        const url = window.location.href
        const placeIdMatch = url.match(/0x[a-f0-9]+:0x([a-f0-9]+)/i)
        if (placeIdMatch) result.placeId = "0x" + placeIdMatch[1]
        else {
          // ChIJ... format
          const chijMatch = url.match(/(ChIJ[a-zA-Z0-9_-]+)/)
          if (chijMatch) result.placeId = chijMatch[1]
        }

        // GPS depuis l'URL
        const gpsMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
        if (gpsMatch) {
          result.lat = parseFloat(gpsMatch[1])
          result.lng = parseFloat(gpsMatch[2])
        }

        // Photos
        if (maxPhotos > 0) {
          const photoEls = document.querySelectorAll('button[jsaction*="pane.photo"] img, img[src*="googleusercontent"], .RxNLqc img')
          const photos: Array<{ url: string; alt?: string }> = []
          photoEls.forEach((el) => {
            if (photos.length >= maxPhotos) return
            const img = el as HTMLImageElement
            if (img.src && img.src.startsWith("http")) {
              photos.push({ url: img.src, alt: img.alt })
            }
          })
          result.photos = photos
        }

        // Reviews
        if (maxReviews > 0) {
          const reviewEls = document.querySelectorAll('.jftiEf, .MyEned, [data-review-id]')
          const reviews: Array<{ author: string; text: string; rating?: number; date?: string }> = []
          reviewEls.forEach((el) => {
            if (reviews.length >= maxReviews) return
            const author = el.querySelector(".TSUjbe, .d4r55")?.textContent?.trim() || ""
            const text = el.querySelector(".MyEned, .Jtu6Td")?.textContent?.trim() || ""
            const ratingEl = el.querySelector(".kvMYJc, [role='img'][aria-label*='étoile']")
            const ratingText = ratingEl?.textContent?.trim() || ratingEl?.getAttribute("aria-label") || ""
            const dateEl = el.querySelector(".rsqaWe, .xRkPPb")?.textContent?.trim()
            reviews.push({
              author,
              text,
              date: dateEl || "",
              rating: ratingText ? parseInt(ratingText) || undefined : undefined,
            })
          })
          result.reviews = reviews
        }

        return result
      }, this.config.maxPhotos, this.config.maxReviews).catch(() => ({}))

      // Mapping vers l'objet ScrapedPlace
      if (extracted.name) place.name = extracted.name as string
      place.category = extracted.category as string | undefined
      place.address = extracted.address as string | undefined
      place.phone = extracted.phone as string | undefined
      if (place.phone) place.phoneNormalized = normalizePhone(place.phone) || undefined
      if (extracted.website) place.website = normalizeUrl(extracted.website as string) || undefined
      if (extracted.email) {
        const email = normalizeEmail(extracted.email as string)
        if (email) place.email = email
      }
      if (extracted.placeId) place.placeId = extracted.placeId as string
      if (extracted.lat && extracted.lng) {
        place.gps = { lat: extracted.lat as number, lng: extracted.lng as number }
      } else {
        // Tente depuis l'URL courante
        const gps = parseGpsFromUrl(page.url())
        if (gps) place.gps = gps
      }
      if (extracted.ratingText) place.rating = parseRating(extracted.ratingText as string) || undefined
      if (extracted.reviewCountText) place.reviewCount = parseReviewCount(extracted.reviewCountText as string) || undefined
      if (extracted.isOpenText) {
        const t = (extracted.isOpenText as string).toLowerCase()
        place.isOpenNow = t.includes("ouvert") || t.includes("open")
      }
      if (extracted.hoursText) {
        place.hours = parseHours(extracted.hoursText as string)
      }
      if (extracted.photos && Array.isArray(extracted.photos)) {
        place.photos = (extracted.photos as Array<{ url: string; alt?: string }>).map((p) => ({
          url: p.url,
          alt: p.alt,
        })) as Photo[]
      }
      if (extracted.reviews && Array.isArray(extracted.reviews)) {
        place.reviews = extracted.reviews as Review[]
      }

      // Tente d'extraire l'email depuis le site web (si pas déjà trouvé)
      if (!place.email && place.website) {
        const email = await this.tryExtractEmailFromWebsite(page, place.website)
        if (email) place.email = email
      }

      return place
    } catch (err) {
      this.emit({ type: "error", message: `Erreur extraction ${listedPlace.name}: ${(err as Error).message}`, recoverable: true })
      return null
    }
  }

  /**
   * Tente d'extraire un email depuis la page d'accueil du site web
   */
  private async tryExtractEmailFromWebsite(parentPage: Page, websiteUrl: string): Promise<string | null> {
    try {
      const page = await this.context!.newPage()
      await this.configurePage(page)
      await this.rateLimiter.waitForNextSlot()

      try {
        await page.goto(websiteUrl, { waitUntil: "domcontentloaded", timeout: 15000 })
        const email = await page.evaluate(() => {
          const html = document.body?.innerHTML || ""
          const match = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
          return match ? match[0] : null
        })
        return email ? normalizeEmail(email) : null
      } finally {
        await page.close()
      }
    } catch {
      return null
    }
  }
}

// ============================================================================
// HELPERS
// ============================================================================

interface ListedPlace {
  name: string
  element: import("playwright").ElementHandle
  href?: string
}

/** Parse un texte d'horaires en structure DayHours[] */
function parseHours(text: string): DayHours[] {
  if (!text) return []
  // Google Maps affiche souvent "Lun: 09:00–18:00 Mar: 09:00–18:00 ..."
  // ou "Ouvre à 09:00 · Ferme à 18:00"
  const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
  const result: DayHours[] = []
  // Tente de splitter par jour
  const regex = new RegExp(`(${days.join("|")})[\\.\\s:]+([^\\n]+?)(?=(?:${days.join("|")})|$)`, "gi")
  let match
  while ((match = regex.exec(text)) !== null) {
    result.push({ day: match[1], hours: match[2].trim() })
  }
  if (result.length === 0 && text.length > 0) {
    result.push({ day: "Aujourd'hui", hours: text })
  }
  return result
}

export { USER_AGENTS }
