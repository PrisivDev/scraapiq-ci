"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Radar, Play, Square, RefreshCw, Download, MapPin, Phone, Mail, Globe,
  Star, Clock, Tag, Building2, AlertCircle, AlertTriangle, CheckCircle2,
  Loader2, XCircle, Eye, ChevronRight, ExternalLink, Activity, Sparkles,
  MessageCircle, BadgeCheck, Heart, Users, Briefcase, Crown, UserCheck, Award,
  Info, Link2, Navigation, Languages, ChevronDown, ChevronUp,
  Facebook, Instagram, Linkedin, Twitter, Youtube, Send, Share2, Hash,
  BrainCircuit, Wand2, Layers, GitMerge, Filter, TrendingUp, Database,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Engine = "google-maps" | "facebook" | "business" | "website" | "ai-cleaner"

/** Statut d'activité d'une entreprise (moteur IA Cleaner) */
type BusinessStatus = "active" | "closed" | "temporarily_closed" | "relocated" | "unknown"

/** Détail du score de qualité par dimension (moteur IA Cleaner) */
interface QualityBreakdown {
  completeness: number
  contactValidity: number
  nameQuality: number
  geoAccuracy: number
  sourceReliability: number
  freshness: number
  onlinePresence: number
}

/** Entité nettoyée par le moteur IA (étend ScrapedPlace) */
interface CleanedEntity extends ScrapedPlace {
  /** ID canonique généré après fusion */
  canonicalId?: string
  /** Nom nettoyé (sans suffixes légaux, espaces, etc.) */
  cleanedName?: string
  /** Noms alternatifs détectés (doublons fusionnés) */
  aliases?: string[]
  /** Téléphone corrigé et normalisé */
  cleanedPhone?: string
  /** Téléphone original (avant correction) */
  originalPhone?: string
  /** Téléphone corrigé (true si une correction a été appliquée) */
  phoneCorrected?: boolean
  /** Email corrigé */
  cleanedEmail?: string
  /** Email original */
  originalEmail?: string
  /** Email corrigé (true si correction appliquée) */
  emailCorrected?: boolean
  /** Email validé (syntaxe + domaine) */
  emailValid?: boolean
  /** Adresse normalisée */
  cleanedAddress?: string
  /** Adresse originale */
  originalAddress?: string
  /** Composantes d'adresse parsées */
  addressComponents?: {
    street?: string
    number?: string
    commune?: string
    city?: string
    region?: string
    postalCode?: string
    country?: string
  }
  /** Secteur d'activité détecté (normalisé) */
  detectedSector?: string
  /** Code secteur (NSE/NACE) */
  sectorCode?: string
  /** Mots-clés du secteur */
  sectorKeywords?: string[]
  /** Score de qualité global (0-100) */
  qualityScore?: number
  /** Détail du score par dimension */
  qualityBreakdown?: QualityBreakdown
  /** Statut d'activité */
  businessStatus?: BusinessStatus
  /** Indicateurs de fermeture détectés */
  closureIndicators?: string[]
  /** Informations complétées par l'IA */
  aiCompletions?: Array<{ field: string; value: string; confidence: number; source: string }>
  /** Sources qui ont contribué à cette fiche */
  sources?: string[]
  /** Nombre de fiches fusionnées */
  mergedCount?: number
  /** Métadonnées de nettoyage */
  cleaningMetadata?: {
    cleanedAt: string
    durationMs: number
    operations: string[]
    llmCalls: number
    confidence: number
  }
}

/** Groupe de doublons fusionnés par l'IA */
interface MergedGroup {
  canonicalId: string
  canonicalName: string
  mergedEntities: Array<{
    id: string
    name: string
    source: string
    similarity: number
    matchReason: string
  }>
  fusionConfidence: number
}

/** Correction appliquée par l'IA */
interface Correction {
  entityId: string
  fieldName: string
  oldValue: string
  newValue: string
  correctionType: "phone" | "email" | "address" | "name" | "sector"
  method: "deterministic" | "llm" | "rule"
  confidence: number
}

/** Rapport de nettoyage IA */
interface CleaningReport {
  jobId: string
  startedAt: string
  completedAt: string
  durationMs: number
  input: { totalEntities: number; sources: string[] }
  output: {
    cleanedEntities: number
    duplicatesRemoved: number
    fieldsCorrected: number
    fieldsCompleted: number
    sectorsDetected: number
    closedDetected: number
  }
  duplicates: MergedGroup[]
  corrections: Correction[]
  stats: {
    phoneCorrections: number
    emailCorrections: number
    addressNormalizations: number
    sectorDetections: number
    qualityScores: number[]
    avgQualityScore: number
    llmCalls: number
    llmTokensUsed: number
  }
}

/** État d'un job IA Cleaner (réponse GET /api/scraper/ai-cleaner/jobs/[id]) */
interface AICleanerJobState {
  id: string
  input: ScrapedPlace[]
  cleanedEntities: CleanedEntity[]
  report?: CleaningReport
  progress: {
    status: "queued" | "running" | "completed" | "failed" | "cancelled"
    progress: number
    phase: string
    processedCount: number
    errors: string[]
    startedAt: string
  }
  events: Array<{ type: string; [key: string]: unknown }>
  createdAt: string
}

interface ScrapedPlace {
  name: string
  category?: string
  address?: string
  phone?: string
  phoneNormalized?: string
  email?: string
  website?: string
  gps?: { lat: number; lng: number }
  rating?: number
  reviewCount?: number
  isOpenNow?: boolean
  hours?: Array<{ day: string; hours: string }>
  photos?: Array<{ url: string; alt?: string }>
  placeId?: string
  sourceUrl?: string
  scrapedAt: string
  // Champs additionnels utilisés par l'échantillon IA Cleaner et le backend
  id?: string
  sector?: string
  lat?: number
  lng?: number
  confidence?: number
  status?: string
  sources?: string[]
  // Facebook-specific
  pageName?: string
  pageUrl?: string
  messenger?: string
  whatsapp?: string
  googleMapsUrl?: string
  description?: string
  facebookId?: string
  likesCount?: number
  followersCount?: number
  isVerified?: boolean
  // Business/LinkedIn-specific
  linkedinSlug?: string
  linkedinUrl?: string
  companySize?: string
  companyType?: string
  foundedYear?: number
  specialties?: string[]
  executives?: Array<{
    name: string
    title?: string
    linkedinUrl?: string
    photoUrl?: string
    role: "executive"
    bio?: string
    location?: string
  }>
  employees?: Array<{
    name: string
    title?: string
    linkedinUrl?: string
    photoUrl?: string
    role: "employee"
  }>
  employeesOnLinkedin?: number
  identificationScore?: number
  // Website Robot-specific (les champs ci-dessous sont renseignés par le moteur website)
  siteUrl?: string
  siteName?: string
  metaDescription?: string
  language?: string
  logoUrl?: string
  visitedPages?: Array<{
    url: string
    requestedUrl: string
    title?: string
    pageType: string
    status: number
    loadTimeMs: number
    depth: number
    error?: string
  }>
  socialLinks?: Array<{
    platform: string
    url: string
    foundOn: string
    handle?: string
  }>
  addresses?: string[]
  footerLinks?: Array<{ text: string; url: string }>
}

/** Type dédié pour les données issues du robot Website (tableaux strictement typés).
 *  Ne peut pas `extends ScrapedPlace` car `whatsapp`/`gps` ont des types incompatibles avec la base.
 *  Utilisé via un cast `as unknown as WebsitePlace` quand on accède aux champs website. */
interface WebsitePlace {
  siteUrl: string
  siteName?: string
  metaDescription?: string
  language?: string
  logoUrl?: string
  emails?: Array<{ email: string; foundOn: string; context?: string; fromMailtoLink: boolean }>
  phones?: Array<{ raw: string; normalized: string; foundOn: string; context?: string; fromTelLink: boolean }>
  whatsapp?: Array<{ raw: string; normalized: string; foundOn: string; context?: string; fromTelLink: boolean }>
  gps?: Array<{ lat: number; lng: number; foundOn: string; source: string }>
  socialLinks?: Array<{ platform: string; url: string; foundOn: string; handle?: string }>
  addresses?: string[]
  footerLinks?: Array<{ text: string; url: string }>
  visitedPages?: Array<{ url: string; requestedUrl: string; title?: string; pageType: string; status: number; loadTimeMs: number; depth: number; error?: string }>
  googleMapsUrl?: string
}

interface JobProgress {
  jobId: string
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  phase: string
  progress: number
  resultsCount: number
  processedCount: number
  duplicatesDetected: number
  errors: string[]
  currentPlace?: string
  startedAt: string
}

interface ScrapeResult {
  jobId: string
  status: string
  places: ScrapedPlace[]
  duplicates: Array<{ canonicalName: string; duplicates: Array<{ name: string; similarity: number; reason: string }>; confidence: number }>
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
}

interface JobState {
  id: string
  query: { keyword: string; city?: string; commune?: string; neighborhood?: string; maxResults?: number; pageUrl?: string; url?: string; pageTypes?: string[]; maxPages?: number }
  progress: JobProgress
  result?: ScrapeResult
  events: Array<{ type: string; [key: string]: unknown }>
  createdAt: string
}

interface LaunchResponse {
  jobId: string
  status?: string
  query?: unknown
  estimatedDurationMs?: number
  message?: string
  authenticated?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ENDPOINTS: Record<Engine, { launch: string; job: (id: string) => string; list?: string }> = {
  "google-maps": {
    launch: "/api/scraper/google-maps",
    job: (id) => `/api/scraper/jobs/${id}`,
    list: "/api/scraper/jobs",
  },
  facebook: {
    launch: "/api/scraper/facebook",
    job: (id) => `/api/scraper/facebook/jobs/${id}`,
  },
  business: {
    launch: "/api/scraper/business",
    job: (id) => `/api/scraper/business/jobs/${id}`,
  },
  website: {
    launch: "/api/scraper/website",
    job: (id) => `/api/scraper/website/jobs/${id}`,
  },
  "ai-cleaner": {
    launch: "/api/scraper/ai-cleaner",
    job: (id) => `/api/scraper/ai-cleaner/jobs/${id}`,
  },
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
)

const LinkedinIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/>
  </svg>
)

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ScraperView() {
  const [engine, setEngine] = useState<Engine>("google-maps")
  const [keyword, setKeyword] = useState("restaurant")
  const [city, setCity] = useState("Abidjan")
  const [commune, setCommune] = useState("Cocody")
  const [neighborhood, setNeighborhood] = useState("")
  const [maxResults, setMaxResults] = useState(10)
  // Facebook-only fields
  const [cookies, setCookies] = useState("")
  const [pageUrl, setPageUrl] = useState("")
  // Business/LinkedIn-only fields
  const [linkedinSlug, setLinkedinSlug] = useState("")
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [linkedinCookies, setLinkedinCookies] = useState("")
  const [maxPeople, setMaxPeople] = useState(20)
  const [extractEmployees, setExtractEmployees] = useState(true)
  // Website Robot-only fields
  const [siteUrl, setSiteUrl] = useState("")
  const [websitePageTypes, setWebsitePageTypes] = useState<string[]>(["contact", "about", "legal"])
  const [maxPages, setMaxPages] = useState(8)
  // IA Cleaner-only fields
  const [aiJob, setAiJob] = useState<AICleanerJobState | null>(null)
  const [aiSource, setAiSource] = useState<string>("sample")
  const [aiUseLLM, setAiUseLLM] = useState(true)
  const [aiDetectClosed, setAiDetectClosed] = useState(true)
  const [aiCompleteMissing, setAiCompleteMissing] = useState(true)
  const [aiDetectSector, setAiDetectSector] = useState(true)

  const [jobs, setJobs] = useState<Record<Engine, JobState | null>>({
    "google-maps": null,
    facebook: null,
    business: null,
    website: null,
    "ai-cleaner": null,
  })
  const [pollingEngine, setPollingEngine] = useState<Engine | null>(null)
  const [launching, setLaunching] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<ScrapedPlace | null>(null)

  const currentJob = jobs[engine]
  const isRunning =
    currentJob?.progress.status === "running" ||
    currentJob?.progress.status === "queued" ||
    (engine === "ai-cleaner" &&
      (aiJob?.progress.status === "running" || aiJob?.progress.status === "queued"))

  // Polling de l'état du job (par moteur) — avec retry pour résister aux crashs serveur
  const pollJob = useCallback(async (jobId: string, eng: Engine) => {
    let retryCount = 0
    const maxRetries = 5

    const doPoll = async () => {
      try {
        const res = await fetch(ENDPOINTS[eng].job(jobId), { credentials: "include" })
        if (!res.ok) {
          // Serveur a renvoyé une erreur (404 = job supprimé, 500 = crash)
          if (res.status === 404) {
            setPollingEngine((cur) => (cur === eng ? null : cur))
            toast.error("Job introuvable", { description: "Le job a été supprimé ou le serveur a redémarré." })
            return
          }
          // Autre erreur — retry
          retryCount++
          if (retryCount < maxRetries) {
            setTimeout(doPoll, 3000) // retry dans 3s
            return
          }
          setPollingEngine((cur) => (cur === eng ? null : cur))
          toast.error("Erreur serveur", { description: `HTTP ${res.status} — le serveur a peut-être crashé.` })
          return
        }
        // Reset retry count si on a une réponse OK
        retryCount = 0
        const data: JobState = await res.json()
        setJobs((prev) => ({ ...prev, [eng]: data }))

        if (data.progress.status === "running" || data.progress.status === "queued") {
          setTimeout(doPoll, 2000) // 2s entre chaque poll
        } else {
          setPollingEngine((cur) => (cur === eng ? null : cur))
          if (data.progress.status === "completed" && data.result) {
            toast.success(eng === "business" ? "Identification terminée" : eng === "website" ? "Extraction site terminée" : "Scraping terminé", {
              description: `${data.result.stats.uniqueCount} ${eng === "business" ? "entreprise(s)" : eng === "website" ? "site(s)" : "lieu(s)"} unique(s) extrait(s) en ${(data.result.stats.durationMs / 1000).toFixed(1)}s`,
            })
          } else if (data.progress.status === "failed") {
            toast.error("Scraping échoué", {
              description: data.progress.errors[0] || "Erreur inconnue",
            })
          } else if (data.progress.status === "cancelled") {
            toast.info("Job annulé")
          }
        }
      } catch (err) {
        // Erreur réseau (serveur injoignable = crash OOM)
        retryCount++
        if (retryCount < maxRetries) {
          // Attendre de plus en plus longtemps entre les retries
          const delay = Math.min(3000 * retryCount, 15000)
          setTimeout(doPoll, delay)
          if (retryCount === 1) {
            toast.warning("Serveur injoignable", {
              description: "Reconnexion en cours... (le serveur a peut-être redémarré)",
            })
          }
          return
        }
        setPollingEngine((cur) => (cur === eng ? null : cur))
        toast.error("Job interrompu", {
          description: "Le serveur est injoignable depuis 15s. Le job peut avoir crashé par manque de mémoire. Vérifiez la vue Jobs — les résultats sont persistés en DB.",
        })
      }
    }
    doPoll()
  }, [])

  // Polling de l'état du job IA Cleaner (forme différente des autres moteurs)
  const pollAICleanerJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(ENDPOINTS["ai-cleaner"].job(jobId), { credentials: "include" })
      if (!res.ok) return
      const data: AICleanerJobState = await res.json()
      setAiJob(data)

      if (data.progress.status === "running" || data.progress.status === "queued") {
        setTimeout(() => pollAICleanerJob(jobId), 1500)
      } else {
        setPollingEngine((cur) => (cur === "ai-cleaner" ? null : cur))
        if (data.progress.status === "completed" && data.report) {
          toast.success("Nettoyage IA terminé", {
            description: `${data.report.output.cleanedEntities} entité(s) nettoyée(s), ${data.report.output.duplicatesRemoved} doublon(s), ${data.report.output.fieldsCorrected} correction(s), score moyen ${data.report.stats.avgQualityScore.toFixed(0)}/100`,
          })
        } else if (data.progress.status === "failed") {
          toast.error("Nettoyage IA échoué", {
            description: data.progress.errors[0] || "Erreur inconnue",
          })
        } else if (data.progress.status === "cancelled") {
          toast.info("Nettoyage IA annulé")
        }
      }
    } catch (err) {
      console.error("[ai-poll] error:", err)
      setPollingEngine((cur) => (cur === "ai-cleaner" ? null : cur))
    }
  }, [])

  // Lance un job
  const launchJob = async () => {
    // === IA Cleaner : pipeline dédié (dédup → fusion → correction → enrichissement → score → fermetures) ===
    if (engine === "ai-cleaner") {
      setLaunching(true)
      try {
        const body: Record<string, unknown> = {
          config: {
            useLLM: aiUseLLM,
            detectClosed: aiDetectClosed,
            completeMissing: aiCompleteMissing,
            detectSector: aiDetectSector,
            minConfidence: 0.7,
            language: "fr",
            country: "ci",
          },
        }

        let description = "Échantillon de démonstration (12 entités avec doublons, erreurs et champs manquants)"

        // Si une source de job précédent est sélectionnée, on récupère le dernier job ID
        if (aiSource !== "sample") {
          const listUrl =
            aiSource === "google-maps"
              ? "/api/scraper/jobs"
              : `/api/scraper/${aiSource}/jobs`
          try {
            const listRes = await fetch(listUrl, { credentials: "include" })
            if (listRes.ok) {
              const listData = await listRes.json()
              const jobsList: Array<{ id: string }> = listData.jobs || []
              if (jobsList.length > 0) {
                body.sourceJobId = jobsList[0].id
                body.source = aiSource
                description = `Dernier job ${aiSource} (${jobsList[0].id})`
              } else {
                toast.warning(`Aucun job ${aiSource} trouvé`, {
                  description: "Utilisation de l'échantillon de démonstration à la place.",
                })
              }
            }
          } catch {
            // Ignore — fallback sur échantillon
          }
        }

        const res = await fetch(ENDPOINTS["ai-cleaner"].launch, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        })

        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || "Échec du lancement")
        }

        const data: LaunchResponse & { inputCount?: number } = await res.json()
        const { jobId } = data

        toast.info("Moteur IA lancé", {
          description: `${description} · ${data.inputCount || 0} entité(s) · Pipeline : dédup → fusion → correction → enrichissement → score → fermetures`,
        })

        setPollingEngine("ai-cleaner")
        pollAICleanerJob(jobId)
      } catch (err) {
        toast.error("Erreur", { description: (err as Error).message })
      } finally {
        setLaunching(false)
      }
      return
    }

    const isDirectPage = engine === "facebook" && pageUrl.trim().length > 0
    const isBusinessDirect =
      engine === "business" && (linkedinSlug.trim().length > 0 || linkedinUrl.trim().length > 0)

    if (engine === "website") {
      if (!siteUrl.trim()) {
        toast.error("Veuillez saisir l'URL du site à scraper")
        return
      }
      if (websitePageTypes.length === 0) {
        toast.error("Sélectionnez au moins un type de page à visiter")
        return
      }
    } else if (engine === "business") {
      if (!keyword.trim() && !linkedinSlug.trim() && !linkedinUrl.trim()) {
        toast.error("Veuillez saisir un nom, un slug LinkedIn ou une URL LinkedIn")
        return
      }
    } else if (!isDirectPage && !keyword.trim()) {
      toast.error(engine === "facebook"
        ? "Veuillez saisir un mot-clé ou une URL de page Facebook"
        : "Veuillez saisir un mot-clé")
      return
    }

    setLaunching(true)
    try {
      let body: Record<string, unknown>
      let description: string

      if (engine === "website") {
        body = {
          url: siteUrl.trim(),
          pageTypes: websitePageTypes,
          maxPages,
        }
        description = `Site web : ${siteUrl.trim()}`
      } else if (engine === "business") {
        body = {
          query: keyword.trim() || undefined,
          location: city.trim() || undefined,
          linkedinSlug: linkedinSlug.trim() || undefined,
          linkedinUrl: linkedinUrl.trim() || undefined,
          cookies: linkedinCookies.trim() || undefined,
          maxPeople,
          extractEmployees,
        }
        description = isBusinessDirect
          ? `Entreprise LinkedIn : ${linkedinSlug.trim() || linkedinUrl.trim()}`
          : `Recherche entreprise « ${keyword} »${city.trim() ? ` à ${city.trim()}` : ""}`
      } else {
        body = {
          keyword: keyword.trim() || undefined,
          city: city.trim() || undefined,
          commune: commune.trim() || undefined,
          neighborhood: neighborhood.trim() || undefined,
          maxResults,
        }
        if (engine === "facebook") {
          if (cookies.trim()) body.cookies = cookies.trim()
          if (pageUrl.trim()) body.pageUrl = pageUrl.trim()
        }
        description = isDirectPage
          ? `Page Facebook : ${pageUrl.trim()}`
          : `Recherche « ${keyword} » à ${commune || city}`
      }

      const res = await fetch(ENDPOINTS[engine].launch, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Échec du lancement")
      }

      const data: LaunchResponse = await res.json()
      const { jobId } = data

      if (engine === "facebook" && data.authenticated === false) {
        toast.warning("Cookies non validés", {
          description: "Le moteur n'a pas pu vérifier les cookies. Le scraping peut échouer ou être limité.",
        })
      } else if (engine === "business" && data.authenticated === false) {
        toast.info("Lancement sans cookies LinkedIn", {
          description: "Fonctionne pour les grandes entreprises publiques (Orange, MTN…). Pour les PME, fournissez des cookies (li_at).",
        })
      } else {
        toast.info(engine === "business" ? "Job d'identification lancé" : engine === "website" ? "Robot lancé" : "Job de scraping lancé", {
          description,
        })
      }

      setPollingEngine(engine)
      pollJob(jobId, engine)
    } catch (err) {
      toast.error("Erreur", { description: (err as Error).message })
    } finally {
      setLaunching(false)
    }
  }

  // Annule le job courant
  const cancelJob = async () => {
    if (engine === "ai-cleaner") {
      if (!aiJob) return
      try {
        await fetch(ENDPOINTS["ai-cleaner"].job(aiJob.id), {
          method: "DELETE",
          credentials: "include",
        })
        toast.info("Job IA annulé")
        pollAICleanerJob(aiJob.id)
      } catch {
        toast.error("Erreur lors de l'annulation")
      }
      return
    }
    if (!currentJob) return
    try {
      await fetch(ENDPOINTS[engine].job(currentJob.id), {
        method: "DELETE",
        credentials: "include",
      })
      toast.info("Job annulé")
      pollJob(currentJob.id, engine)
    } catch {
      toast.error("Erreur lors de l'annulation")
    }
  }

  // Récupère les jobs GM récents au montage (FB n'a pas d'endpoint list)
  useEffect(() => {
    fetch("/api/scraper/jobs", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.jobs && data.jobs.length > 0) {
          pollJob(data.jobs[0].id, "google-maps")
        }
      })
      .catch(() => {})
  }, [pollJob])

  const hasFbCookies = cookies.trim().length > 0
  const isDirectPageMode = engine === "facebook" && pageUrl.trim().length > 0

  return (
    <div className="space-y-4">
      {/* Header + engine switch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Radar className="h-6 w-6 text-primary" />
            Moteur de scraping
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {engine === "facebook"
              ? "Facebook · Playwright · Extraction pages & recherche · Déduplication IA"
              : engine === "business"
              ? "Business / LinkedIn · Identification entreprises · Dirigeants & employés · Multi-sources"
              : engine === "website"
              ? "Site Web · Robot Playwright · Accueil + Contact + À propos + Mentions légales · Emails/Tél/WhatsApp/Réseaux/GPS"
              : engine === "ai-cleaner"
              ? "IA Cleaner · Déduplication · Fusion · Correction (tél/email/adresse) · Enrichissement · Secteur · Score qualité · Détection fermetures"
              : "Google Maps · Playwright · Extraction complète · Déduplication IA · Anti-blocage"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isRunning && (
            <Badge variant="outline" className="bg-primary/10 text-primary gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Scraping en cours…
            </Badge>
          )}
          <Tabs value={engine} onValueChange={(v) => setEngine(v as Engine)}>
            <TabsList>
              <TabsTrigger value="google-maps" className="gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Google Maps
              </TabsTrigger>
              <TabsTrigger value="facebook" className="gap-1.5">
                <FacebookIcon className="h-3.5 w-3.5" />
                Facebook
              </TabsTrigger>
              <TabsTrigger value="business" className="gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Business / LinkedIn
              </TabsTrigger>
              <TabsTrigger value="website" className="gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                Site Web
              </TabsTrigger>
              <TabsTrigger value="ai-cleaner" className="gap-1.5">
                <BrainCircuit className="h-3.5 w-3.5" />
                IA Cleaner
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Formulaire de recherche */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {engine === "facebook" ? (
              <FacebookIcon className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            ) : engine === "business" ? (
              <Building2 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            ) : engine === "website" ? (
              <Globe className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            ) : engine === "ai-cleaner" ? (
              <BrainCircuit className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Tag className="h-4 w-4 text-primary" />
            )}
            Critères de recherche{engine === "facebook" ? " — Facebook" : engine === "business" ? " — Business / LinkedIn" : engine === "website" ? " — Site Web / Robot" : engine === "ai-cleaner" ? " — IA Cleaner" : " — Google Maps"}
          </CardTitle>
          <CardDescription className="text-xs">
            {engine === "facebook"
              ? "Le moteur va ouvrir Facebook, charger les pages et extraire les coordonnées (Messenger, WhatsApp, site, etc.)"
              : engine === "business"
              ? "Le moteur va identifier l'entreprise sur LinkedIn, extraire dirigeants et employés, avec fallbacks (Google, Pages Jaunes)"
              : engine === "website"
              ? "Le robot va visiter l'accueil du site, découvrir les pages Contact / À propos / Mentions légales via le footer, et extraire tous les contacts"
              : engine === "ai-cleaner"
              ? "Le moteur IA nettoie et enrichit des fiches entreprises : déduplication, fusion, correction (tél/email/adresse), détection secteur, complétion, score qualité et détection de fermetures"
              : "Le moteur va ouvrir Google Maps, scroller les résultats et extraire chaque fiche détaillée"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Alerte info IA Cleaner — pipeline */}
          {engine === "ai-cleaner" && (
            <Alert className="border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
              <BrainCircuit className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertTitle className="text-emerald-800 dark:text-emerald-200">
                🧠 Pipeline du moteur IA Cleaner
              </AlertTitle>
              <AlertDescription className="text-emerald-700 dark:text-emerald-300">
                Le moteur IA va : <strong>dédupliquer</strong> → <strong>fusionner</strong> →{" "}
                <strong>corriger</strong> (tél/email/adresse) → <strong>détecter le secteur</strong> →{" "}
                <strong>compléter les champs manquants</strong> → <strong>scorer la qualité</strong> →{" "}
                <strong>détecter les fermetures</strong>.
                <br />
                Sans source sélectionnée, un échantillon de 12 entreprises ivoiriennes (avec doublons, erreurs et champs manquants) est utilisé.
              </AlertDescription>
            </Alert>
          )}

          {/* Champs IA Cleaner — source + toggles */}
          {engine === "ai-cleaner" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-7 space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Database className="h-3 w-3" /> Source des données
                  </Label>
                  <Select value={aiSource} onValueChange={setAiSource} disabled={isRunning}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sample">Échantillon de démonstration (12 entités)</SelectItem>
                      <SelectItem value="google-maps">Dernier job Google Maps</SelectItem>
                      <SelectItem value="facebook">Dernier job Facebook</SelectItem>
                      <SelectItem value="business">Dernier job Business / LinkedIn</SelectItem>
                      <SelectItem value="website">Dernier job Site Web</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Par défaut, l'échantillon de démo contient 12 fiches avec doublons, erreurs et champs manquants.
                    Vous pouvez aussi re-traiter le dernier job d'un autre moteur.
                  </p>
                </div>
                <div className="md:col-span-5 space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Wand2 className="h-3 w-3" /> Modules IA à activer
                  </Label>
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <label className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs cursor-pointer select-none transition-colors",
                      aiUseLLM
                        ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30 text-foreground"
                        : "border-input text-muted-foreground",
                      isRunning && "opacity-60 pointer-events-none"
                    )}>
                      <Switch checked={aiUseLLM} onCheckedChange={setAiUseLLM} disabled={isRunning} aria-label="Utiliser LLM" />
                      <span className="font-medium leading-tight">LLM (z-ai)</span>
                    </label>
                    <label className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs cursor-pointer select-none transition-colors",
                      aiDetectClosed
                        ? "border-orange-500/50 bg-orange-50 dark:bg-orange-950/30 text-foreground"
                        : "border-input text-muted-foreground",
                      isRunning && "opacity-60 pointer-events-none"
                    )}>
                      <Switch checked={aiDetectClosed} onCheckedChange={setAiDetectClosed} disabled={isRunning} aria-label="Détecter fermetures" />
                      <span className="font-medium leading-tight">Détecter fermetures</span>
                    </label>
                    <label className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs cursor-pointer select-none transition-colors",
                      aiCompleteMissing
                        ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-950/30 text-foreground"
                        : "border-input text-muted-foreground",
                      isRunning && "opacity-60 pointer-events-none"
                    )}>
                      <Switch checked={aiCompleteMissing} onCheckedChange={setAiCompleteMissing} disabled={isRunning} aria-label="Compléter champs manquants" />
                      <span className="font-medium leading-tight">Compléter champs</span>
                    </label>
                    <label className={cn(
                      "flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs cursor-pointer select-none transition-colors",
                      aiDetectSector
                        ? "border-orange-500/50 bg-orange-50 dark:bg-orange-950/30 text-foreground"
                        : "border-input text-muted-foreground",
                      isRunning && "opacity-60 pointer-events-none"
                    )}>
                      <Switch checked={aiDetectSector} onCheckedChange={setAiDetectSector} disabled={isRunning} aria-label="Détecter secteur" />
                      <span className="font-medium leading-tight">Détecter secteur</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Alerte cookies Facebook */}
          {engine === "facebook" && (
            <Alert className="border-orange-300 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40">
              <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertTitle className="text-orange-800 dark:text-orange-200">
                ⚠️ Connexion Facebook requise
              </AlertTitle>
              <AlertDescription className="text-orange-700 dark:text-orange-300">
                Facebook nécessite des cookies de session (<code className="font-mono">c_user</code>,{" "}
                <code className="font-mono">xs</code>) pour accéder à la plupart des pages.
                Récupérez-les depuis votre navigateur → DevTools → Application → Cookies → facebook.com
              </AlertDescription>
            </Alert>
          )}

          {/* Alerte cookies LinkedIn (business) */}
          {engine === "business" && (
            <Alert className="border-orange-300 bg-orange-50 dark:border-orange-900 dark:bg-orange-950/40">
              <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              <AlertTitle className="text-orange-800 dark:text-orange-200">
                🔐 Authentification LinkedIn
              </AlertTitle>
              <AlertDescription className="text-orange-700 dark:text-orange-300">
                LinkedIn nécessite des cookies (<code className="font-mono">li_at</code>) pour les PME.
                Les grandes entreprises publiques (Orange, MTN, etc.) sont accessibles sans authentification.
              </AlertDescription>
            </Alert>
          )}

          {/* Bannière warning si FB sans cookies */}
          {engine === "facebook" && !hasFbCookies && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
              <div className="flex items-start gap-2 text-xs">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-200">
                    Cookies de session non fournis
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 mt-0.5">
                    Sans cookies valides, Facebook limite drastiquement l'accès aux pages et
                    le scraping risque d'échouer ou de renvoyer des résultats partiels.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Alerte info Robot Website */}
          {engine === "website" && (
            <Alert className="border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40">
              <Info className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <AlertTitle className="text-emerald-800 dark:text-emerald-200">
                🤖 Robot de scraping de site web
              </AlertTitle>
              <AlertDescription className="text-emerald-700 dark:text-emerald-300">
                Le robot visitera automatiquement l'accueil, puis découvrira les pages Contact, À propos
                et Mentions légales via les liens du footer. Il extraira emails, téléphones, WhatsApp,
                réseaux sociaux, Google Maps et GPS.
              </AlertDescription>
            </Alert>
          )}

          {/* Champs Website Robot */}
          {engine === "website" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-7 space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Globe className="h-3 w-3" /> URL du site <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    placeholder="https://www.orange.ci"
                    disabled={isRunning}
                    type="url"
                    autoComplete="url"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Saisissez l'URL complète du site (avec ou sans https://).
                  </p>
                </div>
                <div className="md:col-span-5 space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Activity className="h-3 w-3" /> Max pages à visiter
                  </Label>
                  <Select value={String(maxPages)} onValueChange={(v) => setMaxPages(Number(v))} disabled={isRunning}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[4, 6, 8, 10, 15].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} pages</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Inclut l'accueil + les pages découvertes (profondeur 1).
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Navigation className="h-3 w-3" /> Types de pages à visiter
                </Label>
                <div className="flex flex-wrap gap-4 pt-1">
                  {([
                    { value: "contact", label: "Contact" },
                    { value: "about", label: "À propos" },
                    { value: "legal", label: "Mentions légales" },
                  ] as const).map((opt) => {
                    const checked = websitePageTypes.includes(opt.value)
                    return (
                      <label
                        key={opt.value}
                        className={cn(
                          "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs cursor-pointer select-none transition-colors",
                          checked
                            ? "border-primary/50 bg-primary/5 text-foreground"
                            : "border-input text-muted-foreground hover:bg-muted/50",
                          isRunning && "opacity-60 pointer-events-none"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            if (v) {
                              setWebsitePageTypes((prev) =>
                                prev.includes(opt.value) ? prev : [...prev, opt.value]
                              )
                            } else {
                              setWebsitePageTypes((prev) => prev.filter((t) => t !== opt.value))
                            }
                          }}
                          disabled={isRunning}
                          aria-label={opt.label}
                        />
                        <span className="font-medium">{opt.label}</span>
                      </label>
                    )
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  L'accueil est toujours visitée en premier. Ces types guident la découverte des liens dans le footer.
                </p>
              </div>
            </div>
          )}

          {/* Champs business/LinkedIn */}
          {engine === "business" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-5 space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Tag className="h-3 w-3" /> Nom ou mot-clé {!linkedinSlug && !linkedinUrl && "*"}
                  </Label>
                  <Input
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Orange, MTN Côte d'Ivoire…"
                    disabled={isRunning}
                  />
                </div>
                <div className="md:col-span-3 space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" /> Localisation
                  </Label>
                  <Input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Abidjan, CI"
                    disabled={isRunning}
                  />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <UserCheck className="h-3 w-3" /> Max personnes
                  </Label>
                  <Select value={String(maxPeople)} onValueChange={(v) => setMaxPeople(Number(v))} disabled={isRunning}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[5, 10, 20, 50].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n} personnes</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Users className="h-3 w-3" /> Extraire employés
                  </Label>
                  <div className="flex items-center gap-2 h-9">
                    <Switch
                      checked={extractEmployees}
                      onCheckedChange={setExtractEmployees}
                      disabled={isRunning}
                      aria-label="Extraire les employés"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {extractEmployees ? "Oui" : "Non"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-3 space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <LinkedinIcon className="h-3 w-3" /> Slug LinkedIn (optionnel)
                  </Label>
                  <Input
                    value={linkedinSlug}
                    onChange={(e) => setLinkedinSlug(e.target.value)}
                    placeholder="orange"
                    disabled={isRunning}
                  />
                </div>
                <div className="md:col-span-4 space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <LinkedinIcon className="h-3 w-3" /> URL LinkedIn (optionnel)
                  </Label>
                  <Input
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/company/orange/"
                    disabled={isRunning}
                  />
                </div>
                <div className="md:col-span-5 space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <AlertCircle className="h-3 w-3" /> Cookies LinkedIn (optionnel)
                  </Label>
                  <Textarea
                    value={linkedinCookies}
                    onChange={(e) => setLinkedinCookies(e.target.value)}
                    placeholder="li_at=XXXX; JSESSIONID=YYYY"
                    disabled={isRunning}
                    className="min-h-[42px] text-[11px] font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Champs standards (masqués en mode pageUrl direct OU en mode website OU IA Cleaner) */}
          {engine !== "business" && engine !== "website" && engine !== "ai-cleaner" && (
          <div className={cn("grid grid-cols-1 md:grid-cols-12 gap-3", isDirectPageMode && "opacity-50 pointer-events-none")}>
            <div className="md:col-span-4 space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Tag className="h-3 w-3" /> Mot-clé {!isDirectPageMode && "*"}
              </Label>
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="restaurant, pharmacie, banque…"
                disabled={isRunning}
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Building2 className="h-3 w-3" /> Ville
              </Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Abidjan"
                disabled={isRunning}
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> Commune
              </Label>
              <Input
                value={commune}
                onChange={(e) => setCommune(e.target.value)}
                placeholder="Cocody"
                disabled={isRunning}
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <MapPin className="h-3 w-3" /> Quartier
              </Label>
              <Input
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Riviera 2"
                disabled={isRunning}
              />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label className="text-xs">Max résultats</Label>
              <Select value={String(maxResults)} onValueChange={(v) => setMaxResults(Number(v))} disabled={isRunning}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5, 10, 20, 50].map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} lieux</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          )}

          {/* Champs Facebook spécifiques */}
          {engine === "facebook" && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-7 space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <FacebookIcon className="h-3 w-3" /> URL de page Facebook (optionnel)
                </Label>
                <Input
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  placeholder="https://www.facebook.com/orangecotedivoire"
                  disabled={isRunning}
                />
                <p className="text-[10px] text-muted-foreground">
                  Si renseignée, la recherche par mot-clé est ignorée (scraping direct de la page).
                </p>
              </div>
              <div className="md:col-span-5 space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3" /> Cookies Facebook (optionnel)
                </Label>
                <Textarea
                  value={cookies}
                  onChange={(e) => setCookies(e.target.value)}
                  placeholder="c_user=XXXX; xs=YYYY; datr=ZZZZ; fr=WWW"
                  disabled={isRunning}
                  className="min-h-[42px] text-[11px] font-mono"
                />
              </div>
            </div>
          )}

          {/* Badges & actions */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-primary" />
                {engine === "facebook"
                  ? "Auth par cookies"
                  : engine === "business"
                  ? "Identification multi-sources"
                  : engine === "website"
                  ? "Robot Playwright headless"
                  : engine === "ai-cleaner"
                  ? "Pipeline 7 étapes IA"
                  : "Anti-blocage (CAPTCHA, 429, consent)"}
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                {engine === "business"
                  ? "Dirigeants & employés"
                  : engine === "website"
                  ? "Extraction emails / tél / WhatsApp / GPS"
                  : engine === "ai-cleaner"
                  ? "Dédup + fusion + correction + enrichissement"
                  : "Dédup IA (Jaro-Winkler + GPS)"}
              </span>
              <span className="hidden sm:flex items-center gap-1">
                <Activity className="h-3 w-3 text-primary" />
                {engine === "facebook"
                  ? "Extraction Messenger/WhatsApp"
                  : engine === "business"
                  ? "Score de confiance 0-100"
                  : engine === "website"
                  ? "Footer + Contact + À propos + Mentions"
                  : engine === "ai-cleaner"
                  ? "Score qualité 0-100 + détection fermetures"
                  : "Backoff exponentiel"}
              </span>
            </div>
            <div className="flex gap-2">
              {isRunning ? (
                <Button variant="destructive" onClick={cancelJob} className="gap-2">
                  <Square className="h-4 w-4" />
                  Annuler
                </Button>
              ) : (
                <Button onClick={launchJob} disabled={launching} className="gap-2">
                  {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : engine === "ai-cleaner" ? <Wand2 className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {engine === "business"
                    ? "Lancer l'identification"
                    : engine === "website"
                    ? "Lancer le robot"
                    : engine === "ai-cleaner"
                    ? "Lancer le nettoyage IA"
                    : "Lancer le scraping"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progression en temps réel — moteurs scraping (hors IA Cleaner) */}
      {currentJob && engine !== "ai-cleaner" && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Progression — Job{" "}
                <span className="font-mono text-xs text-muted-foreground">{currentJob.id}</span>
                <Badge variant="outline" className="text-[10px] gap-1 ml-1">
                  {engine === "facebook" ? (
                    <><FacebookIcon className="h-2.5 w-2.5" /> Facebook</>
                  ) : engine === "business" ? (
                    <><Building2 className="h-2.5 w-2.5" /> Business</>
                  ) : engine === "website" ? (
                    <><Globe className="h-2.5 w-2.5" /> Website</>
                  ) : (
                    <><MapPin className="h-2.5 w-2.5" /> Google Maps</>
                  )}
                </Badge>
              </CardTitle>
              <StatusBadge status={currentJob.progress.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Barre de progression */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-medium capitalize">{currentJob.progress.phase}</span>
                <span className="text-muted-foreground">{currentJob.progress.progress}%</span>
              </div>
              <Progress value={currentJob.progress.progress} className="h-2" />
            </div>

            {/* Stats live */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label={engine === "website" ? "Pages visitées" : "Extraits"} value={currentJob.progress.processedCount} icon={CheckCircle2} />
              <StatCard label="Doublons" value={currentJob.progress.duplicatesDetected} icon={AlertCircle} />
              <StatCard label={engine === "website" ? "Sites extraits" : "Uniques"} value={currentJob.progress.resultsCount - currentJob.progress.duplicatesDetected} icon={Sparkles} />
              <StatCard label="Erreurs" value={currentJob.progress.errors.length} icon={XCircle} />
              <StatCard label="Durée" value={currentJob.result ? `${(currentJob.result.stats.durationMs / 1000).toFixed(1)}s` : "…"} icon={Clock} />
            </div>

            {currentJob.progress.currentPlace && isRunning && (
              <div className="rounded-lg bg-muted/40 p-2.5 text-xs flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span className="text-muted-foreground">Extraction en cours :</span>
                <span className="font-medium truncate">{currentJob.progress.currentPlace}</span>
              </div>
            )}

            {/* Log streaming */}
            {currentJob.events.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                  <Activity className="h-3 w-3" /> Log streaming
                </p>
                <div className="rounded-lg bg-slate-950 text-slate-100 p-3 font-mono text-[11px] space-y-0.5 max-h-48 overflow-y-auto">
                  {currentJob.events.slice(-30).map((event, i) => (
                    <div key={i} className={cn(
                      (event.type === "error" || event.type === "fb-error" || event.type === "biz-error" || event.type === "ws-error") && "text-red-400",
                      (event.type === "block-detected" || event.type === "fb-login-required" || event.type === "fb-consent-required" || event.type === "biz-fallback") && "text-amber-400",
                      (event.type === "place-extracted" || event.type === "fb-extracted" || event.type === "biz-extracted" || event.type === "ws-extracted") && "text-emerald-400",
                      (event.type === "duplicate-detected" || event.type === "fb-page-loaded" || event.type === "fb-search-loaded" || event.type === "biz-page-loaded" || event.type === "biz-search-loaded" || event.type === "biz-people-found" || event.type === "ws-page-loaded" || event.type === "ws-contacts-found") && "text-cyan-400",
                      event.type === "complete" && "text-emerald-400 font-semibold",
                      !["error", "fb-error", "biz-error", "ws-error", "block-detected", "fb-login-required", "fb-consent-required", "biz-fallback", "place-extracted", "fb-extracted", "biz-extracted", "ws-extracted", "duplicate-detected", "fb-page-loaded", "fb-search-loaded", "biz-page-loaded", "biz-search-loaded", "biz-people-found", "ws-page-loaded", "ws-contacts-found", "complete"].includes(event.type) && "text-slate-400",
                    )}>
                      [{new Date().toLocaleTimeString("fr-FR")}] {formatEvent(event)}
                    </div>
                  ))}
                  {isRunning && <div className="text-slate-500 animate-pulse">▋</div>}
                </div>
              </div>
            )}

            {/* Erreurs */}
            {currentJob.progress.errors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-semibold text-destructive mb-1">Erreurs ({currentJob.progress.errors.length})</p>
                <ul className="space-y-0.5 text-[11px] text-muted-foreground max-h-32 overflow-y-auto">
                  {currentJob.progress.errors.slice(-10).map((err, i) => (
                    <li key={i} className="font-mono">• {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Progression IA Cleaner (forme différente : pas de resultsCount/duplicatesDetected) */}
      {engine === "ai-cleaner" && aiJob && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BrainCircuit className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Pipeline IA — Job{" "}
                <span className="font-mono text-xs text-muted-foreground">{aiJob.id}</span>
                <Badge variant="outline" className="text-[10px] gap-1 ml-1">
                  <BrainCircuit className="h-2.5 w-2.5" /> IA Cleaner
                </Badge>
              </CardTitle>
              <StatusBadge status={aiJob.progress.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Barre de progression */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="font-medium capitalize">{aiJob.progress.phase}</span>
                <span className="text-muted-foreground">{aiJob.progress.progress}%</span>
              </div>
              <Progress value={aiJob.progress.progress} className="h-2" />
            </div>

            {/* Stats live IA */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label="Entités entrées" value={aiJob.input.length} icon={Database} />
              <StatCard
                label="Traités"
                value={aiJob.progress.processedCount}
                icon={CheckCircle2}
              />
              <StatCard
                label="Doublons suppr."
                value={aiJob.report?.output.duplicatesRemoved ?? 0}
                icon={GitMerge}
              />
              <StatCard
                label="Corrections"
                value={aiJob.report?.output.fieldsCorrected ?? 0}
                icon={Filter}
              />
              <StatCard label="Erreurs" value={aiJob.progress.errors.length} icon={XCircle} />
            </div>

            {/* Log streaming IA */}
            {aiJob.events.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                  <Activity className="h-3 w-3" /> Log streaming IA
                </p>
                <div className="rounded-lg bg-slate-950 text-slate-100 p-3 font-mono text-[11px] space-y-0.5 max-h-64 overflow-y-auto">
                  {aiJob.events.slice(-50).map((event, i) => (
                    <div key={i} className={cn(
                      (event.type === "ai-error") && "text-red-400",
                      (event.type === "ai-correct-phone" || event.type === "ai-correct-email" || event.type === "ai-normalize-address") && "text-amber-400",
                      (event.type === "ai-merge-done" || event.type === "ai-dedup-done") && "text-cyan-400",
                      (event.type === "ai-enrich-done") && "text-emerald-400",
                      (event.type === "ai-sector-detect" || event.type === "ai-closed-detect" || event.type === "ai-quality-score") && "text-violet-400",
                      event.type === "ai-complete" && "text-emerald-400 font-semibold",
                      !["ai-error", "ai-correct-phone", "ai-correct-email", "ai-normalize-address", "ai-merge-done", "ai-dedup-done", "ai-enrich-done", "ai-sector-detect", "ai-closed-detect", "ai-quality-score", "ai-complete"].includes(event.type) && "text-slate-400",
                    )}>
                      [{new Date().toLocaleTimeString("fr-FR")}] {formatEvent(event)}
                    </div>
                  ))}
                  {isRunning && <div className="text-slate-500 animate-pulse">▋</div>}
                </div>
              </div>
            )}

            {/* Erreurs IA */}
            {aiJob.progress.errors.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-xs font-semibold text-destructive mb-1">Erreurs ({aiJob.progress.errors.length})</p>
                <ul className="space-y-0.5 text-[11px] text-muted-foreground max-h-32 overflow-y-auto">
                  {aiJob.progress.errors.slice(-10).map((err, i) => (
                    <li key={i} className="font-mono">• {err}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Résultats */}
      {currentJob?.result && currentJob.result.places.length > 0 && (
        <Tabs defaultValue="grid">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="grid">
                {engine === "facebook" ? "Pages" : engine === "business" ? "Entreprises" : engine === "website" ? "Sites" : "Résultats"} ({currentJob.result.places.length})
              </TabsTrigger>
              <TabsTrigger value="duplicates">Doublons ({currentJob.result.duplicates.length})</TabsTrigger>
              <TabsTrigger value="stats">Stats</TabsTrigger>
            </TabsList>
            <a
              href={`${ENDPOINTS[engine].job(currentJob.id)}?format=csv`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </a>
          </div>

          <TabsContent value="grid" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentJob.result.places.map((place, i) => (
                engine === "business" ? (
                  <BusinessPlaceCard key={i} place={place} onClick={() => setSelectedPlace(place)} />
                ) : engine === "website" ? (
                  <WebsitePlaceCard key={i} place={place} onClick={() => setSelectedPlace(place)} />
                ) : (
                  <PlaceCard key={i} place={place} onClick={() => setSelectedPlace(place)} />
                )
              ))}
            </div>
          </TabsContent>

          <TabsContent value="duplicates" className="mt-4">
            {currentJob.result.duplicates.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-primary" />
                  Aucun doublon détecté
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {currentJob.result.duplicates.map((group, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <p className="text-sm font-semibold">{group.canonicalName}</p>
                        <Badge variant="outline" className="text-[10px] ml-auto">
                          Confiance {(group.confidence * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <Separator className="mb-3" />
                      <div className="space-y-1.5">
                        {group.duplicates.map((dup, j) => (
                          <div key={j} className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-2">
                              <AlertCircle className="h-3 w-3 text-amber-500" />
                              {dup.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[9px]">{dup.reason}</Badge>
                              <span className="text-muted-foreground tabular-nums">{(dup.similarity * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="stats" className="mt-4">
            {engine === "business" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard
                  label="Entreprises identifiées"
                  value={currentJob.result.stats.totalExtracted}
                  icon={Building2}
                />
                <StatCard
                  label="Dirigeants extraits"
                  value={currentJob.result.places.reduce((sum, p) => sum + (p.executives?.length || 0), 0)}
                  icon={Crown}
                />
                <StatCard
                  label="Employés extraits"
                  value={currentJob.result.places.reduce((sum, p) => sum + (p.employees?.length || 0), 0)}
                  icon={UserCheck}
                />
                <StatCard
                  label="Score moyen"
                  value={`${(() => {
                    const scores = currentJob.result.places
                      .map((p) => p.identificationScore)
                      .filter((s): s is number => typeof s === "number")
                    return scores.length > 0
                      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(0)
                      : "0"
                  })()}%`}
                  icon={Award}
                />
                <StatCard
                  label="Followers LinkedIn"
                  value={formatCount(currentJob.result.places.reduce((sum, p) => sum + (p.followersCount || 0), 0))}
                  icon={Users}
                />
                <StatCard
                  label="Employés sur LinkedIn"
                  value={formatCount(currentJob.result.places.reduce((sum, p) => sum + (p.employeesOnLinkedin || 0), 0))}
                  icon={Briefcase}
                />
                <StatCard label="Doublons fusionnés" value={currentJob.result.stats.duplicatesCount} icon={AlertCircle} />
                <StatCard label="Durée totale" value={`${(currentJob.result.stats.durationMs / 1000).toFixed(1)}s`} icon={Clock} />
                <StatCard
                  label="Taux de succès"
                  value={`${currentJob.result.stats.totalExtracted > 0 ? ((currentJob.result.stats.uniqueCount / currentJob.result.stats.totalExtracted) * 100).toFixed(1) : 0}%`}
                  icon={CheckCircle2}
                />
              </div>
            ) : engine === "website" ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard
                  label="Sites extraits"
                  value={currentJob.result.stats.totalExtracted}
                  icon={Globe}
                />
                <StatCard
                  label="Pages visitées"
                  value={currentJob.result.places.reduce(
                    (sum, p) => sum + (p.visitedPages?.length || 0),
                    0
                  )}
                  icon={Navigation}
                />
                <StatCard
                  label="Emails extraits"
                  value={currentJob.result.places.reduce(
                    (sum, p) => sum + ((p as unknown as WebsitePlace).emails?.length || 0),
                    0
                  )}
                  icon={Mail}
                />
                <StatCard
                  label="Téléphones extraits"
                  value={currentJob.result.places.reduce(
                    (sum, p) => sum + ((p as unknown as WebsitePlace).phones?.length || 0),
                    0
                  )}
                  icon={Phone}
                />
                <StatCard
                  label="Réseaux sociaux"
                  value={currentJob.result.places.reduce(
                    (sum, p) => sum + (p.socialLinks?.length || 0),
                    0
                  )}
                  icon={Share2}
                />
                <StatCard
                  label="Adresses extraites"
                  value={currentJob.result.places.reduce(
                    (sum, p) => sum + (p.addresses?.length || 0),
                    0
                  )}
                  icon={MapPin}
                />
                <StatCard
                  label="Coord. GPS extraites"
                  value={currentJob.result.places.reduce(
                    (sum, p) => sum + ((p as unknown as WebsitePlace).gps?.length || 0),
                    0
                  )}
                  icon={Navigation}
                />
                <StatCard
                  label="Durée totale"
                  value={`${(currentJob.result.stats.durationMs / 1000).toFixed(1)}s`}
                  icon={Clock}
                />
                <StatCard
                  label="Durée moyenne/page"
                  value={`${(() => {
                    const totalPages = currentJob.result.places.reduce(
                      (sum, p) => sum + (p.visitedPages?.length || 0),
                      0
                    )
                    const totalMs = currentJob.result.stats.durationMs
                    return totalPages > 0 && totalMs > 0
                      ? `${(totalMs / totalPages / 1000).toFixed(1)}s`
                      : "—"
                  })()}`}
                  icon={Activity}
                />
                <StatCard
                  label="Taux de succès"
                  value={`${currentJob.result.stats.totalExtracted > 0 ? ((currentJob.result.stats.uniqueCount / currentJob.result.stats.totalExtracted) * 100).toFixed(1) : 0}%`}
                  icon={CheckCircle2}
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard
                  label={engine === "facebook" ? "Pages extraites (total)" : "Lieux extraits (total)"}
                  value={currentJob.result.stats.totalExtracted}
                  icon={CheckCircle2}
                />
                <StatCard
                  label={engine === "facebook" ? "Pages uniques" : "Lieux uniques"}
                  value={currentJob.result.stats.uniqueCount}
                  icon={Sparkles}
                />
                <StatCard label="Doublons fusionnés" value={currentJob.result.stats.duplicatesCount} icon={AlertCircle} />
                <StatCard
                  label={engine === "facebook" ? "Pages visitées" : "Pages scrapées"}
                  value={currentJob.result.stats.pagesScraped}
                  icon={Activity}
                />
                <StatCard label="Blocages rencontrés" value={currentJob.result.stats.blocksEncountered} icon={XCircle} />
                <StatCard label="Retries" value={currentJob.result.stats.retries} icon={RefreshCw} />
                <StatCard label="Durée totale" value={`${(currentJob.result.stats.durationMs / 1000).toFixed(1)}s`} icon={Clock} />
                <StatCard
                  label="Vitesse moyenne"
                  value={`${currentJob.result.stats.totalExtracted > 0 && currentJob.result.stats.durationMs > 0 ? (currentJob.result.stats.totalExtracted / (currentJob.result.stats.durationMs / 1000)).toFixed(2) : "0.00"} /s`}
                  icon={Activity}
                />
                <StatCard
                  label="Taux de succès"
                  value={`${currentJob.result.stats.totalExtracted > 0 ? ((currentJob.result.stats.uniqueCount / currentJob.result.stats.totalExtracted) * 100).toFixed(1) : 0}%`}
                  icon={CheckCircle2}
                />
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Résultats IA Cleaner — 3 onglets : Entités nettoyées / Corrections / Rapport */}
      {engine === "ai-cleaner" && aiJob?.report && aiJob.cleanedEntities.length > 0 && (
        <Tabs defaultValue="cleaned">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="cleaned" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                Entités nettoyées ({aiJob.cleanedEntities.length})
              </TabsTrigger>
              <TabsTrigger value="corrections" className="gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                Corrections ({aiJob.report.corrections.length})
              </TabsTrigger>
              <TabsTrigger value="report" className="gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" />
                Rapport
              </TabsTrigger>
            </TabsList>
            <a
              href={`${ENDPOINTS["ai-cleaner"].job(aiJob.id)}?format=csv`}
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </a>
          </div>

          {/* === Onglet 1 : Entités nettoyées === */}
          <TabsContent value="cleaned" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {aiJob.cleanedEntities.map((entity, i) => (
                <CleanedEntityCard key={i} entity={entity} />
              ))}
            </div>
          </TabsContent>

          {/* === Onglet 2 : Corrections === */}
          <TabsContent value="corrections" className="mt-4">
            {aiJob.report.corrections.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
                  Aucune correction appliquée
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead className="text-xs">Entité</TableHead>
                          <TableHead className="text-xs">Champ</TableHead>
                          <TableHead className="text-xs">Avant</TableHead>
                          <TableHead className="text-xs">Après</TableHead>
                          <TableHead className="text-xs">Méthode</TableHead>
                          <TableHead className="text-xs text-right">Confiance</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {aiJob.report.corrections.map((c, i) => {
                          const entity = aiJob.cleanedEntities.find((e) => e.canonicalId === c.entityId || e.id === c.entityId || e.cleanedName === c.entityId)
                          const entityName = entity?.cleanedName || entity?.name || c.entityId
                          const fieldMeta = CORRECTION_FIELD_META[c.correctionType] || CORRECTION_FIELD_META.name
                          const FieldIcon = fieldMeta.icon
                          const methodMeta = CORRECTION_METHOD_META[c.method] || CORRECTION_METHOD_META.rule
                          return (
                            <TableRow key={i}>
                              <TableCell className="text-xs font-medium align-top max-w-[160px]">
                                <span className="truncate inline-block max-w-full" title={entityName}>
                                  {entityName}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs align-top">
                                <Badge variant="outline" className={cn("text-[9px] gap-1", fieldMeta.className)}>
                                  <FieldIcon className="h-2.5 w-2.5" />
                                  {c.fieldName}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs align-top">
                                <span className="line-through text-muted-foreground font-mono break-all">
                                  {c.oldValue || "(vide)"}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs align-top">
                                <span className="font-mono text-emerald-700 dark:text-emerald-300 break-all">
                                  {c.newValue || "(vide)"}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs align-top">
                                <Badge variant="secondary" className={cn("text-[9px]", methodMeta.className)}>
                                  {methodMeta.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-right align-top tabular-nums">
                                <span className={cn(
                                  "font-medium",
                                  c.confidence >= 0.85 ? "text-emerald-600 dark:text-emerald-400"
                                  : c.confidence >= 0.6 ? "text-amber-600 dark:text-amber-400"
                                  : "text-red-600 dark:text-red-400"
                                )}>
                                  {(c.confidence * 100).toFixed(0)}%
                                </span>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* === Onglet 3 : Rapport === */}
          <TabsContent value="report" className="mt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                <StatCard label="Entrées" value={aiJob.report.input.totalEntities} icon={Database} />
                <StatCard label="Nettoyées" value={aiJob.report.output.cleanedEntities} icon={CheckCircle2} />
                <StatCard label="Doublons suppr." value={aiJob.report.output.duplicatesRemoved} icon={GitMerge} />
                <StatCard label="Corrections" value={aiJob.report.output.fieldsCorrected} icon={Filter} />
                <StatCard label="Complétions" value={aiJob.report.output.fieldsCompleted} icon={Wand2} />
                <StatCard label="Secteurs détectés" value={aiJob.report.output.sectorsDetected} icon={Layers} />
                <StatCard label="Fermetures détectées" value={aiJob.report.output.closedDetected} icon={AlertTriangle} />
                <StatCard label="Score moyen" value={`${aiJob.report.stats.avgQualityScore.toFixed(0)}/100`} icon={TrendingUp} />
                <StatCard label="Tél corrigés" value={aiJob.report.stats.phoneCorrections} icon={Phone} />
                <StatCard label="Emails corrigés" value={aiJob.report.stats.emailCorrections} icon={Mail} />
                <StatCard label="Adresses normalisées" value={aiJob.report.stats.addressNormalizations} icon={MapPin} />
                <StatCard label="Appels LLM" value={aiJob.report.stats.llmCalls} icon={BrainCircuit} />
              </div>

              {/* Durée + sources + tokens */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                      <Clock className="h-3 w-3" /> Durée totale
                    </div>
                    <p className="text-xl font-bold tabular-nums">
                      {(aiJob.report.durationMs / 1000).toFixed(1)}s
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {(aiJob.report.durationMs / aiJob.report.input.totalEntities / 1000).toFixed(1)}s par entité
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                      <Database className="h-3 w-3" /> Sources
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {aiJob.report.input.sources.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        aiJob.report.input.sources.map((s, i) => (
                          <Badge key={i} variant="outline" className="text-[9px]">{s}</Badge>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
                      <BrainCircuit className="h-3 w-3" /> Tokens LLM
                    </div>
                    <p className="text-xl font-bold tabular-nums">
                      {formatCount(aiJob.report.stats.llmTokensUsed)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {aiJob.report.stats.llmCalls} appel(s)
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Groupes de doublons fusionnés */}
              {aiJob.report.duplicates.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <GitMerge className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      Doublons fusionnés ({aiJob.report.duplicates.length} groupes)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {aiJob.report.duplicates.map((group, i) => (
                      <div key={i} className="rounded-lg border p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-3.5 w-3.5 text-orange-600 dark:text-orange-400" />
                          <p className="text-sm font-semibold">{group.canonicalName}</p>
                          <Badge variant="outline" className="text-[10px] ml-auto gap-1">
                            Fusion {(group.fusionConfidence * 100).toFixed(0)}%
                          </Badge>
                        </div>
                        <Separator className="mb-2" />
                        <div className="space-y-1">
                          {group.mergedEntities.map((m, j) => (
                            <div key={j} className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1.5">
                                <AlertCircle className="h-3 w-3 text-amber-500" />
                                <span className="truncate">{m.name}</span>
                                <Badge variant="outline" className="text-[9px]">{m.source}</Badge>
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <Badge variant="outline" className="text-[9px]">{m.matchReason}</Badge>
                                <span className="text-muted-foreground tabular-nums">{(m.similarity * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Distribution des scores qualité */}
              {aiJob.report.stats.qualityScores.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      Distribution des scores qualité
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">≥ 70 (bon)</p>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {aiJob.report.stats.qualityScores.filter((s) => s >= 70).length}
                        </p>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">40–69 (moyen)</p>
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                          {aiJob.report.stats.qualityScores.filter((s) => s >= 40 && s < 70).length}
                        </p>
                      </div>
                      <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">&lt; 40 (faible)</p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">
                          {aiJob.report.stats.qualityScores.filter((s) => s < 40).length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* État initial : pas de job */}
      {!currentJob && !launching && !(engine === "ai-cleaner" && aiJob) && (
        <Card>
          <CardContent className="p-12 text-center">
            {engine === "facebook" ? (
              <FacebookIcon className="h-12 w-12 mx-auto mb-3 text-orange-500 dark:text-orange-400 opacity-70" />
            ) : engine === "business" ? (
              <Building2 className="h-12 w-12 mx-auto mb-3 text-orange-500 dark:text-orange-400 opacity-70" />
            ) : engine === "website" ? (
              <Globe className="h-12 w-12 mx-auto mb-3 text-orange-500 dark:text-orange-400 opacity-70" />
            ) : engine === "ai-cleaner" ? (
              <BrainCircuit className="h-12 w-12 mx-auto mb-3 text-emerald-500 dark:text-emerald-400 opacity-70" />
            ) : (
              <Radar className="h-12 w-12 mx-auto mb-3 text-primary opacity-50" />
            )}
            <p className="font-semibold mb-1">
              Prêt à {engine === "facebook"
                ? "scraper Facebook"
                : engine === "business"
                ? "identifier des entreprises"
                : engine === "website"
                ? "lancer le robot sur un site"
                : engine === "ai-cleaner"
                ? "lancer le moteur IA Cleaner"
                : "scraper Google Maps"}
            </p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {engine === "facebook"
                ? "Configurez vos critères (ou une URL de page) ci-dessus, ajoutez vos cookies Facebook si possible, puis cliquez sur « Lancer le scraping »."
                : engine === "business"
                ? "Renseignez un nom d'entreprise, un slug ou une URL LinkedIn, ajoutez des cookies (li_at) pour les PME, puis lancez l'identification. Dirigeants et employés seront extraits automatiquement."
                : engine === "website"
                ? "Saisissez l'URL d'un site ci-dessus, sélectionnez les types de pages à visiter, puis cliquez sur « Lancer le robot ». Le robot découvrira automatiquement les pages Contact, À propos et Mentions légales via le footer."
                : engine === "ai-cleaner"
                ? "Choisissez une source de données (échantillon de démo par défaut) et activez les modules IA souhaités, puis cliquez sur « Lancer le nettoyage IA ». Le moteur va dédupliquer, fusionner, corriger, enrichir et scorer les fiches."
                : "Configurez vos critères ci-dessus puis cliquez sur « Lancer le scraping ». Le moteur ouvrira Google Maps en mode headless, extraira chaque fiche et dédupliquera les résultats automatiquement."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] text-muted-foreground">
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-2.5 w-2.5 text-primary" /> {engine === "ai-cleaner" ? "Pipeline 7 étapes" : "Playwright + Chromium"}
              </Badge>
              {engine === "facebook" ? (
                <>
                  <Badge variant="outline" className="gap-1">
                    <FacebookIcon className="h-2.5 w-2.5" /> Pages + recherche
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <MessageCircle className="h-2.5 w-2.5 text-primary" /> Messenger / WhatsApp
                  </Badge>
                </>
              ) : engine === "business" ? (
                <>
                  <Badge variant="outline" className="gap-1">
                    <LinkedinIcon className="h-2.5 w-2.5" /> LinkedIn + fallbacks
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Crown className="h-2.5 w-2.5 text-primary" /> Dirigeants & employés
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Award className="h-2.5 w-2.5 text-primary" /> Score d'identification
                  </Badge>
                </>
              ) : engine === "website" ? (
                <>
                  <Badge variant="outline" className="gap-1">
                    <Globe className="h-2.5 w-2.5 text-primary" /> Accueil + Footer
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Mail className="h-2.5 w-2.5 text-primary" /> Emails / Tél / WhatsApp
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Share2 className="h-2.5 w-2.5 text-primary" /> Réseaux sociaux + GPS
                  </Badge>
                </>
              ) : engine === "ai-cleaner" ? (
                <>
                  <Badge variant="outline" className="gap-1">
                    <GitMerge className="h-2.5 w-2.5 text-orange-600 dark:text-orange-400" /> Dédup + fusion
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Filter className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" /> Correction tél/email/adresse
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <TrendingUp className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" /> Score qualité 0-100
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <AlertTriangle className="h-2.5 w-2.5 text-orange-600 dark:text-orange-400" /> Détection fermetures
                  </Badge>
                </>
              ) : (
                <>
                  <Badge variant="outline" className="gap-1">
                    <Sparkles className="h-2.5 w-2.5 text-primary" /> Dédup IA
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Activity className="h-2.5 w-2.5 text-primary" /> Anti-CAPTCHA
                  </Badge>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog léger pour la place sélectionnée ( Eye icon preview ) */}
      {selectedPlace && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedPlace(null)}
        >
          <Card className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-primary" />
                  {selectedPlace.name}
                  {selectedPlace.isVerified && <BadgeCheck className="h-4 w-4 text-sky-500" />}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedPlace(null)}>✕</Button>
              </div>
              {selectedPlace.category && (
                <CardDescription>{selectedPlace.category}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {selectedPlace.address && (
                <p className="flex items-start gap-2"><MapPin className="h-4 w-4 text-muted-foreground mt-0.5" /> {selectedPlace.address}</p>
              )}
              {selectedPlace.phone && (
                <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {selectedPlace.phone}</p>
              )}
              {selectedPlace.email && (
                <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {selectedPlace.email}</p>
              )}
              {selectedPlace.website && (
                <p className="flex items-center gap-2 truncate">
                  <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={selectedPlace.website} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate flex items-center gap-1">
                    {selectedPlace.website.replace(/^https?:\/\//, "")}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              )}
              {selectedPlace.description && (
                <p className="text-xs text-muted-foreground pt-2 border-t">{selectedPlace.description}</p>
              )}
              {(selectedPlace.pageUrl || selectedPlace.messenger || selectedPlace.whatsapp || selectedPlace.googleMapsUrl) && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {selectedPlace.pageUrl && (
                    <a href={selectedPlace.pageUrl} target="_blank" rel="noreferrer">
                      <Badge variant="outline" className="gap-1 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                        <FacebookIcon className="h-3 w-3" /> Page Facebook
                      </Badge>
                    </a>
                  )}
                  {selectedPlace.messenger && (
                    <a href={selectedPlace.messenger} target="_blank" rel="noreferrer">
                      <Badge variant="outline" className="gap-1 hover:bg-sky-50 dark:hover:bg-sky-950/30">
                        <MessageCircle className="h-3 w-3 text-sky-500" /> Messenger
                      </Badge>
                    </a>
                  )}
                  {selectedPlace.whatsapp && (
                    <a href={selectedPlace.whatsapp} target="_blank" rel="noreferrer">
                      <Badge variant="outline" className="gap-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800">
                        <MessageCircle className="h-3 w-3 text-emerald-500" /> WhatsApp
                      </Badge>
                    </a>
                  )}
                  {selectedPlace.googleMapsUrl && (
                    <a href={selectedPlace.googleMapsUrl} target="_blank" rel="noreferrer">
                      <Badge variant="outline" className="gap-1 hover:bg-primary/5">
                        <MapPin className="h-3 w-3 text-primary" /> Google Maps
                      </Badge>
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// SOUS-COMPOSANTS
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; icon: React.ElementType; className: string }> = {
    queued: { label: "En file", icon: Clock, className: "bg-muted text-muted-foreground" },
    running: { label: "En cours", icon: Loader2, className: "bg-primary/10 text-primary" },
    completed: { label: "Terminé", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700" },
    failed: { label: "Échec", icon: XCircle, className: "bg-destructive/10 text-destructive" },
    cancelled: { label: "Annulé", icon: Square, className: "bg-muted text-muted-foreground" },
  }
  const m = meta[status] || meta.queued
  const Icon = m.icon
  return (
    <Badge variant="outline" className={cn("text-[10px] gap-1", m.className)}>
      <Icon className={cn("h-2.5 w-2.5", status === "running" && "animate-spin")} />
      {m.label}
    </Badge>
  )
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ElementType }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wide mb-1">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function PlaceCard({ place, onClick }: { place: ScrapedPlace; onClick: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const isFacebook = !!(
    place.pageUrl ||
    place.messenger ||
    place.likesCount !== undefined ||
    place.followersCount !== undefined ||
    place.isVerified !== undefined ||
    place.description
  )

  const description = place.description || ""
  const isLongDesc = description.length > 120

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4" onClick={onClick}>
        <div className="flex items-start gap-2 mb-2">
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg font-bold text-xs shrink-0",
            isFacebook
              ? "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
              : "bg-primary/10 text-primary"
          )}>
            {isFacebook ? <FacebookIcon className="h-4 w-4" /> : place.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-tight line-clamp-2 flex items-center gap-1">
              <span className="truncate">{place.name}</span>
              {place.isVerified && (
                <BadgeCheck className="h-3.5 w-3.5 text-sky-500 shrink-0" aria-label="Page vérifiée" />
              )}
            </p>
            {place.category && (
              <p className="text-[11px] text-muted-foreground mt-0.5">{place.category}</p>
            )}
          </div>
          {place.rating && (
            <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
              {place.rating}
            </Badge>
          )}
        </div>

        {/* Champs standards */}
        <div className="space-y-1 text-[11px]">
          {place.address && (
            <div className="flex items-start gap-1.5 text-muted-foreground">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="line-clamp-2">{place.address}</span>
            </div>
          )}
          {place.phone && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              {place.phone}
            </div>
          )}
          {place.email && (
            <div className="flex items-center gap-1.5 text-muted-foreground truncate">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{place.email}</span>
            </div>
          )}
          {place.website && (
            <div className="flex items-center gap-1.5 text-muted-foreground truncate">
              <Globe className="h-3 w-3 shrink-0" />
              <a
                href={place.website}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="truncate hover:text-primary"
              >
                {place.website.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
        </div>

        {/* Bloc Facebook : description + likes/followers */}
        {isFacebook && (description || place.likesCount !== undefined || place.followersCount !== undefined) && (
          <div className="space-y-1 text-[11px] mt-2 pt-2 border-t border-dashed">
            {description && (
              <div className="text-muted-foreground">
                <p className={cn(!expanded && "line-clamp-2")}>{description}</p>
                {isLongDesc && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
                    className="text-primary hover:underline mt-0.5 text-[10px]"
                  >
                    {expanded ? "Voir moins" : "Voir plus"}
                  </button>
                )}
              </div>
            )}
            {(place.likesCount !== undefined && place.likesCount > 0 || place.followersCount !== undefined && place.followersCount > 0) && (
              <div className="flex flex-wrap items-center gap-3">
                {place.likesCount !== undefined && place.likesCount > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Heart className="h-3 w-3 text-rose-500" />
                    {formatCount(place.likesCount)} j&apos;aime
                  </span>
                )}
                {place.followersCount !== undefined && place.followersCount > 0 && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-3 w-3 text-primary" />
                    {formatCount(place.followersCount)} abonnés
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Liens rapides */}
        {(place.messenger || place.whatsapp || place.pageUrl || place.googleMapsUrl) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t">
            {place.messenger && (
              <a
                href={place.messenger}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Messenger"
              >
                <Badge variant="outline" className="text-[9px] gap-1 hover:bg-sky-50 dark:hover:bg-sky-950/30 cursor-pointer">
                  <MessageCircle className="h-2.5 w-2.5 text-sky-500" /> Messenger
                </Badge>
              </a>
            )}
            {place.whatsapp && (
              <a
                href={place.whatsapp}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="WhatsApp"
              >
                <Badge variant="outline" className="text-[9px] gap-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 cursor-pointer">
                  <MessageCircle className="h-2.5 w-2.5 text-emerald-500" /> WhatsApp
                </Badge>
              </a>
            )}
            {place.pageUrl && (
              <a
                href={place.pageUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Page Facebook"
              >
                <Badge variant="outline" className="text-[9px] gap-1 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800 cursor-pointer">
                  <FacebookIcon className="h-2.5 w-2.5" /> Facebook
                </Badge>
              </a>
            )}
            {place.googleMapsUrl && (
              <a
                href={place.googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Google Maps"
              >
                <Badge variant="outline" className="text-[9px] gap-1 hover:bg-primary/5 cursor-pointer">
                  <MapPin className="h-2.5 w-2.5 text-primary" /> Maps
                </Badge>
              </a>
            )}
          </div>
        )}

        {/* Pied de card */}
        <div className="flex items-center justify-between mt-2 pt-2 text-[10px]">
          <div className="flex items-center gap-2">
            {place.reviewCount !== undefined && (
              <span className="text-muted-foreground">{place.reviewCount} avis</span>
            )}
            {place.isOpenNow !== undefined && (
              <Badge variant="outline" className={cn("text-[9px] h-4 px-1", place.isOpenNow ? "text-emerald-600 border-emerald-200" : "text-red-600 border-red-200")}>
                {place.isOpenNow ? "Ouvert" : "Fermé"}
              </Badge>
            )}
          </div>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}

function BusinessPlaceCard({ place, onClick }: { place: ScrapedPlace; onClick: () => void }) {
  const [expandedDesc, setExpandedDesc] = useState(false)
  const [showAllEmployees, setShowAllEmployees] = useState(false)

  const description = place.description || ""
  const isLongDesc = description.length > 200
  const score = place.identificationScore
  const scoreColor =
    score === undefined
      ? ""
      : score >= 70
      ? "text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30"
      : score >= 40
      ? "text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/30"
      : "text-red-600 border-red-200 bg-red-50 dark:bg-red-950/30"

  const executives = place.executives || []
  const employees = place.employees || []
  const shownEmployees = showAllEmployees ? employees : employees.slice(0, 3)
  const hiddenEmployeesCount = Math.max(0, employees.length - 3)

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4" onClick={onClick}>
        {/* Header: name + LinkedIn link + score */}
        <div className="flex items-start gap-2 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg font-bold text-xs shrink-0 bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-tight line-clamp-2 flex items-center gap-1">
              <span className="truncate">{place.name}</span>
              {place.linkedinUrl && (
                <a
                  href={place.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Page LinkedIn"
                  className="shrink-0 text-orange-600 hover:text-orange-700 dark:text-orange-400"
                >
                  <LinkedinIcon className="h-3.5 w-3.5" />
                </a>
              )}
            </p>
            {place.category && (
              <Badge variant="outline" className="text-[9px] mt-0.5 gap-1">
                <Tag className="h-2.5 w-2.5" /> {place.category}
              </Badge>
            )}
          </div>
          {score !== undefined && (
            <Badge
              variant="outline"
              className={cn("text-[10px] gap-1 shrink-0", scoreColor)}
              title="Score d'identification"
            >
              <Award className="h-2.5 w-2.5" />
              {score}%
            </Badge>
          )}
        </div>

        {/* Company meta: size + type + founded + location + website + followers */}
        <div className="space-y-1 text-[11px]">
          {(place.companySize || place.companyType) && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Briefcase className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {[place.companySize, place.companyType].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}
          {place.foundedYear !== undefined && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              <span>Fondée en {place.foundedYear}</span>
            </div>
          )}
          {place.address && (
            <div className="flex items-start gap-1.5 text-muted-foreground">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
              <span className="line-clamp-2">{place.address}</span>
            </div>
          )}
          {place.website && (
            <div className="flex items-center gap-1.5 text-muted-foreground truncate">
              <Globe className="h-3 w-3 shrink-0" />
              <a
                href={place.website}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="truncate hover:text-primary"
              >
                {place.website.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
          {place.followersCount !== undefined && place.followersCount > 0 && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-3 w-3 shrink-0" />
              <span>{formatCount(place.followersCount)} abonnés LinkedIn</span>
            </div>
          )}
        </div>

        {/* Description */}
        {description && (
          <div className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-dashed">
            <p className={cn(!expandedDesc && "line-clamp-3")}>{description}</p>
            {isLongDesc && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpandedDesc((v) => !v) }}
                className="text-primary hover:underline mt-0.5 text-[10px]"
              >
                {expandedDesc ? "Voir moins" : "Voir plus"}
              </button>
            )}
          </div>
        )}

        {/* Executives */}
        {executives.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-[10px] font-semibold flex items-center gap-1 mb-1">
              <Crown className="h-3 w-3 text-amber-500" /> Dirigeants ({executives.length})
            </p>
            <ul className="space-y-1">
              {executives.slice(0, 5).map((exec, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[11px]">
                  <span aria-hidden="true">👑</span>
                  <span className="font-medium truncate">{exec.name}</span>
                  {exec.title && (
                    <span className="text-muted-foreground truncate">— {exec.title}</span>
                  )}
                  {exec.linkedinUrl && (
                    <a
                      href={exec.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Profil LinkedIn"
                      className="shrink-0 text-orange-600 hover:text-orange-700 dark:text-orange-400 ml-auto"
                    >
                      <LinkedinIcon className="h-3 w-3" />
                    </a>
                  )}
                </li>
              ))}
              {executives.length > 5 && (
                <li className="text-[10px] text-muted-foreground">+ {executives.length - 5} autres</li>
              )}
            </ul>
          </div>
        )}

        {/* Employees */}
        {employees.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-[10px] font-semibold flex items-center gap-1 mb-1">
              <UserCheck className="h-3 w-3 text-primary" /> Employés ({employees.length})
            </p>
            <ul className="space-y-1">
              {shownEmployees.map((emp, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[11px]">
                  <span aria-hidden="true">👤</span>
                  <span className="font-medium truncate">{emp.name}</span>
                  {emp.title && (
                    <span className="text-muted-foreground truncate">— {emp.title}</span>
                  )}
                </li>
              ))}
              {hiddenEmployeesCount > 0 && !showAllEmployees && (
                <li>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowAllEmployees(true) }}
                    className="text-primary hover:underline text-[10px]"
                  >
                    + {hiddenEmployeesCount} autres
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Specialties */}
        {place.specialties && place.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t">
            {place.specialties.slice(0, 6).map((spec, i) => (
              <Badge key={i} variant="secondary" className="text-[9px]">
                {spec}
              </Badge>
            ))}
            {place.specialties.length > 6 && (
              <span className="text-[9px] text-muted-foreground self-center">
                +{place.specialties.length - 6}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 pt-2 text-[10px]">
          <span className="text-muted-foreground">
            {place.employeesOnLinkedin !== undefined && place.employeesOnLinkedin > 0
              ? `${formatCount(place.employeesOnLinkedin)} employés LinkedIn`
              : `Identifié ${new Date(place.scrapedAt).toLocaleDateString("fr-FR")}`}
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Carte spécifique au robot Website
// ---------------------------------------------------------------------------

const PAGE_TYPE_META: Record<string, { label: string; className: string }> = {
  home: { label: "Accueil", className: "text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/40" },
  contact: { label: "Contact", className: "text-orange-700 border-orange-200 bg-orange-50 dark:text-orange-300 dark:border-orange-900 dark:bg-orange-950/40" },
  about: { label: "À propos", className: "text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-300 dark:border-amber-900 dark:bg-amber-950/30" },
  legal: { label: "Mentions légales", className: "text-purple-700 border-purple-200 bg-purple-50 dark:text-purple-300 dark:border-purple-900 dark:bg-purple-950/30" },
  footer: { label: "Footer", className: "text-muted-foreground" },
  other: { label: "Autre", className: "text-muted-foreground" },
}

const SOCIAL_PLATFORM_META: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  facebook: { label: "Facebook", icon: Facebook, className: "text-blue-700 border-blue-200 bg-blue-50 dark:text-blue-300 dark:border-blue-900 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/60" },
  instagram: { label: "Instagram", icon: Instagram, className: "text-pink-700 border-pink-200 bg-pink-50 dark:text-pink-300 dark:border-pink-900 dark:bg-pink-950/40 hover:bg-pink-100 dark:hover:bg-pink-950/60" },
  linkedin: { label: "LinkedIn", icon: Linkedin, className: "text-sky-700 border-sky-200 bg-sky-50 dark:text-sky-300 dark:border-sky-900 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-950/60" },
  twitter: { label: "Twitter", icon: Twitter, className: "text-slate-700 border-slate-200 bg-slate-50 dark:text-slate-300 dark:border-slate-800 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-900/60" },
  youtube: { label: "YouTube", icon: Youtube, className: "text-red-700 border-red-200 bg-red-50 dark:text-red-300 dark:border-red-900 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60" },
  tiktok: { label: "TikTok", icon: Hash, className: "text-slate-800 border-slate-300 bg-slate-100 dark:text-slate-200 dark:border-slate-700 dark:bg-slate-800/40 hover:bg-slate-200 dark:hover:bg-slate-800/60" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, className: "text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60" },
  telegram: { label: "Telegram", icon: Send, className: "text-cyan-700 border-cyan-200 bg-cyan-50 dark:text-cyan-300 dark:border-cyan-900 dark:bg-cyan-950/40 hover:bg-cyan-100 dark:hover:bg-cyan-950/60" },
}

// ---------------------------------------------------------------------------
// Métadonnées IA Cleaner (badges corrections + statuts business)
// ---------------------------------------------------------------------------

const CORRECTION_FIELD_META: Record<string, { icon: React.ElementType; className: string }> = {
  phone: { icon: Phone, className: "text-orange-700 border-orange-200 bg-orange-50 dark:text-orange-300 dark:border-orange-900 dark:bg-orange-950/40" },
  email: { icon: Mail, className: "text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/40" },
  address: { icon: MapPin, className: "text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-300 dark:border-amber-900 dark:bg-amber-950/40" },
  name: { icon: Tag, className: "text-violet-700 border-violet-200 bg-violet-50 dark:text-violet-300 dark:border-violet-900 dark:bg-violet-950/40" },
  sector: { icon: Layers, className: "text-cyan-700 border-cyan-200 bg-cyan-50 dark:text-cyan-300 dark:border-cyan-900 dark:bg-cyan-950/40" },
}

const CORRECTION_METHOD_META: Record<string, { label: string; className: string }> = {
  deterministic: { label: "Déterministe", className: "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-950/50" },
  rule: { label: "Règle", className: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/50" },
  llm: { label: "LLM", className: "text-violet-700 bg-violet-100 dark:text-violet-300 dark:bg-violet-950/50" },
}

const BUSINESS_STATUS_META: Record<BusinessStatus, { label: string; className: string; icon: React.ElementType }> = {
  active: { label: "Active", className: "text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/40", icon: CheckCircle2 },
  closed: { label: "Fermée", className: "text-red-700 border-red-200 bg-red-50 dark:text-red-300 dark:border-red-900 dark:bg-red-950/40", icon: XCircle },
  temporarily_closed: { label: "Fermée temp.", className: "text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-300 dark:border-amber-900 dark:bg-amber-950/40", icon: AlertTriangle },
  relocated: { label: "Déménagée", className: "text-orange-700 border-orange-200 bg-orange-50 dark:text-orange-300 dark:border-orange-900 dark:bg-orange-950/40", icon: Navigation },
  unknown: { label: "Inconnu", className: "text-muted-foreground border-input", icon: AlertCircle },
}

function getQualityScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/40"
  if (score >= 40) return "text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-300 dark:border-amber-900 dark:bg-amber-950/40"
  return "text-red-700 border-red-200 bg-red-50 dark:text-red-300 dark:border-red-900 dark:bg-red-950/40"
}

function WebsitePlaceCard({ place, onClick }: { place: ScrapedPlace; onClick: () => void }) {
  const [expandedDesc, setExpandedDesc] = useState(false)
  const [showAllFooterLinks, setShowAllFooterLinks] = useState(false)

  const wp = place as unknown as WebsitePlace
  const siteName = wp.siteName || place.name
  const siteUrl = wp.siteUrl || place.website || ""
  const metaDescription = wp.metaDescription || place.description || ""
  const isLongDesc = metaDescription.length > 140

  const visitedPages = wp.visitedPages || []
  const emails = wp.emails || []
  const phones = wp.phones || []
  const whatsappList = wp.whatsapp || []
  const socialLinks = wp.socialLinks || []
  const addresses = wp.addresses || []
  const gpsList = wp.gps || []
  const footerLinks = wp.footerLinks || []
  const googleMapsUrl = wp.googleMapsUrl
  const logoUrl = wp.logoUrl
  const language = wp.language

  const shownFooterLinks = showAllFooterLinks ? footerLinks : footerLinks.slice(0, 5)
  const hiddenFooterCount = Math.max(0, footerLinks.length - 5)

  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4" onClick={onClick}>
        {/* Header: logo + site name + external link */}
        <div className="flex items-start gap-2 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 shrink-0 overflow-hidden">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={`Logo ${siteName}`}
                className="h-full w-full object-contain"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement
                  target.style.display = "none"
                }}
              />
            ) : (
              <Globe className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm leading-tight line-clamp-2 flex items-center gap-1">
              <span className="truncate">{siteName}</span>
              {siteUrl && (
                <a
                  href={siteUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Ouvrir le site"
                  className="shrink-0 text-orange-600 hover:text-orange-700 dark:text-orange-400"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </h3>
            {siteUrl && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </p>
            )}
          </div>
          {language && (
            <Badge variant="outline" className="text-[9px] gap-1 shrink-0" title="Langue du site">
              <Languages className="h-2.5 w-2.5" />
              {language.toUpperCase()}
            </Badge>
          )}
        </div>

        {/* Meta description */}
        {metaDescription && (
          <div className="text-[11px] text-muted-foreground mb-2">
            <p className={cn(!expandedDesc && "line-clamp-2")}>{metaDescription}</p>
            {isLongDesc && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setExpandedDesc((v) => !v) }}
                className="text-primary hover:underline mt-0.5 text-[10px]"
              >
                {expandedDesc ? "Voir moins" : "Voir plus"}
              </button>
            )}
          </div>
        )}

        {/* Visited pages */}
        {visitedPages.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-[10px] font-semibold flex items-center gap-1 mb-1.5">
              <Navigation className="h-3 w-3 text-primary" /> Pages visitées ({visitedPages.length})
            </p>
            <ul className="space-y-1 max-h-44 overflow-y-auto pr-1">
              {visitedPages.slice(0, 8).map((page, i) => {
                const meta = PAGE_TYPE_META[page.pageType] || PAGE_TYPE_META.other
                return (
                  <li key={i} className="text-[11px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={cn("text-[9px] h-4 px-1", meta.className)}>
                        {meta.label}
                      </Badge>
                      {page.title && (
                        <span className="font-medium truncate flex-1 min-w-0">{page.title}</span>
                      )}
                      <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                        {page.loadTimeMs ? `${page.loadTimeMs}ms` : ""}
                        {page.status ? ` · ${page.status}` : ""}
                      </span>
                    </div>
                    <p className="text-[9px] text-muted-foreground truncate pl-1" title={page.url}>
                      {page.url}
                    </p>
                    {page.error && (
                      <p className="text-[9px] text-destructive pl-1">⚠ {page.error}</p>
                    )}
                  </li>
                )
              })}
              {visitedPages.length > 8 && (
                <li className="text-[10px] text-muted-foreground">
                  + {visitedPages.length - 8} autres pages
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Emails */}
        {emails.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-[10px] font-semibold flex items-center gap-1 mb-1.5">
              <Mail className="h-3 w-3 text-primary" /> Emails ({emails.length})
            </p>
            <ul className="space-y-1">
              {emails.slice(0, 5).map((e, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[11px]">
                  <span aria-hidden="true">✉️</span>
                  <a
                    href={`mailto:${e.email}`}
                    onClick={(ev) => ev.stopPropagation()}
                    className="truncate hover:text-primary flex-1 min-w-0"
                    title={e.email}
                  >
                    {e.email}
                  </a>
                  {e.fromMailtoLink && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/40 shrink-0">
                      mailto
                    </Badge>
                  )}
                </li>
              ))}
              {emails.length > 5 && (
                <li className="text-[10px] text-muted-foreground">+ {emails.length - 5} autres</li>
              )}
            </ul>
          </div>
        )}

        {/* Phones */}
        {phones.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-[10px] font-semibold flex items-center gap-1 mb-1.5">
              <Phone className="h-3 w-3 text-primary" /> Téléphones ({phones.length})
            </p>
            <ul className="space-y-1">
              {phones.slice(0, 5).map((p, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[11px]">
                  <span aria-hidden="true">📞</span>
                  <a
                    href={`tel:${p.normalized}`}
                    onClick={(ev) => ev.stopPropagation()}
                    className="truncate hover:text-primary flex-1 min-w-0"
                    title={p.raw}
                  >
                    {p.normalized || p.raw}
                  </a>
                  {p.fromTelLink && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 text-orange-700 border-orange-200 bg-orange-50 dark:text-orange-300 dark:border-orange-900 dark:bg-orange-950/40 shrink-0">
                      tel:
                    </Badge>
                  )}
                </li>
              ))}
              {phones.length > 5 && (
                <li className="text-[10px] text-muted-foreground">+ {phones.length - 5} autres</li>
              )}
            </ul>
          </div>
        )}

        {/* WhatsApp */}
        {whatsappList.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-[10px] font-semibold flex items-center gap-1 mb-1.5">
              <MessageCircle className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> WhatsApp ({whatsappList.length})
            </p>
            <ul className="space-y-1">
              {whatsappList.slice(0, 3).map((w, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[11px]">
                  <span aria-hidden="true">💬</span>
                  <a
                    href={`https://wa.me/${w.normalized.replace(/[^\d]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(ev) => ev.stopPropagation()}
                    className="truncate hover:text-emerald-700 dark:hover:text-emerald-300 flex-1 min-w-0"
                    title={w.raw}
                  >
                    {w.normalized || w.raw}
                  </a>
                  <Badge variant="outline" className="text-[9px] h-4 px-1 text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/40 shrink-0">
                    WhatsApp
                  </Badge>
                </li>
              ))}
              {whatsappList.length > 3 && (
                <li className="text-[10px] text-muted-foreground">+ {whatsappList.length - 3} autres</li>
              )}
            </ul>
          </div>
        )}

        {/* Social links + Google Maps */}
        {(socialLinks.length > 0 || googleMapsUrl) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t">
            {socialLinks.map((s, i) => {
              const meta = SOCIAL_PLATFORM_META[s.platform] || { label: s.platform, icon: Link2, className: "text-muted-foreground" }
              const Icon = meta.icon
              return (
                <a
                  key={`${s.platform}-${i}`}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title={s.handle ? `${meta.label} : ${s.handle}` : meta.label}
                >
                  <Badge variant="outline" className={cn("text-[9px] gap-1 cursor-pointer", meta.className)}>
                    <Icon className="h-2.5 w-2.5" />
                    {meta.label}
                  </Badge>
                </a>
              )
            })}
            {googleMapsUrl && (
              <a
                href={googleMapsUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Google Maps"
              >
                <Badge variant="outline" className="text-[9px] gap-1 cursor-pointer text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/60">
                  <span aria-hidden="true">🗺️</span>
                  Google Maps
                </Badge>
              </a>
            )}
          </div>
        )}

        {/* Addresses */}
        {addresses.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-[10px] font-semibold flex items-center gap-1 mb-1.5">
              <MapPin className="h-3 w-3 text-primary" /> Adresses ({addresses.length})
            </p>
            <ul className="space-y-1">
              {addresses.slice(0, 3).map((a, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <span aria-hidden="true">📍</span>
                  <span className="line-clamp-2">{a}</span>
                </li>
              ))}
              {addresses.length > 3 && (
                <li className="text-[10px] text-muted-foreground">+ {addresses.length - 3} autres</li>
              )}
            </ul>
          </div>
        )}

        {/* GPS coordinates */}
        {gpsList.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-[10px] font-semibold flex items-center gap-1 mb-1.5">
              <Navigation className="h-3 w-3 text-primary" /> Coordonnées GPS ({gpsList.length})
            </p>
            <ul className="space-y-1">
              {gpsList.slice(0, 3).map((g, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[11px]">
                  <a
                    href={`https://www.google.com/maps?q=${g.lat},${g.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono hover:text-primary"
                    title={`Source: ${g.source} · Trouvé sur ${g.foundOn}`}
                  >
                    {g.lat.toFixed(5)}, {g.lng.toFixed(5)}
                  </a>
                  <Badge variant="outline" className="text-[9px] h-4 px-1 text-muted-foreground shrink-0">
                    {g.source}
                  </Badge>
                </li>
              ))}
              {gpsList.length > 3 && (
                <li className="text-[10px] text-muted-foreground">+ {gpsList.length - 3} autres</li>
              )}
            </ul>
          </div>
        )}

        {/* Footer links (collapsible) */}
        {footerLinks.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-[10px] font-semibold flex items-center gap-1 mb-1.5">
              <Link2 className="h-3 w-3 text-primary" /> Liens du footer ({footerLinks.length})
            </p>
            <ul className="space-y-0.5">
              {shownFooterLinks.map((f, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[11px]">
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="truncate text-muted-foreground hover:text-primary flex-1 min-w-0"
                    title={f.url}
                  >
                    {f.text || f.url}
                  </a>
                </li>
              ))}
              {hiddenFooterCount > 0 && (
                <li>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowAllFooterLinks((v) => !v) }}
                    className="text-primary hover:underline text-[10px] flex items-center gap-1"
                  >
                    {showAllFooterLinks ? (
                      <><ChevronUp className="h-3 w-3" /> Voir moins</>
                    ) : (
                      <><ChevronDown className="h-3 w-3" /> + {hiddenFooterCount} autres</>
                    )}
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 pt-2 text-[10px]">
          <span className="text-muted-foreground">
            Extrait {new Date(place.scrapedAt).toLocaleDateString("fr-FR")}
          </span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Carte spécifique au moteur IA Cleaner (entité nettoyée)
// ---------------------------------------------------------------------------

function QualityScoreBadge({ score, breakdown }: { score: number; breakdown?: QualityBreakdown }) {
  const color = getQualityScoreColor(score)
  const dims = breakdown
    ? [
      { k: "Complétude", v: breakdown.completeness },
      { k: "Coordonnées", v: breakdown.contactValidity },
      { k: "Nom", v: breakdown.nameQuality },
      { k: "Géoloc", v: breakdown.geoAccuracy },
      { k: "Source", v: breakdown.sourceReliability },
      { k: "Fraîcheur", v: breakdown.freshness },
      { k: "Online", v: breakdown.onlinePresence },
    ]
    : []
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("text-[10px] gap-1 cursor-help", color)}>
            <TrendingUp className="h-2.5 w-2.5" />
            {score.toFixed(0)}/100
          </Badge>
        </TooltipTrigger>
        {breakdown && (
          <TooltipContent side="bottom" className="p-3 w-56 bg-slate-900 text-slate-100 border-slate-700">
            <p className="text-[10px] font-semibold mb-1.5 uppercase tracking-wide text-slate-300">
              Détail du score
            </p>
            <div className="space-y-1">
              {dims.map((d) => (
                <div key={d.k} className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="text-slate-300">{d.k}</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          d.v >= 70 ? "bg-emerald-500" : d.v >= 40 ? "bg-amber-500" : "bg-red-500"
                        )}
                        style={{ width: `${Math.max(0, Math.min(100, d.v))}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-slate-200 w-6 text-right">{d.v.toFixed(0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}

function CleanedEntityCard({ entity }: { entity: CleanedEntity }) {
  const [showAliases, setShowAliases] = useState(false)
  const name = entity.cleanedName || entity.name
  const aliases = entity.aliases || []
  const phone = entity.cleanedPhone || entity.phone
  const email = entity.cleanedEmail || entity.email
  const address = entity.cleanedAddress || entity.address
  const status = entity.businessStatus
  const statusMeta = status ? BUSINESS_STATUS_META[status] : null
  const StatusIcon = statusMeta?.icon
  const aiCompletions = entity.aiCompletions || []
  const components = entity.addressComponents
  const sectorCode = entity.sectorCode
  const sector = entity.detectedSector || entity.sector || entity.category

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Header : name + sector + quality score + business status */}
        <div className="flex items-start gap-2 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 shrink-0">
            <BrainCircuit className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-tight line-clamp-2">
              {name}
            </p>
            {aliases.length > 0 && (
              <div className="mt-0.5">
                <button
                  type="button"
                  onClick={() => setShowAliases((v) => !v)}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAliases ? "▼" : "▶"} {aliases.length} alias
                </button>
                {showAliases && (
                  <ul className="mt-1 space-y-0.5">
                    {aliases.map((a, i) => (
                      <li key={i} className="text-[10px] text-muted-foreground italic truncate">
                        « {a} »
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {sector && (
              <div className="flex flex-wrap gap-1 mt-1">
                <Badge variant="outline" className="text-[9px] gap-1 text-cyan-700 border-cyan-200 bg-cyan-50 dark:text-cyan-300 dark:border-cyan-900 dark:bg-cyan-950/40">
                  <Layers className="h-2.5 w-2.5" />
                  {sector}
                </Badge>
                {sectorCode && (
                  <Badge variant="outline" className="text-[9px] font-mono">
                    {sectorCode}
                  </Badge>
                )}
              </div>
            )}
          </div>
          {entity.qualityScore !== undefined && (
            <QualityScoreBadge score={entity.qualityScore} breakdown={entity.qualityBreakdown} />
          )}
        </div>

        {/* Phone */}
        {phone && (
          <div className="space-y-0.5 text-[11px]">
            <div className="flex items-center gap-1.5">
              <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="font-mono truncate">{phone}</span>
              {entity.phoneCorrected && (
                <Badge variant="outline" className="text-[9px] h-4 px-1 text-orange-700 border-orange-200 bg-orange-50 dark:text-orange-300 dark:border-orange-900 dark:bg-orange-950/40 shrink-0">
                  corrigé
                </Badge>
              )}
            </div>
            {entity.phoneCorrected && entity.originalPhone && entity.originalPhone !== phone && (
              <div className="flex items-center gap-1.5 pl-4 text-muted-foreground">
                <span className="line-through font-mono text-[10px]">{entity.originalPhone}</span>
              </div>
            )}
          </div>
        )}

        {/* Email */}
        {email && (
          <div className="space-y-0.5 text-[11px] mt-1">
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="truncate font-mono">{email}</span>
              {entity.emailCorrected && (
                <Badge variant="outline" className="text-[9px] h-4 px-1 text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/40 shrink-0">
                  corrigé
                </Badge>
              )}
              {entity.emailValid !== undefined && (
                <Badge variant="outline" className={cn(
                  "text-[9px] h-4 px-1 shrink-0",
                  entity.emailValid
                    ? "text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/40"
                    : "text-red-700 border-red-200 bg-red-50 dark:text-red-300 dark:border-red-900 dark:bg-red-950/40"
                )}>
                  {entity.emailValid ? "valide" : "invalide"}
                </Badge>
              )}
            </div>
            {entity.emailCorrected && entity.originalEmail && entity.originalEmail !== email && (
              <div className="flex items-center gap-1.5 pl-4 text-muted-foreground">
                <span className="line-through font-mono text-[10px]">{entity.originalEmail}</span>
              </div>
            )}
          </div>
        )}

        {/* Address (normalized) */}
        {address && (
          <div className="space-y-0.5 text-[11px] mt-1">
            <div className="flex items-start gap-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <span className="line-clamp-2">{address}</span>
            </div>
            {components && (
              <div className="flex flex-wrap gap-1 pl-4">
                {components.number && <Badge variant="outline" className="text-[9px] h-4 px-1">N° {components.number}</Badge>}
                {components.street && <Badge variant="outline" className="text-[9px] h-4 px-1">{components.street}</Badge>}
                {components.commune && <Badge variant="outline" className="text-[9px] h-4 px-1">{components.commune}</Badge>}
                {components.city && <Badge variant="outline" className="text-[9px] h-4 px-1">{components.city}</Badge>}
                {components.country && <Badge variant="outline" className="text-[9px] h-4 px-1">{components.country}</Badge>}
              </div>
            )}
          </div>
        )}

        {/* Website + rating (heritage ScrapedPlace) */}
        {(entity.website || entity.rating !== undefined) && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] mt-1">
            {entity.website && (
              <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                <Globe className="h-3 w-3 shrink-0" />
                <a
                  href={entity.website.startsWith("http") ? entity.website : `https://${entity.website}`}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate hover:text-primary"
                >
                  {entity.website.replace(/^https?:\/\//, "")}
                </a>
              </div>
            )}
            {entity.rating !== undefined && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                {entity.rating}
                {entity.reviewCount !== undefined && ` (${entity.reviewCount})`}
              </span>
            )}
          </div>
        )}

        {/* Business status badge + closure indicators */}
        {statusMeta && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2 pt-2 border-t">
            <Badge variant="outline" className={cn("text-[9px] gap-1", statusMeta.className)}>
              {StatusIcon && <StatusIcon className="h-2.5 w-2.5" />}
              {statusMeta.label}
            </Badge>
            {entity.closureIndicators && entity.closureIndicators.length > 0 && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-[9px] gap-1 cursor-help text-amber-700 border-amber-200 bg-amber-50 dark:text-amber-300 dark:border-amber-900 dark:bg-amber-950/40">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {entity.closureIndicators.length} indicateur(s)
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="bg-slate-900 text-slate-100 border-slate-700 max-w-xs">
                    <ul className="space-y-0.5">
                      {entity.closureIndicators.map((ind, i) => (
                        <li key={i} className="text-[10px]">• {ind}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        )}

        {/* AI completions */}
        {aiCompletions.length > 0 && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-[10px] font-semibold flex items-center gap-1 mb-1">
              <Wand2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Complétions IA ({aiCompletions.length})
            </p>
            <ul className="space-y-1">
              {aiCompletions.slice(0, 5).map((c, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[11px]">
                  <Badge variant="outline" className="text-[9px] h-4 px-1 text-emerald-700 border-emerald-200 bg-emerald-50 dark:text-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/40 shrink-0">
                    {c.field}
                  </Badge>
                  <span className="truncate flex-1 min-w-0" title={c.value}>{c.value}</span>
                  <span className={cn(
                    "text-[9px] tabular-nums shrink-0",
                    c.confidence >= 0.85 ? "text-emerald-600 dark:text-emerald-400"
                    : c.confidence >= 0.6 ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
                  )}>
                    {(c.confidence * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
              {aiCompletions.length > 5 && (
                <li className="text-[10px] text-muted-foreground">+ {aiCompletions.length - 5} autres</li>
              )}
            </ul>
          </div>
        )}

        {/* Footer : merged count + date */}
        <div className="flex items-center justify-between mt-2 pt-2 text-[10px]">
          <div className="flex items-center gap-2">
            {entity.mergedCount !== undefined && entity.mergedCount > 1 && (
              <Badge variant="outline" className="text-[9px] gap-1 text-orange-700 border-orange-200 bg-orange-50 dark:text-orange-300 dark:border-orange-900 dark:bg-orange-950/40">
                <GitMerge className="h-2.5 w-2.5" />
                {entity.mergedCount} fiches fusionnées
              </Badge>
            )}
            {entity.sources && entity.sources.length > 0 && (
              <span className="text-muted-foreground flex items-center gap-1">
                <Database className="h-2.5 w-2.5" />
                {entity.sources.join(" · ")}
              </span>
            )}
          </div>
          <span className="text-muted-foreground">
            {entity.cleaningMetadata?.cleanedAt
              ? new Date(entity.cleaningMetadata.cleanedAt).toLocaleDateString("fr-FR")
              : entity.scrapedAt
              ? new Date(entity.scrapedAt).toLocaleDateString("fr-FR")
              : ""}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function formatEvent(event: { type: string; [key: string]: unknown }): string {
  switch (event.type) {
    // Google Maps events
    case "start":
      return "🚀 Démarrage du scraping"
    case "search-loaded":
      return `🔍 Page de recherche chargée (${event.resultsOnPage} résultats visibles)`
    case "scroll":
      return `📜 Scroll ${event.scrollIndex} → ${event.totalResults} résultats`
    case "place-extracted":
      return `✓ Extrait: ${(event.place as { name?: string })?.name || ""} (#${event.index})`
    case "duplicate-detected":
      return `↺ Doublon détecté: ${(event.place as { name?: string })?.name || ""} → ${event.duplicateOf}`
    case "block-detected":
      return `⚠️ Blocage (${event.reason}) ${event.retrying ? "— retry en cours" : ""}`
    case "error":
      return `✗ Erreur: ${event.message}`
    case "progress":
      return `📊 Phase: ${event.phase} (${event.progress}%)`
    case "complete":
      return `✅ Terminé : ${event.results ? (event.results as unknown[]).length : 0} lieux, ${event.duplicates} doublons, en ${(Number(event.durationMs) / 1000).toFixed(1)}s`
    case "cancelled":
      return "⏹️ Annulé"
    // Facebook events
    case "fb-login-required":
      return "🔐 Connexion Facebook requise"
    case "fb-consent-required":
      return "🍪 Bannière cookies détectée"
    case "fb-page-loaded":
      return `📄 Page chargée: ${event.pageName || ""}`
    case "fb-search-loaded":
      return `🔍 Recherche: ${event.resultsCount || 0} pages`
    case "fb-extracted":
      return `✓ Extrait: ${(event.place as { name?: string })?.name || event.name || ""}`
    case "fb-error":
      return `✗ Erreur: ${event.message}`
    // Business/LinkedIn events
    case "biz-search-loaded":
      return `🔍 Recherche: ${event.resultsCount || 0} entreprises`
    case "biz-page-loaded":
      return `🏢 Page chargée: ${event.companyName || ""}`
    case "biz-extracted":
      return `✓ Identifié: ${(event.entity as { name?: string })?.name || ""}`
    case "biz-people-found":
      return `👥 ${event.executivesCount || 0} dirigeant(s), ${event.employeesCount || 0} employé(s)`
    case "biz-fallback":
      return `🔄 Fallback: ${event.source || ""} — ${event.reason || ""}`
    case "biz-error":
      return `✗ Erreur: ${event.message}`
    // Website Robot events
    case "ws-page-visit":
      return `🔍 Visite: ${event.pageType || ""} ${event.url || ""}`
    case "ws-page-loaded":
      return `✓ Page chargée: ${event.title || ""} (${event.loadTimeMs || 0}ms)`
    case "ws-contacts-found":
      return `📊 Trouvé: ${event.emails || 0} emails, ${event.phones || 0} tél, ${event.socials || 0} réseaux`
    case "ws-extracted":
      return "✅ Extraction terminée"
    case "ws-error":
      return `✗ Erreur: ${event.message}${event.url ? ` (${event.url})` : ""}`
    case "ws-progress":
      return `📊 Phase: ${event.phase || ""} (${event.progress || 0}%)`
    // IA Cleaner events
    case "ai-start":
      return `🚀 Démarrage: ${event.totalEntities} entité(s)`
    case "ai-dedup-start":
      return "🔀 Déduplication : analyse des similarités…"
    case "ai-dedup-done":
      return `🔀 Dédup: ${event.duplicatesRemoved} doublon(s) supprimé(s) (${event.groups} groupe(s))`
    case "ai-merge-start":
      return `🔗 Fusion groupe ${event.groupIndex || 0}/${event.total || 0}`
    case "ai-merge-done":
      return `🔗 Fusion: ${event.canonicalName || ""} (${event.mergedCount || 0} fiche(s))`
    case "ai-correct-start":
      return `🔧 Correction: ${(event.entityId as string) || ""}`
    case "ai-correct-phone":
      return `📞 Tél corrigé: ${event.from || ""} → ${event.to || ""}`
    case "ai-correct-email":
      return `✉️ Email corrigé: ${event.from || ""} → ${event.to || ""}`
    case "ai-normalize-address":
      return `📍 Adresse normalisée: ${event.from || ""} → ${event.to || ""}`
    case "ai-enrich-start":
      return `✨ Enrichissement: ${(event.missingFields as unknown[])?.length || 0} champ(s) manquant(s)`
    case "ai-enrich-done":
      return `✨ Enrichi: ${(event.completedFields as unknown[])?.length || 0} champ(s) complété(s)`
    case "ai-sector-detect":
      return `🏭 Secteur: ${event.sector || ""} (${typeof event.confidence === "number" ? (event.confidence * 100).toFixed(0) : "0"}%)`
    case "ai-quality-score":
      return `📊 Score: ${event.score || 0}/100`
    case "ai-closed-detect": {
      const indicators = event.indicators as unknown[] | undefined
      return `🔒 Statut: ${event.status || "unknown"}${indicators && indicators.length > 0 ? ` (${indicators.length} indicateur(s))` : ""}`
    }
    case "ai-progress":
      return `📊 Phase: ${event.phase || ""} (${event.progress || 0}%)`
    case "ai-error":
      return `✗ Erreur IA: ${event.message}${event.entityId ? ` (${event.entityId})` : ""}`
    case "ai-complete": {
      const report = event.report as { output?: { cleanedEntities?: number; duplicatesRemoved?: number }; durationMs?: number } | undefined
      return `✅ Nettoyage terminé : ${report?.output?.cleanedEntities ?? 0} entité(s), ${report?.output?.duplicatesRemoved ?? 0} doublon(s), en ${((report?.durationMs ?? 0) / 1000).toFixed(1)}s`
    }
    default:
      return event.type
  }
}
