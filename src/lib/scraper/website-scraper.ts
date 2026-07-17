/**
 * Robot de scraping de sites web — Playwright
 *
 * Architecture :
 *  1. Lance Chromium headless
 *  2. Visite la page d'accueil
 *  3. Détecte les liens du footer + navigation
 *  4. Identifie et visite les pages clés : Contact, À propos, Mentions légales
 *  5. Pour chaque page, extrait :
 *     - emails (mailto + regex texte)
 *     - téléphones (tel: + regex CI + international)
 *     - WhatsApp (wa.me, api.whatsapp.com, texte)
 *     - réseaux sociaux (FB, IG, LinkedIn, Twitter, YouTube, TikTok, Telegram)
 *     - Google Maps (lien + iframe)
 *     - GPS (URL Maps, iframe, JSON-LD, microdata)
 *     - adresses postales (JSON-LD, regex texte, villes CI)
 *  6. Fusionne et déduplique tous les contacts
 */

import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright"
import type {
  WebsiteSearchQuery,
  WebsiteScraperConfig,
  WebsiteScrapedData,
  WebsiteScrapeEvent,
  VisitedPage,
  ExtractedEmail,
  ExtractedPhone,
  ExtractedSocialLink,
  ExtractedGps,
} from "./website-types"
import { detectPageType } from "./website-types"
import { extractContactsFromPage } from "./website-extractor"
import { deduplicatePlaces } from "./dedup"
import { normalizeUrl } from "./normalize"
import { RateLimiter, randomUserAgent, humanDelay, exponentialBackoff } from "./rate-limiter"
import type { ScrapeEvent, ScrapeResult, Photo } from "./types"

export class WebsiteScraper {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private config: Required<WebsiteScraperConfig>
  private listeners: ((event: WebsiteScrapeEvent | ScrapeEvent) => void)[] = []
  private rateLimiter: RateLimiter
  private cancelled = false

  constructor(config: WebsiteScraperConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      userAgent: config.userAgent ?? "",
      minDelay: config.minDelay ?? 800,
      maxDelay: config.maxDelay ?? 2000,
      pageTimeout: config.pageTimeout ?? 25000,
      retries: config.retries ?? 2,
      backoffMs: config.backoffMs ?? 2000,
      blockResources: config.blockResources ?? true,
      extractImages: config.extractImages ?? true,
    }
    this.rateLimiter = new RateLimiter(this.config.minDelay, 30) // sites web = plus permissif
  }

  on(listener: (event: WebsiteScrapeEvent | ScrapeEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private emit(event: WebsiteScrapeEvent | ScrapeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error("[website-scraper] listener error:", err)
      }
    }
  }

  cancel(): void {
    this.cancelled = true
    this.emit({ type: "cancelled" })
  }

  /**
   * Lance le scraping d'un site
   */
  async scrape(jobId: string, query: WebsiteSearchQuery): Promise<ScrapeResult> {
    const startedAt = new Date()
    this.cancelled = false
    let pagesScraped = 0
    const errors: string[] = []

    this.emit({ type: "start", jobId, query: query as unknown as Record<string, unknown> } as ScrapeEvent)

    try {
      // 1. Init navigateur
      await this.initBrowser()
      this.emit({ type: "progress", progress: 5, phase: "init" } as ScrapeEvent)

      const page = await this.context!.newPage()
      await this.configurePage(page)

      // 2. Valide et normalise l'URL
      const baseUrl = this.normalizeBaseUrl(query.url)
      if (!baseUrl) {
        throw new Error(`URL invalide: ${query.url}`)
      }

      const data: WebsiteScrapedData = {
        name: "",
        siteUrl: baseUrl,
        visitedPages: [],
        emails: [],
        phones: [],
        whatsapp: [],
        socialLinks: [],
        addresses: [],
        gps: [],
        footerLinks: [],
        scrapedAt: new Date().toISOString(),
        sourceUrl: baseUrl,
      }

      // 3. Visite la page d'accueil
      this.emit({ type: "progress", progress: 10, phase: "visiting-home" } as ScrapeEvent)
      const homeResult = await this.visitPage(page, baseUrl, "home", 0)
      if (homeResult) {
        data.visitedPages.push(homeResult.page)
        pagesScraped++

        if (homeResult.extraction) {
          this.mergeExtraction(data, homeResult.extraction)
        }

        // Récupère le titre + meta description
        data.siteName = homeResult.page.title
        data.metaDescription = await page
          .evaluate(() => document.querySelector('meta[name="description"]')?.getAttribute("content") || undefined)
          .catch(() => undefined)
        data.language = await page
          .evaluate(() => document.documentElement.lang || undefined)
          .catch(() => undefined)

        // Logo
        if (this.config.extractImages) {
          const logo = await page
            .evaluate(() => {
              const selectors = [
                'img[alt*="logo" i]',
                'img[src*="logo" i]',
                'link[rel*="icon" i]',
                'link[rel*="shortcut" i]',
                ".logo img",
                "#logo img",
                "header img",
              ]
              for (const sel of selectors) {
                const el = document.querySelector(sel) as HTMLImageElement | HTMLLinkElement | null
                if (el) {
                  const src = (el as HTMLImageElement).src || (el as HTMLLinkElement).href
                  if (src) return src
                }
              }
              return undefined
            })
            .catch(() => undefined)
          if (logo) data.logoUrl = logo
        }

        // 4. Détecte les liens du footer pour trouver Contact, About, Mentions
        this.emit({ type: "progress", progress: 25, phase: "discovering-pages" } as ScrapeEvent)
        const footerLinks = await this.discoverFooterLinks(page, baseUrl)
        data.footerLinks = footerLinks.slice(0, 20)

        // 5. Sélectionne les pages à visiter
        const pagesToVisit = this.selectPagesToVisit(footerLinks, query)
        const total = pagesToVisit.length

        // 6. Visite chaque page
        for (let i = 0; i < total && !this.cancelled; i++) {
          const pageInfo = pagesToVisit[i]
          this.emit({
            type: "ws-page-visit",
            url: pageInfo.url,
            pageType: pageInfo.pageType,
            depth: 1,
          } as WebsiteScrapeEvent)
          this.emit({
            type: "progress",
            progress: 25 + Math.floor((i / total) * 65),
            phase: "visiting-pages",
          } as ScrapeEvent)

          const result = await this.visitPage(page, pageInfo.url, pageInfo.pageType, 1)
          if (result) {
            data.visitedPages.push(result.page)
            pagesScraped++
            if (result.extraction) {
              this.mergeExtraction(data, result.extraction)
            }
          }

          await humanDelay(this.config.minDelay, this.config.maxDelay)
        }

        // 7. Stats de progression
        this.emit({
          type: "ws-contacts-found",
          emails: data.emails.length,
          phones: data.phones.length,
          socials: data.socialLinks.length,
        } as WebsiteScrapeEvent)

        // 8. Si pas de contact trouvé sur les pages standard, tente une recherche globale
        if (data.emails.length === 0 && data.phones.length === 0 && data.socialLinks.length === 0) {
          // Tente une page /contact générique
          const contactUrl = new URL("/contact", baseUrl).toString()
          this.emit({
            type: "ws-page-visit",
            url: contactUrl,
            pageType: "contact",
            depth: 1,
          } as WebsiteScrapeEvent)
          const result = await this.visitPage(page, contactUrl, "contact", 1)
          if (result) {
            data.visitedPages.push(result.page)
            pagesScraped++
            if (result.extraction) {
              this.mergeExtraction(data, result.extraction)
            }
          }
        }
      }

      // 9. Déduplication finale + structure
      this.emit({ type: "progress", progress: 95, phase: "finalizing" } as ScrapeEvent)
      this.deduplicateContacts(data)

      // Set name si pas trouvé
      if (!data.name) {
        data.name = data.siteName || new URL(baseUrl).hostname.replace("www.", "")
      }

      // 10. Émet le résultat final
      this.emit({ type: "ws-extracted", data } as WebsiteScrapeEvent)
      this.emit({ type: "progress", progress: 100, phase: "done" } as ScrapeEvent)
      this.emit({
        type: "complete",
        results: [data],
        duplicates: 0,
        durationMs: Date.now() - startedAt.getTime(),
      } as ScrapeEvent)

      const completedAt = new Date()
      return {
        jobId,
        query: query as unknown as Record<string, unknown>,
        status: this.cancelled ? "cancelled" : "completed",
        places: [data],
        duplicates: [],
        stats: {
          totalExtracted: 1,
          uniqueCount: 1,
          duplicatesCount: 0,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          pagesScraped,
          blocksEncountered: 0,
          retries: 0,
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
          blocksEncountered: 0,
          retries: 0,
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
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        "--lang=fr-FR",
      ],
    })

    this.context = await this.browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: this.config.userAgent || randomUserAgent(),
      locale: "fr-FR",
      timezoneId: "Africa/Abidjan",
      extraHTTPHeaders: {
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
    })

    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false })
    })
  }

  private async configurePage(page: Page): Promise<void> {
    page.setDefaultTimeout(this.config.pageTimeout)

    if (this.config.blockResources) {
      await page.route("**/*", (route: Route) => {
        const type = route.request().resourceType()
        const url = route.request().url()
        // Bloque fonts, media, trackers
        if (["media", "font"].includes(type)) return route.abort()
        if (
          url.includes("doubleclick.net") ||
          url.includes("google-analytics") ||
          url.includes("googletagmanager") ||
          url.includes("facebook.com/tr") ||
          url.includes("hotjar") ||
          url.includes("clarity.ms")
        ) {
          return route.abort()
        }
        return route.continue()
      })
    }
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

  /** Normalise l'URL de base (ajoute https:// si manquant) */
  private normalizeBaseUrl(url: string): string | null {
    try {
      let u = url.trim()
      if (!/^https?:\/\//i.test(u)) {
        u = "https://" + u
      }
      const parsed = new URL(u)
      return parsed.origin
    } catch {
      return null
    }
  }

  /** Visite une page et extrait son contenu */
  private async visitPage(
    page: Page,
    url: string,
    pageType: VisitedPage["pageType"],
    depth: number
  ): Promise<{ page: VisitedPage; extraction: ReturnType<typeof extractContactsFromPage> } | null> {
    const startTime = Date.now()
    try {
      await this.rateLimiter.waitForNextSlot()
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: this.config.pageTimeout })

      // Attend un peu pour le rendu JS (certains sites sont SPA)
      // Sur la home, attend plus longtemps pour laisser les footers se charger
      const waitMs = depth === 0 ? 3000 : 1500
      await humanDelay(waitMs, waitMs + 1500)

      // Tente de scroller jusqu'en bas pour charger le footer (souvent lazy-loaded)
      if (depth === 0) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {})
        await humanDelay(1000, 2000)
      }

      const status = page.url() === "about:blank" ? 0 : 200 // Playwright ne donne pas directement le status
      const title = await page.title().catch(() => "")
      const loadTimeMs = Date.now() - startTime

      // Récupère HTML, texte et liens en une seule évaluation (plus rapide)
      const pageData = await page.evaluate(() => {
        const html = document.documentElement.outerHTML
        const text = document.body?.innerText || ""
        // Récupère TOUS les liens (footer et ailleurs)
        const links: Array<{ text: string; href: string; inFooter: boolean }> = []
        const footerEls = document.querySelectorAll("footer, [role='contentinfo'], .footer, #footer")
        const footerSet = new Set<Element>()
        footerEls.forEach((f) => f.querySelectorAll("a").forEach((a) => footerSet.add(a)))

        document.querySelectorAll("a[href]").forEach((a) => {
          const link = a as HTMLAnchorElement
          const href = link.href // absolu
          const text = (link.textContent || link.getAttribute("aria-label") || "").trim()
          if (href && !href.startsWith("javascript:") && !href.startsWith("#")) {
            links.push({ text, href, inFooter: footerSet.has(link) })
          }
        })
        return { html, text: text.slice(0, 50000), links }
      })

      const visitedPage: VisitedPage = {
        url: page.url(),
        requestedUrl: url,
        title: title || undefined,
        pageType,
        status,
        loadTimeMs,
        depth,
      }

      this.emit({
        type: "ws-page-loaded",
        url: page.url(),
        title,
        loadTimeMs,
        status,
      } as WebsiteScrapeEvent)

      const extraction = extractContactsFromPage({
        url: page.url(),
        html: pageData.html,
        text: pageData.text,
        links: pageData.links,
      })

      return { page: visitedPage, extraction }
    } catch (err) {
      const loadTimeMs = Date.now() - startTime
      this.emit({
        type: "ws-error",
        message: `Erreur visite ${url}: ${(err as Error).message}`,
        url,
      } as WebsiteScrapeEvent)

      return {
        page: {
          url,
          requestedUrl: url,
          pageType,
          status: 0,
          loadTimeMs,
          depth,
          error: (err as Error).message,
        },
        extraction: {
          emails: [],
          phones: [],
          whatsapp: [],
          socials: [],
          addresses: [],
          gps: [],
          links: [],
        },
      }
    }
  }

  /** Découvre les liens du footer (Contact, About, Mentions, etc.) */
  private async discoverFooterLinks(page: Page, baseUrl: string): Promise<Array<{ text: string; url: string }>> {
    const baseDomain = new URL(baseUrl).hostname.replace(/^www\./, "")

    return await page.evaluate(({ domain }) => {
      const footerEls = document.querySelectorAll("footer, [role='contentinfo'], .footer, #footer, footer *")
      const links: Array<{ text: string; url: string }> = []
      const seen = new Set<string>()

      const isSameDomain = (url: string) => {
        try {
          const u = new URL(url)
          const host = u.hostname.replace(/^www\./, "")
          // Accepte le domaine exact et ses sous-domaines
          return host === domain || host.endsWith("." + domain)
        } catch {
          return false
        }
      }

      footerEls.forEach((el) => {
        const anchors = el.tagName === "A" ? [el] : el.querySelectorAll("a")
        anchors.forEach((a) => {
          const link = a as HTMLAnchorElement
          const href = link.href
          const text = (link.textContent || "").trim()
          // Filtre : même domaine, pas javascript/#, pas déjà vu
          if (
            href && text &&
            !href.startsWith("javascript:") &&
            !href.startsWith("#") &&
            !href.startsWith("mailto:") &&
            !href.startsWith("tel:") &&
            !seen.has(href) &&
            isSameDomain(href)
          ) {
            seen.add(href)
            links.push({ text, url: href })
          }
        })
      })

      // Si footer vide, prend tous les liens de la page (même domaine seulement)
      if (links.length === 0) {
        document.querySelectorAll("a[href]").forEach((a) => {
          const link = a as HTMLAnchorElement
          const href = link.href
          const text = (link.textContent || "").trim()
          if (
            href && text &&
            !href.startsWith("javascript:") &&
            !href.startsWith("#") &&
            !href.startsWith("mailto:") &&
            !href.startsWith("tel:") &&
            !seen.has(href) &&
            isSameDomain(href)
          ) {
            seen.add(href)
            links.push({ text, url: href })
          }
        })
      }

      return links.slice(0, 50)
    }, { domain: baseDomain })
  }

  /** Sélectionne les pages à visiter selon leur type détecté */
  private selectPagesToVisit(
    footerLinks: Array<{ text: string; url: string }>,
    query: WebsiteSearchQuery
  ): Array<{ url: string; pageType: VisitedPage["pageType"] }> {
    const selected: Array<{ url: string; pageType: VisitedPage["pageType"] }> = []
    const seenUrls = new Set<string>()
    const requestedTypes = query.pageTypes || ["contact", "about", "legal"]

    // Parcourt les liens du footer et identifie les pages clés
    for (const link of footerLinks) {
      const pageType = detectPageType(link.url, link.text)
      if (
        requestedTypes.includes(pageType) &&
        !seenUrls.has(link.url) &&
        selected.length < (query.maxPages || 8)
      ) {
        selected.push({ url: link.url, pageType })
        seenUrls.add(link.url)
      }
    }

    // Si pas assez de pages trouvées, tente des URLs standard
    const base = new URL(footerLinks[0]?.url || query.url).origin
    const standardUrls: Array<{ url: string; pageType: VisitedPage["pageType"] }> = [
      { url: `${base}/contact`, pageType: "contact" },
      { url: `${base}/contact-us`, pageType: "contact" },
      { url: `${base}/nous-contacter`, pageType: "contact" },
      { url: `${base}/about`, pageType: "about" },
      { url: `${base}/a-propos`, pageType: "about" },
      { url: `${base}/qui-sommes-nous`, pageType: "about" },
      { url: `${base}/mentions-legales`, pageType: "legal" },
      { url: `${base}/mentions`, pageType: "legal" },
    ]

    for (const std of standardUrls) {
      if (
        !seenUrls.has(std.url) &&
        requestedTypes.includes(std.pageType) &&
        selected.length < (query.maxPages || 8)
      ) {
        // Tente seulement si l'URL n'a pas déjà été détectée dans le footer
        // On ne peut pas vérifier l'existence sans visite, donc on ajoute
        selected.push(std)
        seenUrls.add(std.url)
      }
    }

    return selected.slice(0, query.maxPages || 8)
  }

  /** Fusionne les extractions d'une page dans l'objet data global */
  private mergeExtraction(data: WebsiteScrapedData, extraction: ReturnType<typeof extractContactsFromPage>): void {
    // Emails
    for (const email of extraction.emails) {
      if (!data.emails.find((e) => e.email === email.email)) {
        data.emails.push(email)
      }
    }

    // Phones
    for (const phone of extraction.phones) {
      if (!data.phones.find((p) => p.normalized === phone.normalized)) {
        data.phones.push(phone)
      }
    }

    // WhatsApp
    for (const wa of extraction.whatsapp) {
      if (!data.whatsapp?.find((w) => w.normalized === wa.normalized)) {
        if (!data.whatsapp) data.whatsapp = []
        data.whatsapp.push(wa)
      }
    }

    // Socials
    for (const social of extraction.socials) {
      if (!data.socialLinks.find((s) => s.url === social.url)) {
        data.socialLinks.push(social)
      }
    }

    // Google Maps
    if (!data.googleMapsUrl && extraction.googleMapsUrl) {
      data.googleMapsUrl = extraction.googleMapsUrl
    }

    // Adresses
    for (const addr of extraction.addresses) {
      if (!data.addresses.includes(addr)) {
        data.addresses.push(addr)
      }
    }

    // GPS
    if (!data.gps) data.gps = []
    for (const g of extraction.gps) {
      if (!data.gps.find((x) => x.lat === g.lat && x.lng === g.lng)) {
        data.gps.push(g)
      }
    }
  }

  /** Déduplique et nettoie les contacts finaux */
  private deduplicateContacts(data: WebsiteScrapedData): void {
    // Tri emails par priorité (mailto d'abord, puis texte)
    data.emails.sort((a, b) => {
      if (a.fromMailtoLink && !b.fromMailtoLink) return -1
      if (!a.fromMailtoLink && b.fromMailtoLink) return 1
      return a.email.localeCompare(b.email)
    })

    // Tri phones (tel: d'abord)
    data.phones.sort((a, b) => {
      if (a.fromTelLink && !b.fromTelLink) return -1
      if (!a.fromTelLink && b.fromTelLink) return 1
      return 0
    })

    // Tri socials par plateforme
    const order = { whatsapp: 0, facebook: 1, instagram: 2, linkedin: 3, twitter: 4, youtube: 5, tiktok: 6, telegram: 7 }
    data.socialLinks.sort((a, b) => (order[a.platform] ?? 99) - (order[b.platform] ?? 99))

    // Limite le nombre d'adresses
    data.addresses = data.addresses.slice(0, 5)

    // Compte WhatsApp comme phone aussi (pour le total)
    if (data.whatsapp) {
      for (const wa of data.whatsapp) {
        if (!data.phones.find((p) => p.normalized === wa.normalized)) {
          data.phones.push(wa)
        }
      }
    }
  }
}
