"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Radar, Play, Square, RefreshCw, Download, MapPin, Phone, Mail, Globe,
  Star, Clock, Tag, Building2, AlertCircle, AlertTriangle, CheckCircle2,
  Loader2, XCircle, Eye, ChevronRight, ExternalLink, Activity, Sparkles,
  MessageCircle, BadgeCheck, Heart, Users, Briefcase, Crown, UserCheck, Award
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
import { toast } from "sonner"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Engine = "google-maps" | "facebook" | "business"

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
  query: { keyword: string; city?: string; commune?: string; neighborhood?: string; maxResults?: number; pageUrl?: string }
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

  const [jobs, setJobs] = useState<Record<Engine, JobState | null>>({
    "google-maps": null,
    facebook: null,
    business: null,
  })
  const [pollingEngine, setPollingEngine] = useState<Engine | null>(null)
  const [launching, setLaunching] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState<ScrapedPlace | null>(null)

  const currentJob = jobs[engine]
  const isRunning = currentJob?.progress.status === "running" || currentJob?.progress.status === "queued"

  // Polling de l'état du job (par moteur)
  const pollJob = useCallback(async (jobId: string, eng: Engine) => {
    try {
      const res = await fetch(ENDPOINTS[eng].job(jobId), { credentials: "include" })
      if (!res.ok) return
      const data: JobState = await res.json()
      setJobs((prev) => ({ ...prev, [eng]: data }))

      if (data.progress.status === "running" || data.progress.status === "queued") {
        setTimeout(() => pollJob(jobId, eng), 1500)
      } else {
        setPollingEngine((cur) => (cur === eng ? null : cur))
        if (data.progress.status === "completed" && data.result) {
          toast.success(eng === "business" ? "Identification terminée" : "Scraping terminé", {
            description: `${data.result.stats.uniqueCount} ${eng === "business" ? "entreprise(s)" : "lieu(s)"} unique(s) extrait(s) en ${(data.result.stats.durationMs / 1000).toFixed(1)}s`,
          })
        } else if (data.progress.status === "failed") {
          toast.error("Scraping échoué", {
            description: data.progress.errors[0] || "Erreur inconnue",
          })
        }
      }
    } catch (err) {
      console.error("[poll] error:", err)
      setPollingEngine((cur) => (cur === eng ? null : cur))
    }
  }, [])

  // Lance un job
  const launchJob = async () => {
    const isDirectPage = engine === "facebook" && pageUrl.trim().length > 0
    const isBusinessDirect =
      engine === "business" && (linkedinSlug.trim().length > 0 || linkedinUrl.trim().length > 0)

    if (engine === "business") {
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

      if (engine === "business") {
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
        toast.info(engine === "business" ? "Job d'identification lancé" : "Job de scraping lancé", {
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
            ) : (
              <Tag className="h-4 w-4 text-primary" />
            )}
            Critères de recherche{engine === "facebook" ? " — Facebook" : engine === "business" ? " — Business / LinkedIn" : " — Google Maps"}
          </CardTitle>
          <CardDescription className="text-xs">
            {engine === "facebook"
              ? "Le moteur va ouvrir Facebook, charger les pages et extraire les coordonnées (Messenger, WhatsApp, site, etc.)"
              : engine === "business"
              ? "Le moteur va identifier l'entreprise sur LinkedIn, extraire dirigeants et employés, avec fallbacks (Google, Pages Jaunes)"
              : "Le moteur va ouvrir Google Maps, scroller les résultats et extraire chaque fiche détaillée"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {/* Champs standards (masqués en mode pageUrl direct) */}
          {engine !== "business" && (
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
                  : "Anti-blocage (CAPTCHA, 429, consent)"}
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                {engine === "business" ? "Dirigeants & employés" : "Dédup IA (Jaro-Winkler + GPS)"}
              </span>
              <span className="hidden sm:flex items-center gap-1">
                <Activity className="h-3 w-3 text-primary" />
                {engine === "facebook"
                  ? "Extraction Messenger/WhatsApp"
                  : engine === "business"
                  ? "Score de confiance 0-100"
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
                  {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  {engine === "business" ? "Lancer l'identification" : "Lancer le scraping"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progression en temps réel */}
      {currentJob && (
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
              <StatCard label="Extraits" value={currentJob.progress.processedCount} icon={CheckCircle2} />
              <StatCard label="Doublons" value={currentJob.progress.duplicatesDetected} icon={AlertCircle} />
              <StatCard label="Uniques" value={currentJob.progress.resultsCount - currentJob.progress.duplicatesDetected} icon={Sparkles} />
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
                      (event.type === "error" || event.type === "fb-error" || event.type === "biz-error") && "text-red-400",
                      (event.type === "block-detected" || event.type === "fb-login-required" || event.type === "fb-consent-required" || event.type === "biz-fallback") && "text-amber-400",
                      (event.type === "place-extracted" || event.type === "fb-extracted" || event.type === "biz-extracted") && "text-emerald-400",
                      (event.type === "duplicate-detected" || event.type === "fb-page-loaded" || event.type === "fb-search-loaded" || event.type === "biz-page-loaded" || event.type === "biz-search-loaded" || event.type === "biz-people-found") && "text-cyan-400",
                      event.type === "complete" && "text-emerald-400 font-semibold",
                      !["error", "fb-error", "biz-error", "block-detected", "fb-login-required", "fb-consent-required", "biz-fallback", "place-extracted", "fb-extracted", "biz-extracted", "duplicate-detected", "fb-page-loaded", "fb-search-loaded", "biz-page-loaded", "biz-search-loaded", "biz-people-found", "complete"].includes(event.type) && "text-slate-400",
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

      {/* Résultats */}
      {currentJob?.result && currentJob.result.places.length > 0 && (
        <Tabs defaultValue="grid">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="grid">
                {engine === "facebook" ? "Pages" : engine === "business" ? "Entreprises" : "Résultats"} ({currentJob.result.places.length})
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

      {/* État initial : pas de job */}
      {!currentJob && !launching && (
        <Card>
          <CardContent className="p-12 text-center">
            {engine === "facebook" ? (
              <FacebookIcon className="h-12 w-12 mx-auto mb-3 text-orange-500 dark:text-orange-400 opacity-70" />
            ) : engine === "business" ? (
              <Building2 className="h-12 w-12 mx-auto mb-3 text-orange-500 dark:text-orange-400 opacity-70" />
            ) : (
              <Radar className="h-12 w-12 mx-auto mb-3 text-primary opacity-50" />
            )}
            <p className="font-semibold mb-1">
              Prêt à {engine === "facebook" ? "scraper Facebook" : engine === "business" ? "identifier des entreprises" : "scraper Google Maps"}
            </p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {engine === "facebook"
                ? "Configurez vos critères (ou une URL de page) ci-dessus, ajoutez vos cookies Facebook si possible, puis cliquez sur « Lancer le scraping »."
                : engine === "business"
                ? "Renseignez un nom d'entreprise, un slug ou une URL LinkedIn, ajoutez des cookies (li_at) pour les PME, puis lancez l'identification. Dirigeants et employés seront extraits automatiquement."
                : "Configurez vos critères ci-dessus puis cliquez sur « Lancer le scraping ». Le moteur ouvrira Google Maps en mode headless, extraira chaque fiche et dédupliquera les résultats automatiquement."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] text-muted-foreground">
              <Badge variant="outline" className="gap-1">
                <CheckCircle2 className="h-2.5 w-2.5 text-primary" /> Playwright + Chromium
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
    default:
      return event.type
  }
}
