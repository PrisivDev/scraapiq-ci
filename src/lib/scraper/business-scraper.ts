/**
 * Moteur d'identification d'entreprises — LinkedIn + fallbacks
 *
 * Architecture :
 *  1. Lance Chromium avec cookies LinkedIn optionnels (li_at)
 *  2. Si linkedinSlug/URL fourni → scrape direct de la page
 *     Sinon → recherche LinkedIn par nom + localisation
 *  3. Extrait : nom, secteur, taille, type, fondation, spécialités,
 *     description, site, téléphone, localisation, dirigeants, employés
 *  4. Déduplique
 *
 * Sans cookies : fonctionne pour les grandes entreprises publiques
 * Avec cookies (li_at) : fonctionne pour toutes les entreprises
 *
 * Fallbacks (si enableFallbacks) :
 *  - Google search "company name + dirigeant"
 *  - Pages Jaunes / annuaires en ligne
 *  - Registre RCCM (CI)
 */

import { chromium, type Browser, type BrowserContext, type Page, type Route } from "playwright"
import type {
  BusinessSearchQuery,
  BusinessScraperConfig,
  BusinessEntity,
  BusinessScrapeEvent,
  BusinessPerson,
  LinkedInCookie,
} from "./business-types"
import {
  parseLinkedInCookies,
  validateLinkedInCookies,
  guessLinkedinSlug,
  parseCount,
  parseYear,
} from "./business-types"
import { normalizePhone, normalizeEmail, normalizeUrl } from "./normalize"
import { deduplicatePlaces } from "./dedup"
import { detectLinkedInBlock, LinkedInBlockError } from "./linkedin-block-detector"
import { RateLimiter, randomUserAgent, humanDelay, exponentialBackoff } from "./rate-limiter"
import type { ScrapeEvent, ScrapeResult, Photo } from "./types"

const LINKEDIN_MOBILE = "https://m.linkedin.com"
const LINKEDIN_DESKTOP = "https://www.linkedin.com"

const MOBILE_UAS = [
  "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
]

interface ListedCompany {
  name: string
  slug: string
  url: string
  industry?: string
  location?: string
}

export class BusinessScraper {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private config: Required<BusinessScraperConfig>
  private listeners: ((event: BusinessScrapeEvent | ScrapeEvent) => void)[] = []
  private rateLimiter: RateLimiter
  private cancelled = false
  private cookies: LinkedInCookie[] = []

  constructor(config: BusinessScraperConfig = {}) {
    this.config = {
      headless: config.headless ?? true,
      cookies: config.cookies ?? "",
      userAgent: config.userAgent ?? "",
      minDelay: config.minDelay ?? 1500,
      maxDelay: config.maxDelay ?? 3500,
      pageTimeout: config.pageTimeout ?? 30000,
      retries: config.retries ?? 2,
      backoffMs: config.backoffMs ?? 3000,
      mobileVersion: config.mobileVersion ?? false, // desktop fonctionne mieux pour les pages company publiques
      enableFallbacks: config.enableFallbacks ?? true,
    }
    this.rateLimiter = new RateLimiter(this.config.minDelay, 10) // LinkedIn très restrictif
    this.cookies = parseLinkedInCookies(this.config.cookies)
  }

  on(listener: (event: BusinessScrapeEvent | ScrapeEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private emit(event: BusinessScrapeEvent | ScrapeEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error("[biz-scraper] listener error:", err)
      }
    }
  }

  cancel(): void {
    this.cancelled = true
    this.emit({ type: "cancelled" })
  }

  /**
   * Lance un job d'identification d'entreprise
   */
  async scrape(jobId: string, query: BusinessSearchQuery): Promise<ScrapeResult> {
    const startedAt = new Date()
    this.cancelled = false
    let blocksEncountered = 0
    let retries = 0
    let pagesScraped = 0
    const errors: string[] = []

    this.emit({ type: "start", jobId, query: query as unknown as Record<string, unknown> } as ScrapeEvent)

    try {
      // 0. Validation cookies
      if (this.cookies.length > 0) {
        const validation = validateLinkedInCookies(this.cookies)
        if (!validation.valid) {
          this.emit({
            type: "biz-error",
            message: `Cookies LinkedIn manquants: ${validation.missing.join(", ")}`,
          } as BusinessScrapeEvent)
        }
      } else {
        this.emit({
          type: "biz-error",
          message: "Aucun cookie LinkedIn fourni. Le scraping fonctionnera uniquement pour les grandes entreprises publiques.",
        } as BusinessScrapeEvent)
      }

      // 1. Init navigateur
      await this.initBrowser()
      this.emit({ type: "progress", progress: 5, phase: "init" } as ScrapeEvent)

      const page = await this.context!.newPage()
      await this.configurePage(page)

      // 2. Détermine la liste des entreprises à scraper
      let companiesToScrape: ListedCompany[] = []

      if (query.linkedinUrl) {
        // URL directe fournie
        const slug = this.extractSlugFromUrl(query.linkedinUrl)
        companiesToScrape = [{ name: slug, slug, url: query.linkedinUrl }]
      } else if (query.linkedinSlug) {
        // Slug fourni
        const base = this.config.mobileVersion ? LINKEDIN_MOBILE : LINKEDIN_DESKTOP
        companiesToScrape = [{
          name: query.linkedinSlug,
          slug: query.linkedinSlug,
          url: `${base}/company/${query.linkedinSlug}/`,
        }]
      } else if (query.query) {
        // Recherche par mot-clé
        this.emit({ type: "progress", progress: 10, phase: "searching" } as ScrapeEvent)
        companiesToScrape = await this.searchCompanies(page, query)
        pagesScraped++

        if (companiesToScrape.length === 0) {
          // Fallback : essaye le slug deviné
          const guessedSlug = guessLinkedinSlug(query.query)
          this.emit({
            type: "biz-fallback",
            source: "linkedin-slug-guess",
            reason: `Aucun résultat de recherche, tentative directe avec slug "${guessedSlug}"`,
          } as BusinessScrapeEvent)
          const base = this.config.mobileVersion ? LINKEDIN_MOBILE : LINKEDIN_DESKTOP
          companiesToScrape = [{
            name: query.query,
            slug: guessedSlug,
            url: `${base}/company/${guessedSlug}/`,
          }]
        }

        this.emit({
          type: "biz-search-loaded",
          resultsCount: companiesToScrape.length,
        } as BusinessScrapeEvent)
      }

      this.emit({ type: "progress", progress: 25, phase: "listing" } as ScrapeEvent)

      // 3. Extraction détaillée
      const entities: BusinessEntity[] = []
      const total = Math.min(companiesToScrape.length, 5) // max 5 entreprises par job

      for (let i = 0; i < total && !this.cancelled; i++) {
        const companyInfo = companiesToScrape[i]
        try {
          this.emit({
            type: "progress",
            progress: 25 + Math.floor((i / total) * 65),
            phase: "extracting",
          } as ScrapeEvent)

          const entity = await this.extractCompanyDetails(page, companyInfo, query)
          if (entity) {
            entities.push(entity)
            this.emit({ type: "biz-extracted", entity, index: i } as BusinessScrapeEvent)

            this.emit({
              type: "biz-people-found",
              executivesCount: entity.executives?.length || 0,
              employeesCount: entity.employees?.length || 0,
            } as BusinessScrapeEvent)
          }
        } catch (err) {
          const msg = `Erreur extraction ${companyInfo.name}: ${(err as Error).message}`
          errors.push(msg)
          this.emit({
            type: "biz-error",
            message: msg,
            companyName: companyInfo.name,
          } as BusinessScrapeEvent)
        }

        await humanDelay(this.config.minDelay, this.config.maxDelay)
      }

      // 4. Déduplication
      this.emit({ type: "progress", progress: 92, phase: "deduplicating" } as ScrapeEvent)
      const { unique, duplicates } = deduplicatePlaces(entities)

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
          totalExtracted: entities.length,
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
    const isMobile = this.config.mobileVersion

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
      },
    })

    // Stealth
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false })
      // @ts-expect-error - delete on window
      delete (window as unknown as Record<string, unknown>).__playwright
    })

    // Injecte les cookies LinkedIn si fournis
    if (this.cookies.length > 0) {
      const cookieObjects = this.cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        httpOnly: ["li_at", "JSESSIONID", "liap", "bcookie", "bscookie"].includes(c.name),
        secure: true,
        sameSite: "Lax" as const,
      }))
      await this.context.addCookies(cookieObjects)
    }

    // Pré-charge LinkedIn pour valider les cookies UNIQUEMENT si cookies fournis
    // (sans cookies, le pré-chargement pose des cookies d'authwall qui bloquent ensuite les pages company)
    if (this.cookies.length > 0) {
      const initPage = await this.context.newPage()
      try {
        await this.rateLimiter.waitForNextSlot()
        const base = this.config.mobileVersion ? LINKEDIN_MOBILE : LINKEDIN_DESKTOP
        await initPage.goto(base, { waitUntil: "domcontentloaded", timeout: this.config.pageTimeout })
        await humanDelay(1000, 2000)
      } catch {
        // ignore
      } finally {
        await initPage.close()
      }
    }
  }

  private async configurePage(page: Page): Promise<void> {
    page.setDefaultTimeout(this.config.pageTimeout)

    await page.route("**/*", (route: Route) => {
      const type = route.request().resourceType()
      const url = route.request().url()

      if (["media", "font"].includes(type)) {
        return route.abort()
      }
      // Bloque trackers et analytics LinkedIn
      if (
        url.includes("doubleclick.net") ||
        url.includes("google-analytics") ||
        url.includes("ads.linkedin.com") ||
        url.includes("px.ads.linkedin.com") ||
        url.includes("snap.licdn.com")
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

  private extractSlugFromUrl(url: string): string {
    try {
      const u = new URL(url)
      const parts = u.pathname.split("/").filter(Boolean)
      // /company/slug/ → parts = ['company', 'slug']
      const companyIdx = parts.indexOf("company")
      return parts[companyIdx + 1] || parts[parts.length - 1] || "company"
    } catch {
      return "company"
    }
  }

  /**
   * Recherche d'entreprises LinkedIn par mot-clé
   */
  private async searchCompanies(page: Page, query: BusinessSearchQuery): Promise<ListedCompany[]> {
    const q = query.location ? `${query.query} ${query.location}` : query.query
    const searchUrl = `${this.config.mobileVersion ? LINKEDIN_MOBILE : LINKEDIN_DESKTOP}/search/results/companies/?keywords=${encodeURIComponent(q)}`

    let loaded = false
    for (let attempt = 0; attempt < this.config.retries && !loaded && !this.cancelled; attempt++) {
      try {
        await this.rateLimiter.waitForNextSlot()
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: this.config.pageTimeout })
        await humanDelay(2500, 4000)

        const block = await detectLinkedInBlock(page)
        if (block.blocked) {
          if (block.recoverable) {
            await exponentialBackoff(attempt, this.config.backoffMs)
            retries++
            continue
          }
          // Non récupérable (auth, captcha) → fallback avec slug deviné
          this.emit({
            type: "biz-fallback",
            source: "slug-guess",
            reason: `Recherche bloquée (${block.reason}), tentative directe avec slug deviné`,
          } as BusinessScrapeEvent)
          return []
        }

        loaded = true
      } catch (err) {
        retries++
        if (attempt === this.config.retries - 1) {
          this.emit({
            type: "biz-error",
            message: `Recherche échouée: ${(err as Error).message}`,
          } as BusinessScrapeEvent)
          return []
        }
        await exponentialBackoff(attempt, this.config.backoffMs)
      }
    }

    if (!loaded) return []

    // Parse les résultats de recherche
    return await this.parseSearchResults(page)
  }

  private async parseSearchResults(page: Page): Promise<ListedCompany[]> {
    const results: ListedCompany[] = []
    const seen = new Set<string>()

    // Liens vers les pages company
    const links = await page.$$('a[href*="/company/"]').catch(() => [])
    for (const link of links) {
      if (results.length >= 10) break
      try {
        const href = await link.getAttribute("href") || ""
        if (!href) continue

        // Extrait le slug
        const slugMatch = href.match(/\/company\/([^/?#]+)/)
        if (!slugMatch) continue
        const slug = slugMatch[1]
        if (slug === "anonymous" || seen.has(slug)) continue
        seen.add(slug)

        const name = (await link.textContent()?.trim()) || slug
        if (name.length < 2) continue

        const base = this.config.mobileVersion ? LINKEDIN_MOBILE : LINKEDIN_DESKTOP
        results.push({
          name,
          slug,
          url: `${base}/company/${slug}/`,
        })
      } catch {
        // skip
      }
    }

    return results
  }

  /**
   * Extrait tous les détails d'une page entreprise LinkedIn
   */
  private async extractCompanyDetails(
    page: Page,
    companyInfo: ListedCompany,
    query: BusinessSearchQuery
  ): Promise<BusinessEntity | null> {
    const entity: BusinessEntity = {
      name: companyInfo.name,
      linkedinSlug: companyInfo.slug,
      linkedinUrl: companyInfo.url,
      source: "linkedin",
      scrapedAt: new Date().toISOString(),
      sourceUrl: companyInfo.url,
      executives: [],
      employees: [],
    }

    try {
      // 1. Navigue vers la page entreprise
      await this.rateLimiter.waitForNextSlot()
      await page.goto(companyInfo.url, { waitUntil: "domcontentloaded", timeout: this.config.pageTimeout })
      await humanDelay(3000, 5000) // LinkedIn est lourd à rendre

      // Vérifie blocage
      const block = await detectLinkedInBlock(page)
      if (block.blocked) {
        this.emit({
          type: "biz-error",
          message: `Page ${companyInfo.name} bloquée: ${block.message}`,
          companyName: companyInfo.name,
        } as BusinessScrapeEvent)
        return null
      }

      this.emit({
        type: "biz-page-loaded",
        companyName: companyInfo.name,
        linkedinUrl: companyInfo.url,
      } as BusinessScrapeEvent)

      // 2. Clic sur les boutons "Voir plus" pour déplier les sections
      try {
        const buttons = await page.$$("button").catch(() => [])
        for (const btn of buttons) {
          const txt = (await btn.textContent()?.catch(() => "")) || ""
          if (
            (txt.toLowerCase().includes("voir plus") ||
              txt.toLowerCase().includes("see more") ||
              txt.toLowerCase().includes("show more")) &&
            txt.length < 30
          ) {
            await btn.click({ timeout: 2000 }).catch(() => {})
            await humanDelay(1000, 1500)
          }
        }
      } catch {
        // ignore
      }

      // 3. Scroll pour charger la section employés
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {})
      await humanDelay(1500, 2500)

      // 4. Extraction principale
      const extracted = await page.evaluate(() => {
        const result: Record<string, unknown> = {}

        // Nom — h1
        const h1 = document.querySelector("h1")
        result.name = h1?.textContent?.trim() || undefined

        // Secteur — premier h2
        const h2s = document.querySelectorAll("h2")
        if (h2s[0]) result.industry = h2s[0].textContent?.trim()

        // Localisation + followers — premier h3
        const h3s = document.querySelectorAll("h3")
        if (h3s[0]) {
          const h3Text = h3s[0].textContent?.trim() || ""
          result.locationAndFollowers = h3Text
          // Parse followers
          const followersMatch = h3Text.match(/([\d\s,.]+[kKmM]?)\s*(?:abonnés|followers)/i)
          if (followersMatch) result.followersText = followersMatch[1]
        }

        // Definition lists (taille, type, fondation, spécialités)
        const dls = document.querySelectorAll("dl")
        const fields: Record<string, string> = {}
        dls.forEach((dl) => {
          const dts = dl.querySelectorAll("dt")
          const dds = dl.querySelectorAll("dd")
          dts.forEach((dt, i) => {
            const key = dt.textContent?.trim() || ""
            const dd = dds[i]
            const val = dd?.textContent?.trim() || ""
            if (key && val && val.length < 500) fields[key] = val
          })
        })
        result.dlFields = fields

        // Description / À propos
        const aboutH2 = Array.from(document.querySelectorAll("h2")).find(
          (h) => h.textContent?.includes("À propos") || h.textContent?.includes("About")
        )
        if (aboutH2) {
          // Le contenu est dans le parent ou le frère suivant
          const parent = aboutH2.closest("section") || aboutH2.parentElement
          if (parent) {
            const text = parent.textContent?.trim() || ""
            // Retire le titre "À propos" du début
            result.about = text.replace(/^À propos\s*/, "").replace(/^About\s*/, "").slice(0, 2000)
          }
        }
        // Fallback : tagline (p sous h1)
        if (!result.about && h1) {
          const tagline = h1.parentElement?.querySelector("p, span")?.textContent?.trim()
          if (tagline) result.tagline = tagline
        }

        // Site web — lien externe non LinkedIn
        const externalLinks = document.querySelectorAll("a[href]")
        for (const a of externalLinks) {
          const href = (a as HTMLAnchorElement).href || ""
          if (
            href &&
            !href.includes("linkedin.com") &&
            !href.includes("lnkd.in") &&
            !href.includes("mailto:") &&
            !href.includes("tel:") &&
            (href.startsWith("http://") || href.startsWith("https://"))
          ) {
            result.website = href
            break
          }
        }

        // ===== EMPLOYÉS / DIRIGEANTS =====
        // Section "Employés chez X" ou "People at X"
        const peopleSection = Array.from(document.querySelectorAll("section, div")).find((el) => {
          const t = (el as HTMLElement).textContent || ""
          return (
            (t.includes("Employés chez") || t.includes("People at") || t.includes("employees at")) &&
            t.length < 5000 // section, pas toute la page
          )
        })

        const allProfileLinks = peopleSection
          ? peopleSection.querySelectorAll("a[href*='/in/']")
          : document.querySelectorAll("a[href*='/in/']")

        const people: Array<{
          name: string
          title: string
          profileUrl: string
          photoUrl?: string
        }> = []

        allProfileLinks.forEach((a) => {
          const link = a as HTMLAnchorElement
          const name = link.textContent?.trim() || ""
          const href = link.href
          if (!name || name.length < 2 || name.length > 100 || name.includes("Voir")) return

          // Cherche le titre dans le parent proche
          let title = ""
          const parent = link.closest("li, div, section, article")
          if (parent) {
            // Le titre est souvent dans un élément frère avec une classe spécifique
            const titleCandidates = parent.querySelectorAll("span, p, h3, h4, div.t-14, div.t-black--light")
            for (const t of titleCandidates) {
              const tx = (t as HTMLElement).textContent?.trim() || ""
              if (tx && tx !== name && tx.length > 3 && tx.length < 200 && !tx.includes("Voir") && !tx.includes("abonné")) {
                title = tx
                break
              }
            }
          }

          // Photo de profil
          const parent2 = link.closest("li, div, section, article")
          const img = parent2?.querySelector("img") as HTMLImageElement | null
          const photoUrl = img?.src && img.src.includes("licdn") ? img.src : undefined

          people.push({ name, title: title.slice(0, 200), profileUrl: href, photoUrl })
        })

        result.people = people.slice(0, 20) // max 20 personnes

        // Images (logo + photos)
        const imgs = document.querySelectorAll("img[src*='licdn'], img[src*='linkedin']")
        const images: Array<{ url: string; alt?: string }> = []
        imgs.forEach((el) => {
          if (images.length >= 3) return
          const img = el as HTMLImageElement
          if (img.src && img.naturalWidth > 50) {
            images.push({ url: img.src, alt: img.alt })
          }
        })
        result.images = images

        return result
      }).catch(() => ({}))

      // 5. Mapping vers BusinessEntity
      if (extracted.name) entity.name = extracted.name as string
      entity.sector = (extracted.industry as string) || undefined
      entity.category = entity.sector // alias pour compat

      if (extracted.locationAndFollowers) {
        const locText = extracted.locationAndFollowers as string
        // Parse localisation (avant "X abonnés")
        const locMatch = locText.match(/^(.+?)\s+\d/)
        if (locMatch) entity.location = locMatch[1].trim()
      }

      // Champs DL (taille, type, fondation, spécialités)
      const dlFields = (extracted.dlFields as Record<string, string>) || {}
      // Taille
      const sizeKey = Object.keys(dlFields).find((k) =>
        k.toLowerCase().includes("taille") || k.toLowerCase().includes("size")
      )
      if (sizeKey) {
        entity.companySize = dlFields[sizeKey]
        // Parse employee count depuis "+ de 10 000 employés"
        const empMatch = entity.companySize.match(/(\d[\d\s.]*)\s*(?:employés|employees)/i)
        if (empMatch) {
          const num = parseCount(empMatch[1])
          entity.employeesOnLinkedin = num
        }
      }
      // Type
      const typeKey = Object.keys(dlFields).find((k) =>
        k.toLowerCase().includes("type") && !k.toLowerCase().includes("type de") || k.toLowerCase() === "type"
      )
      if (typeKey) entity.companyType = dlFields[typeKey]
      // Fondation
      const foundedKey = Object.keys(dlFields).find((k) =>
        k.toLowerCase().includes("fondé") || k.toLowerCase().includes("founded")
      )
      if (foundedKey) {
        entity.foundedYear = parseYear(dlFields[foundedKey])
      }
      // Spécialités
      const specKey = Object.keys(dlFields).find((k) =>
        k.toLowerCase().includes("spécial") || k.toLowerCase().includes("special")
      )
      if (specKey) {
        entity.specialties = dlFields[specKey].split(/[,\n·]/).map((s) => s.trim()).filter(Boolean).slice(0, 10)
      }

      // Description
      if (extracted.about) {
        entity.description = (extracted.about as string).slice(0, 1500)
      } else if (extracted.tagline) {
        entity.description = extracted.tagline as string
      }

      // Site web
      if (extracted.website) {
        entity.website = normalizeUrl(extracted.website as string) || undefined
      }

      // Followers
      if (extracted.followersText) {
        entity.followersCount = parseCount(extracted.followersText as string)
      }

      // People → dirigeants + employés
      const people = (extracted.people as Array<{ name: string; title: string; profileUrl: string; photoUrl?: string }>) || []
      const executives: BusinessPerson[] = []
      const employees: BusinessPerson[] = []

      // Heuristique pour distinguer dirigeants d'employés :
      // les dirigeants ont un titre contenant CEO, CFO, CTO, Director, Président, Directeur, Founder, Founder & CEO, etc.
      const execKeywords = [
        "ceo", "cfo", "cto", "coo", "cmo", "cio", "chro",
        "directeur", "directrice", "président", "presidente", "president",
        "founder", "co-founder", "cofondateur", "fondateur", "co-fondateur",
        "managing director", "gérant", "gérante", "owner", "proprio",
        "chairman", "vice president", "vp ", "head of",
      ]

      for (const p of people) {
        const lowerTitle = p.title.toLowerCase()
        const isExec = execKeywords.some((k) => lowerTitle.includes(k))
        const person: BusinessPerson = {
          name: p.name,
          title: p.title || undefined,
          linkedinUrl: p.profileUrl,
          photoUrl: p.photoUrl,
          role: isExec ? "executive" : "employee",
        }
        if (isExec) {
          executives.push(person)
        } else {
          employees.push(person)
        }
      }

      entity.executives = executives
      entity.employees = query.extractEmployees !== false ? employees : []

      // Images
      if (extracted.images && Array.isArray(extracted.images)) {
        entity.photos = (extracted.images as Array<{ url: string; alt?: string }>).map((p) => ({
          url: p.url,
          alt: p.alt,
        })) as Photo[]
      }

      // Score d'identification
      let score = 0
      if (entity.name) score += 15
      if (entity.sector) score += 10
      if (entity.description) score += 15
      if (entity.location) score += 10
      if (entity.website) score += 10
      if (entity.companySize) score += 10
      if (entity.executives && entity.executives.length > 0) score += 15
      if (entity.employees && entity.employees.length > 0) score += 10
      if (entity.followersCount) score += 5
      entity.identificationScore = score

      // Lien Google Maps depuis localisation
      if (entity.location) {
        entity.gps = undefined // pas de GPS direct depuis LinkedIn
        entity.googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${entity.name} ${entity.location}`
        )}`
      }

      return entity
    } catch (err) {
      this.emit({
        type: "biz-error",
        message: `Erreur extraction ${companyInfo.name}: ${(err as Error).message}`,
        companyName: companyInfo.name,
      } as BusinessScrapeEvent)
      return null
    }
  }
}
