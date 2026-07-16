/**
 * Types du moteur de scraping Google Maps
 */

/** Critères de recherche géographique */
export interface SearchQuery {
  keyword: string // ex: "restaurant", "pharmacie"
  city?: string // ex: "Abidjan"
  commune?: string // ex: "Cocody"
  neighborhood?: string // ex: "Riviera 2"
  /** Pays code ISO, défaut CI */
  country?: string
  /** Nombre max de résultats à extraire */
  maxResults?: number
  /** Langue de l'UI Google, défaut fr */
  language?: string
}

/** Coordonnées GPS */
export interface GpsCoordinates {
  lat: number
  lng: number
}

/** Horaire d'ouverture (un jour) */
export interface DayHours {
  day: string
  hours: string // ex: "09:00–18:00" ou "Fermé"
}

/** Un avis client (extrait) */
export interface Review {
  author: string
  rating: number
  text: string
  date: string
}

/** Une photo extraite */
export interface Photo {
  url: string
  width?: number
  height?: number
  alt?: string
}

/** Résultat complet d'une entreprise extraite de Google Maps */
export interface ScrapedPlace {
  /** Identifiant Google (place_id ChIJ...) */
  placeId?: string
  name: string
  category?: string
  address?: string
  phone?: string
  phoneNormalized?: string // format international +225...
  email?: string
  website?: string
  gps?: GpsCoordinates
  rating?: number
  reviewCount?: number
  priceLevel?: string // $, $$, $$$
  hours?: DayHours[]
  isOpenNow?: boolean
  photos?: Photo[]
  reviews?: Review[]
  sourceUrl?: string
  scrapedAt: string
}

/** Configuration du scraper */
export interface ScraperConfig {
  /** Mode headless (défaut true) */
  headless?: boolean
  /** Proxy rotation list */
  proxies?: string[]
  /** User-agent custom (sinon rotate) */
  userAgent?: string
  /** Délai min entre actions (ms) */
  minDelay?: number
  /** Délai max entre actions (ms) */
  maxDelay?: number
  /** Délai entre chaque scroll (ms) */
  scrollDelay?: number
  /** Nombre max de scrolls sur la liste */
  maxScrolls?: number
  /** Timeout global par page (ms) */
  pageTimeout?: number
  /** Concurrency (nombre de pages détail en parallèle) */
  concurrency?: number
  /** Retry attempts sur erreur réseau */
  retries?: number
  /** Backoff initial (ms) */
  backoffMs?: number
  /** Extraction des reviews (lent) */
  extractReviews?: boolean
  /** Nombre max de reviews à extraire par lieu */
  maxReviews?: number
  /** Extraction des photos */
  extractPhotos?: boolean
  /** Nombre max de photos par lieu */
  maxPhotos?: number
  /** Dossier de persistance du contexte navigateur (session) */
  storageStatePath?: string
  /** Activer le mode stealth */
  stealth?: boolean
  /** Locale du navigateur */
  locale?: string
  /** Timezone */
  timezone?: string
}

/** État d'avancement du scraping */
export interface ScrapeProgress {
  jobId: string
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  phase: "init" | "searching" | "listing" | "extracting" | "deduplicating" | "done"
  progress: number // 0-100
  resultsCount: number
  processedCount: number
  duplicatesDetected: number
  errors: string[]
  startedAt: string
  estimatedEndAt?: string
  currentPlace?: string
}

/** Événements émis pendant le scraping */
export type ScrapeEvent =
  | { type: "start"; jobId: string; query: SearchQuery }
  | { type: "search-loaded"; resultsOnPage: number }
  | { type: "scroll"; scrollIndex: number; totalResults: number }
  | { type: "place-extracted"; place: ScrapedPlace; index: number }
  | { type: "duplicate-detected"; place: ScrapedPlace; duplicateOf: string }
  | { type: "block-detected"; reason: string; retrying: boolean }
  | { type: "error"; message: string; recoverable: boolean }
  | { type: "progress"; progress: number; phase: ScrapeProgress["phase"] }
  | { type: "complete"; results: ScrapedPlace[]; duplicates: number; durationMs: number }
  | { type: "cancelled" }

/** Callback d'événement */
export type ScrapeEventListener = (event: ScrapeEvent) => void

/** Résultat final d'un job de scraping */
export interface ScrapeResult {
  jobId: string
  query: SearchQuery
  status: "completed" | "failed" | "cancelled"
  places: ScrapedPlace[]
  duplicates: DuplicateGroup[]
  stats: {
    totalExtracted: number
    uniqueCount: number
    duplicatesCount: number
    durationMs: number
    pagesScraped: number
    blocksEncountered: number
    retries: number
  }
  errors: string[]
  startedAt: string
  completedAt: string
}

/** Groupe de doublons détectés */
export interface DuplicateGroup {
  canonicalId: string
  canonicalName: string
  duplicates: Array<{
    id: string
    name: string
    similarity: number
    reason: string
  }>
  confidence: number
}
