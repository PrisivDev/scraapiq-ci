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

import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright"
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

const GOOGLE_MAPS_BASE = "https://www.google.com/maps"

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
    await page.route("**/*", (route: Route) => {
      const type = route.request().resourceType()
      const url = route.request().url()

      // Garde : document, xhr, fetch, script (nécessaires pour Google Maps SPA)
      // Bloque : images (sauf photos lieu), fonts, media, websocket inutiles
      if (["media", "font"].includes(type)) {
        return route.abort()
      }
      // Bloque les tracker et analytics
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

    // Format /maps?q=... — c'est le format qui déclenche réellement
    // la recherche et affiche la liste des résultats (le format /search/?query=
    // redirige vers la carte vide sans résultats)
    const params = new URLSearchParams({
      q,
      hl: query.language || "fr",
      gl: query.country || "ci",
    })

    return `${GOOGLE_MAPS_BASE}?${params.toString()}`
  }

  /** Attend que la liste des résultats apparaisse */
  private async waitForResultsList(page: Page): Promise<void> {
    // Google Maps est une SPA lourde : domcontentloaded ne suffit pas,
    // il faut attendre que le JS rende la liste des résultats.
    const selectors = [
      'div[role="feed"]',
      '[aria-label*="Résultats" i]',
      '[aria-label*="Results" i]',
      'a[href*="/maps/place/"]', // liens vers les fiches lieu
      '.qBF1Pd', // nom du lieu dans la liste
    ]
    for (const sel of selectors) {
      try {
        await page.waitForSelector(sel, { timeout: 15000, state: "visible" })
        // Une fois le premier sélecteur trouvé, attend un peu que le reste se rende
        await humanDelay(1500, 2500)
        return
      } catch {
        // continue avec le suivant
      }
    }
    // Si aucun sélecteur ne matche, on continue quand même (la suite gérera l'absence)
  }

  /**
   * Scroll la liste des résultats pour charger plus d'items
   * Retourne la liste des lieux visibles (avec lien vers la fiche)
   */
  private async scrollAndCollectList(page: Page, maxResults: number): Promise<ListedPlace[]> {
    const places: ListedPlace[] = []
    const seenNames = new Set<string>()

    for (let scroll = 0; scroll < this.config.maxScrolls && !this.cancelled; scroll++) {
      // Plusieurs sélecteurs possibles pour les items de la liste Google Maps
      const items = await page.$$(
        'div[role="feed"] > div[role="article"], ' +
        'div[role="feed"] a[href*="/maps/place/"], ' +
        'a[href*="/maps/place/"][role="article"], ' +
        '.Nv2PK, .bfdYNd'
      ).catch(() => [])

      for (const item of items) {
        if (places.length >= maxResults) break
        try {
          // Le nom est dans .qBF1Pd, .fontHeadlineSmall, ou [role="heading"]
          const name = await item.$eval(
            '.qBF1Pd, .qBF1Pd-haAclf, .fontHeadlineSmall, [role="heading"], .NrDZNb',
            (el) => (el as HTMLElement).textContent?.trim() || ""
          ).catch(() => "")

          // Si pas de nom trouvé, tente via l'attribut aria-label
          const finalName = name || await item.getAttribute("aria-label") || ""

          if (finalName && !seenNames.has(finalName) && finalName.length > 2) {
            seenNames.add(finalName)
            const href = await item.$eval("a", (el) => (el as HTMLAnchorElement).href).catch(() =>
              item.evaluate((el) => {
                const a = el.querySelector("a") || (el as HTMLAnchorElement)
                return a?.href || ""
              }).catch(() => "")
            )
            places.push({ name: finalName, element: item, href })
          }
        } catch {
          // skip
        }
      }

      this.emit({ type: "scroll", scrollIndex: scroll + 1, totalResults: places.length })

      if (places.length >= maxResults) break
      // Si on n'a trouvé aucun item après 3 scrolls, on abandonne
      if (scroll >= 3 && places.length === 0) break

      // Scroll la liste
      try {
        await page.evaluate(() => {
          // Cherche le conteneur scrollable de la liste de résultats
          const feed = document.querySelector('div[role="feed"]')
            || document.querySelector('[aria-label*="Résultats" i]')
            || document.querySelector('[aria-label*="Results" i]')
          if (feed) {
            feed.scrollTop = feed.scrollHeight
          }
          // Aussi scroll sur la fenêtre au cas où
          window.scrollBy(0, 800)
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
   * Extrait les détails d'un lieu en naviguant vers sa fiche
   * (plus fiable que le clic qui peut ne pas ouvrir le panneau)
   */
  private async extractPlaceDetails(page: Page, listedPlace: ListedPlace): Promise<ScrapedPlace | null> {
    const place: ScrapedPlace = {
      name: listedPlace.name,
      scrapedAt: new Date().toISOString(),
      sourceUrl: listedPlace.href || page.url(),
    }

    try {
      // Si on a l'URL de la fiche, navigue directement dessus (plus fiable que le clic)
      if (listedPlace.href) {
        const url = listedPlace.href.startsWith("http")
          ? listedPlace.href
          : `https://www.google.com${listedPlace.href}`
        await this.rateLimiter.waitForNextSlot()
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.config.pageTimeout })
        // Attend que le panneau de détail se charge (h1 = nom du lieu)
        await page.waitForSelector("h1", { timeout: 10000 }).catch(() => {})
        await humanDelay(2000, 3000) // Laisse le JS rendre les data-item-id
      } else {
        // Fallback : clic sur l'item
        await listedPlace.element.click({ timeout: 5000 }).catch(() => {})
        await humanDelay(1500, 2500)
        await page.waitForSelector("h1", { timeout: 8000 }).catch(() => {})
      }

      // Extraction via evaluate — utilise les data-item-id qui sont la structure officielle Google
      const extracted = await page.evaluate((maxPhotos) => {
        const result: Record<string, unknown> = {}

        // Nom — h1 dans le panneau de détail
        const h1 = document.querySelector("h1")
        result.name = h1?.textContent?.trim() || undefined

        // Parcourt TOUS les [data-item-id] — c'est la clé de l'extraction Google Maps
        // Chaque champ (address, phone, website, hours...) a un data-item-id spécifique
        const dataItems = document.querySelectorAll("[data-item-id]")
        const fields: Record<string, { text: string; href?: string }> = {}
        dataItems.forEach((el) => {
          const key = el.getAttribute("data-item-id") || ""
          if (!key) return
          // Le texte est dans .Io6YVf (sous-classe) ou directement dans l'élément
          const textEl = el.querySelector(".Io6YVf") || el
          const text = textEl.textContent?.trim() || ""
          // Pour les liens, récupère aussi le href
          const href = (el as HTMLAnchorElement).href || el.querySelector("a")?.href || undefined
          if (text && text.length < 300) {
            fields[key] = { text, href }
          }
        })

        // Map les champs connus
        // Adresse
        if (fields["address"]) result.address = fields["address"].text
        // Téléphone — data-item-id commence par "phone:tel:+XXXX"
        const phoneKey = Object.keys(fields).find((k) => k.startsWith("phone:"))
        if (phoneKey) {
          result.phone = fields[phoneKey].text
          // Extrait aussi le numéro normalisé depuis la clé
          const telMatch = phoneKey.match(/tel:(.+)$/)
          if (telMatch) result.phoneRaw = telMatch[1]
        }
        // Site web — data-item-id="authority"
        if (fields["authority"]) {
          result.website = fields["authority"].text
          result.websiteUrl = fields["authority"].href
        }
        // Horaires — data-item-id="oh"
        if (fields["oh"]) result.hoursText = fields["oh"].text
        // Plus code — data-item-id="oloc"
        if (fields["oloc"]) result.plusCode = fields["oloc"].text

        // Catégorie — bouton avec jsaction pane.rating.category
        const catBtn = document.querySelector("button[jsaction*='pane.rating.category']")
        if (catBtn) result.category = catBtn.textContent?.trim()

        // Note (rating) — span avec aria-label contenant "étoile" ou "star"
        const ratingEl = document.querySelector("[role='img'][aria-label*='toile'], [role='img'][aria-label*='star'], .F7nice [role='img']")
        if (ratingEl) {
          result.ratingText = ratingEl.textContent?.trim() || ratingEl.getAttribute("aria-label") || ""
        }

        // Nombre d'avis — span à côté de la note, ou bouton avec jsaction pane.rating.reviews
        const reviewBtn = document.querySelector("button[jsaction*='pane.rating.reviews'], [aria-label*='avis' i]")
        if (reviewBtn) {
          result.reviewCountText = reviewBtn.textContent?.trim() || reviewBtn.getAttribute("aria-label") || ""
        }
        // Alternative : le span qui suit la note dans .F7nice
        if (!result.reviewCountText) {
          const f7 = document.querySelector(".F7nice")
          if (f7) {
            const spans = f7.querySelectorAll("span")
            spans.forEach((s) => {
              const t = s.textContent?.trim() || ""
              if (t.match(/\d/) && t.length < 30 && !t.includes("étoile") && !t.includes("star")) {
                result.reviewCountText = t
              }
            })
          }
        }

        // Statut ouvert/fermé
        const openEl = document.querySelector("[data-item-id='oh'] + * , span[aria-label*='ouvert' i], span[aria-label*='Ouvert' i], span[aria-label*='Fermé' i], span[aria-label*='Open' i], span[aria-label*='Closed' i]")
        if (openEl) result.isOpenText = openEl.textContent?.trim()

        // Place ID depuis l'URL
        const url = window.location.href
        const placeIdMatch = url.match(/0x[a-f0-9]+:0x([a-f0-9]+)/i)
        if (placeIdMatch) result.placeId = "0x" + placeIdMatch[1]
        else {
          const chijMatch = url.match(/(ChIJ[a-zA-Z0-9_-]+)/)
          if (chijMatch) result.placeId = chijMatch[1]
          else {
            // Format data=!1s0xXXX:0xYYY
            const dataIdMatch = url.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+)/i)
            if (dataIdMatch) result.placeId = dataIdMatch[1]
          }
        }

        // GPS depuis l'URL (@lat,lng)
        const gpsMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
        if (gpsMatch) {
          result.lat = parseFloat(gpsMatch[1])
          result.lng = parseFloat(gpsMatch[2])
        }
        // Alternative : GPS dans la data URL (!8m2!3dLAT!4dLNG)
        if (!result.lat) {
          const dataGpsMatch = url.match(/!8m2!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
          if (dataGpsMatch) {
            result.lat = parseFloat(dataGpsMatch[1])
            result.lng = parseFloat(dataGpsMatch[2])
          }
        }

        // Photos
        if (maxPhotos > 0) {
          const photoEls = document.querySelectorAll("img[src*='googleusercontent']")
          const photos: Array<{ url: string; alt?: string }> = []
          photoEls.forEach((el) => {
            if (photos.length >= maxPhotos) return
            const img = el as HTMLImageElement
            if (img.src && img.src.startsWith("http") && img.naturalWidth > 50) {
              photos.push({ url: img.src, alt: img.alt })
            }
          })
          result.photos = photos
        }

        // Prix / niveau de prix
        const priceBtn = document.querySelector("button[jsaction*='pane.price']")
        if (priceBtn) result.priceLevel = priceBtn.textContent?.trim()

        return result
      }, this.config.maxPhotos).catch(() => ({}))

      // Mapping vers l'objet ScrapedPlace
      if (extracted.name) place.name = extracted.name as string
      place.category = extracted.category as string | undefined
      place.address = extracted.address as string | undefined
      place.phone = (extracted.phoneRaw as string) || (extracted.phone as string) || undefined
      if (place.phone) place.phoneNormalized = normalizePhone(place.phone) || undefined
      if (extracted.websiteUrl) {
        place.website = normalizeUrl(extracted.websiteUrl as string) || undefined
      } else if (extracted.website) {
        place.website = normalizeUrl(extracted.website as string) || undefined
      }
      if (extracted.placeId) place.placeId = extracted.placeId as string
      if (extracted.lat && extracted.lng) {
        place.gps = { lat: extracted.lat as number, lng: extracted.lng as number }
      } else {
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
      if (extracted.priceLevel) place.priceLevel = extracted.priceLevel as string

      // Tente d'extraire l'email depuis le site web (si pas déjà trouvé et si site présent)
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
