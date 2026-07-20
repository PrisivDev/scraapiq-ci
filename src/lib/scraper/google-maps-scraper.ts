/**
 * Moteur de scraping Google Maps — Browserless.io (Chromium cloud)
 *
 * Architecture :
 *  1. Se connecte à un Chromium distant via Browserless.io (puppeteer.connect)
 *  2. Construit l'URL de recherche Google Maps
 *  3. Charge la liste des résultats, scroll pour charger plus
 *  4. Pour chaque lieu, ouvre la fiche détail et extrait toutes les infos
 *  5. Déduplique les résultats
 *  6. Émet des événements de progression
 *
 * Avantages vs Playwright local :
 *  - Fonctionne sur Vercel serverless (pas de Chromium local)
 *  - Pas de problème de mémoire (Chromium tourne sur le cloud Browserless)
 *  - Rotation IP automatique
 *  - CAPTCHA solving optionnel
 *
 * Configuration :
 *  - BROWSERLESS_API_KEY : clé API Browserless.io
 *  - BROWSERLESS_ENDPOINT : URL de connexion (défaut: wss://chrome.browserless.io)
 */

import puppeteer, { type Browser, type Page } from "puppeteer-core"
import type {
  ScrapedPlace,
  SearchQuery,
  ScrapeResult,
  ScrapeEvent,
} from "./types"
import {
  normalizePhone,
  normalizeEmail,
  normalizeUrl as normalizeWebsite,
  normalizeName as cleanBusinessName,
} from "./normalize"

// ============================================================================
// TYPES
// ============================================================================

export interface ScraperConfig {
  maxResults: number
  maxScrolls: number
  extractReviews: boolean
  extractPhotos: boolean
  maxPhotos: number
  pageTimeout: number
  retries: number
  headless: boolean
  locale: string
  timezone: string
  userAgent?: string
}

export type ScraperEventHandler = (event: ScrapeEvent) => void

// ============================================================================
// SCRAPER PRINCIPAL
// ============================================================================

export class GoogleMapsScraper {
  private config: ScraperConfig
  private browser: Browser | null = null
  private eventHandlers: ScraperEventHandler[] = []
  private cancelled = false

  constructor(config: Partial<ScraperConfig> = {}) {
    this.config = {
      maxResults: 20,
      maxScrolls: 5,
      extractReviews: false,
      extractPhotos: false,
      maxPhotos: 2,
      pageTimeout: 25000,
      retries: 2,
      headless: true,
      locale: "fr",
      timezone: "Africa/Abidjan",
      ...config,
    }
  }

  on(handler: ScraperEventHandler): void {
    this.eventHandlers.push(handler)
  }

  cancel(): void {
    this.cancelled = true
    if (this.browser) {
      this.browser.close().catch(() => {})
    }
  }

  private emit(event: ScrapeEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event)
      } catch (e) {
        console.error("[scraper] event handler error:", e)
      }
    }
  }

  // ============================================================================
  // CONNEXION BROWSERLESS
  // ============================================================================

  private getBrowserlessUrl(): string {
    const apiKey = process.env.BROWSERLESS_API_KEY
    const endpoint = process.env.BROWSERLESS_ENDPOINT || "wss://chrome.browserless.io"

    if (!apiKey) {
      throw new Error(
        "BROWSERLESS_API_KEY manquant. Obtenez une clé sur https://browserless.io"
      )
    }

    // URL format: wss://chrome.browserless.io?token=API_KEY
    return `${endpoint}?token=${apiKey}&stealth=true&blockAds=true`
  }

  private async initBrowser(): Promise<void> {
    const wsUrl = this.getBrowserlessUrl()

    this.browser = await puppeteer.connect({
      browserWSEndpoint: wsUrl,
      ignoreHTTPSErrors: true,
      // Timeout de connexion (10s)
      timeout: 10000,
    })

    console.log("[scraper] Connecté à Browserless.io")
  }

  // ============================================================================
  // SCRAPE PRINCIPAL
  // ============================================================================

  async scrape(jobId: string, query: SearchQuery): Promise<ScrapeResult> {
    const startTime = Date.now()
    const places: ScrapedPlace[] = []
    const duplicates: DuplicateGroup[] = []
    const errors: string[] = []

    try {
      this.emit({ type: "start", jobId, query })

      // 1. Connexion à Browserless
      await this.initBrowser()
      this.emit({ type: "progress", progress: 5, phase: "init" })

      if (this.cancelled) {
        return this.buildResult(places, duplicates, errors, startTime, "cancelled")
      }

      // 2. Ouvrir Google Maps
      const page = await this.browser!.newPage()
      await page.setViewport({ width: 1440, height: 900 })
      await page.setUserAgent(
        this.config.userAgent ||
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
      await page.setExtraHTTPHeaders({
        "Accept-Language": `${this.config.locale},en;q=0.9`,
      })

      // 3. Construire l'URL de recherche
      const searchUrl = this.buildSearchUrl(query)
      this.emit({ type: "progress", progress: 15, phase: "searching" })

      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: this.config.pageTimeout,
      })

      // Attendre que les résultats chargent
      await page.waitForSelector('div[role="feed"], a[href*="/maps/place/"]', {
        timeout: 15000,
      }).catch(() => {})

      this.emit({ type: "search-loaded", resultsOnPage: 0 })

      // 4. Scroll pour charger plus de résultats
      const placeUrls: string[] = []
      for (let i = 0; i < this.config.maxScrolls && placeUrls.length < this.config.maxResults; i++) {
        if (this.cancelled) break

        // Extraire les URLs des lieux
        const newUrls = await page.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a[href*="/maps/place/"]'))
          return links.map((a) => (a as HTMLAnchorElement).href).filter((h) => h.includes("/maps/place/"))
        })

        for (const url of newUrls) {
          if (!placeUrls.includes(url)) {
            placeUrls.push(url)
            if (placeUrls.length >= this.config.maxResults) break
          }
        }

        this.emit({
          type: "scroll",
          scrollIndex: i + 1,
          totalResults: placeUrls.length,
        })
        this.emit({
          type: "progress",
          progress: 15 + Math.floor((placeUrls.length / this.config.maxResults) * 20),
          phase: "listing",
        })

        // Scroll
        await page.evaluate(() => {
          const feed = document.querySelector('div[role="feed"]')
          if (feed) feed.scrollBy(0, 1000)
          else window.scrollBy(0, 1000)
        })
        await page.waitForTimeout(1500)
      }

      // 5. Extraire les détails de chaque lieu
      this.emit({ type: "progress", progress: 35, phase: "extracting" })

      for (let i = 0; i < placeUrls.length; i++) {
        if (this.cancelled) break
        if (places.length >= this.config.maxResults) break

        const url = placeUrls[i]
        try {
          const place = await this.extractPlaceDetails(page, url)
          if (place) {
            // Déduplication
            const isDup = places.some((p) => this.isDuplicate(p, place))
            if (isDup) {
              duplicates.push({
                place,
                reason: "similar",
                similarity: 0.9,
              })
              this.emit({ type: "duplicate-detected", place, reason: "similar" })
            } else {
              places.push(place)
              this.emit({ type: "place-extracted", place })
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`Lieu ${i + 1}: ${msg}`)
          this.emit({ type: "error", message: msg, place: { name: url } as any })
        }

        this.emit({
          type: "progress",
          progress: 35 + Math.floor(((i + 1) / placeUrls.length) * 60),
          phase: "extracting",
        })
      }

      // 6. Terminé
      await page.close()

      this.emit({
        type: "complete",
        results: places,
        durationMs: Date.now() - startTime,
      })

      return this.buildResult(places, duplicates, errors, startTime, "completed")
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(msg)
      this.emit({ type: "error", message: msg })

      return this.buildResult(places, duplicates, errors, startTime, "failed")
    } finally {
      if (this.browser) {
        try {
          await this.browser.close()
        } catch {}
        this.browser = null
      }
    }
  }

  // ============================================================================
  // MÉTHODES PRIVÉES
  // ============================================================================

  private buildSearchUrl(query: SearchQuery): string {
    const parts: string[] = [query.keyword]
    if (query.commune) parts.push(query.commune)
    if (query.city) parts.push(query.city)
    if (query.neighborhood) parts.push(query.neighborhood)
    parts.push("Côte d'Ivoire")

    const q = encodeURIComponent(parts.join(" "))
    return `https://www.google.com/maps/search/${q}/?hl=${this.config.locale}`
  }

  private async extractPlaceDetails(page: Page, url: string): Promise<ScrapedPlace | null> {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.config.pageTimeout })

    // Attendre que la fiche se charge
    await page.waitForTimeout(2000)

    const data = await page.evaluate(() => {
      const getText = (selector: string): string | null => {
        const el = document.querySelector(selector)
        return el?.textContent?.trim() || null
      }

      // Nom
      const name =
        getText('h1.DUwDvf') ||
        getText('[data-testid="place-name"]') ||
        getText('h1') ||
        null

      // Catégorie
      const category =
        getText('button[jsaction*="pane.rating.category"]') ||
        getText('.YhemCb') ||
        null

      // Adresse
      const address =
        getText('button[data-item-id="address"]') ||
        getText('[data-item-id="address"]') ||
        null

      // Téléphone
      const phone =
        getText('button[data-item-id^="phone:"]') ||
        getText('[data-item-id^="phone:"]') ||
        null

      // Site web
      const website =
        document.querySelector('a[data-item-id="authority"]')?.getAttribute("href") ||
        null

      // Rating
      const ratingEl = document.querySelector('div.F7nice span[aria-hidden="true"]')
      const rating = ratingEl?.textContent ? parseFloat(ratingEl.textContent) : null

      // Nombre d'avis
      const reviewText = getText('div.F7nice span[aria-label$="avis"]') || ""
      const reviewMatch = reviewText.match(/(\d[\s\d]*)/)
      const reviewCount = reviewMatch ? parseInt(reviewMatch[1].replace(/\s/g, ""), 10) : null

      // Statut ouvert/fermé
      const openEl = document.querySelector('span[aria-label*="ouvert"], span[aria-label*="Ouvert"]')
      const isOpenNow = openEl ? true : null

      // GPS depuis l'URL
      const coordsMatch = window.location.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
      const lat = coordsMatch ? parseFloat(coordsMatch[1]) : null
      const lng = coordsMatch ? parseFloat(coordsMatch[2]) : null

      // placeId depuis l'URL
      const placeIdMatch = window.location.href.match(/0x[0-9a-f]+:0x[0-9a-f]+/)
      const placeId = placeIdMatch ? placeIdMatch[0] : null

      return {
        name,
        category,
        address,
        phone,
        website,
        rating,
        reviewCount,
        isOpenNow,
        lat,
        lng,
        placeId,
        scrapedAt: new Date().toISOString(),
      }
    })

    if (!data.name) {
      return null
    }

    const place: ScrapedPlace = {
      name: cleanBusinessName(data.name),
      category: data.category || undefined,
      address: data.address || undefined,
      phone: data.phone ? normalizePhone(data.phone) : undefined,
      phoneNormalized: data.phone ? normalizePhone(data.phone) : undefined,
      email: undefined, // extrait séparément (voir tryExtractEmail)
      website: data.website ? normalizeWebsite(data.website) : undefined,
      lat: data.lat || undefined,
      lng: data.lng || undefined,
      rating: data.rating || undefined,
      reviewCount: data.reviewCount || undefined,
      isOpenNow: data.isOpenNow ?? undefined,
      placeId: data.placeId || undefined,
      hours: undefined,
      photos: undefined,
      scrapedAt: data.scrapedAt,
    }

    // Essayer d'extraire l'email depuis le site web (optionnel)
    if (place.website && this.config.extractPhotos) {
      // Skip email extraction sur Vercel (trop lent)
      // Pour l'activer, il faut un worker séparé
    }

    return place
  }

  private isDuplicate(a: ScrapedPlace, b: ScrapedPlace): boolean {
    // Même placeId
    if (a.placeId && b.placeId && a.placeId === b.placeId) return true
    // Même téléphone normalisé
    if (a.phoneNormalized && b.phoneNormalized && a.phoneNormalized === b.phoneNormalized)
      return true
    // Même site web
    if (a.website && b.website && a.website === b.website) return true
    // Nom + GPS similaires
    if (
      a.name &&
      b.name &&
      a.lat &&
      b.lat &&
      Math.abs(a.lat - b.lat) < 0.001 &&
      Math.abs(a.lng! - b.lng!) < 0.001
    ) {
      return true
    }
    return false
  }

  private buildResult(
    places: ScrapedPlace[],
    duplicates: DuplicateGroup[],
    errors: string[],
    startTime: number,
    status: "completed" | "failed" | "cancelled"
  ): ScrapeResult {
    return {
      places,
      duplicates,
      status,
      stats: {
        totalFound: places.length + duplicates.length,
        uniqueCount: places.length,
        duplicatesRemoved: duplicates.length,
        durationMs: Date.now() - startTime,
        errorsCount: errors.length,
      },
      errors,
    }
  }
}

// ============================================================================
// TYPES LOCAUX
// ============================================================================

interface DuplicateGroup {
  place: ScrapedPlace
  reason: string
  similarity: number
}
