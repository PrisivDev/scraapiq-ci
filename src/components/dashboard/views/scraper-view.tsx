"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Radar, Play, Square, RefreshCw, Download, MapPin, Phone, Mail, Globe,
  Star, Clock, Tag, Building2, AlertCircle, CheckCircle2, Loader2,
  XCircle, Eye, ChevronRight, ExternalLink, Activity, Sparkles
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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
  query: { keyword: string; city?: string; commune?: string; neighborhood?: string; maxResults?: number }
  progress: JobProgress
  result?: ScrapeResult
  events: Array<{ type: string; [key: string]: unknown }>
  createdAt: string
}

export function ScraperView() {
  const [keyword, setKeyword] = useState("restaurant")
  const [city, setCity] = useState("Abidjan")
  const [commune, setCommune] = useState("Cocody")
  const [neighborhood, setNeighborhood] = useState("")
  const [maxResults, setMaxResults] = useState(10)
  const [currentJob, setCurrentJob] = useState<JobState | null>(null)
  const [polling, setPolling] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [recentJobs, setRecentJobs] = useState<JobState[]>([])
  const [selectedPlace, setSelectedPlace] = useState<ScrapedPlace | null>(null)

  // Polling de l'état du job
  const pollJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/scraper/jobs/${jobId}`, { credentials: "include" })
      if (!res.ok) return
      const data: JobState = await res.json()
      setCurrentJob(data)

      // Continue à poller si le job est en cours
      if (data.progress.status === "running" || data.progress.status === "queued") {
        setTimeout(() => pollJob(jobId), 1500)
      } else {
        setPolling(false)
        if (data.progress.status === "completed" && data.result) {
          toast.success("Scraping terminé", {
            description: `${data.result.stats.uniqueCount} lieu(x) unique(s) extrait(s) en ${(data.result.stats.durationMs / 1000).toFixed(1)}s`,
          })
        } else if (data.progress.status === "failed") {
          toast.error("Scraping échoué", {
            description: data.progress.errors[0] || "Erreur inconnue",
          })
        }
      }
    } catch (err) {
      console.error("[poll] error:", err)
      setPolling(false)
    }
  }, [])

  // Lance un job
  const launchJob = async () => {
    if (!keyword.trim()) {
      toast.error("Veuillez saisir un mot-clé")
      return
    }

    setLaunching(true)
    try {
      const res = await fetch("/api/scraper/google-maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          keyword: keyword.trim(),
          city: city.trim() || undefined,
          commune: commune.trim() || undefined,
          neighborhood: neighborhood.trim() || undefined,
          maxResults,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Échec du lancement")
      }

      const { jobId } = await res.json()
      toast.info("Job de scraping lancé", {
        description: `Recherche "${keyword}" à ${commune || city}`,
      })

      setPolling(true)
      pollJob(jobId)
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
      await fetch(`/api/scraper/jobs/${currentJob.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      toast.info("Job annulé")
      pollJob(currentJob.id)
    } catch {
      toast.error("Erreur lors de l'annulation")
    }
  }

  // Récupère les jobs récents au montage
  useEffect(() => {
    fetch("/api/scraper/jobs", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.jobs && data.jobs.length > 0) {
          // Charge le dernier job en détail
          pollJob(data.jobs[0].id)
        }
      })
      .catch(() => {})
  }, [pollJob])

  const isRunning = currentJob?.progress.status === "running" || currentJob?.progress.status === "queued"

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Radar className="h-6 w-6 text-primary" />
            Moteur de scraping Google Maps
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Playwright · Extraction complète · Déduplication IA · Anti-blocage
          </p>
        </div>
        {isRunning && (
          <Badge variant="outline" className="bg-primary/10 text-primary gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Scraping en cours…
          </Badge>
        )}
      </div>

      {/* Formulaire de recherche */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Critères de recherche
          </CardTitle>
          <CardDescription className="text-xs">
            Le moteur va ouvrir Google Maps, scroller les résultats et extraire chaque fiche détaillée
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4 space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <Tag className="h-3 w-3" /> Mot-clé *
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

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-primary" /> Anti-blocage (CAPTCHA, 429, consent)
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" /> Dédup IA (Jaro-Winkler + GPS)
              </span>
              <span className="hidden sm:flex items-center gap-1">
                <Activity className="h-3 w-3 text-primary" /> Backoff exponentiel
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
                  Lancer le scraping
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
                Progression — Job <span className="font-mono text-xs text-muted-foreground">{currentJob.id}</span>
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
                      event.type === "error" && "text-red-400",
                      event.type === "block-detected" && "text-amber-400",
                      event.type === "place-extracted" && "text-emerald-400",
                      event.type === "duplicate-detected" && "text-cyan-400",
                      event.type === "complete" && "text-emerald-400 font-semibold",
                      !["error", "block-detected", "place-extracted", "duplicate-detected", "complete"].includes(event.type) && "text-slate-400",
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
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="grid">Résultats ({currentJob.result.places.length})</TabsTrigger>
              <TabsTrigger value="duplicates">Doublons ({currentJob.result.duplicates.length})</TabsTrigger>
              <TabsTrigger value="stats">Stats</TabsTrigger>
            </TabsList>
            <a href={`/api/scraper/jobs/${currentJob.id}?format=csv`} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </a>
          </div>

          <TabsContent value="grid" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentJob.result.places.map((place, i) => (
                <PlaceCard key={i} place={place} onClick={() => setSelectedPlace(place)} />
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="Lieux extraits (total)" value={currentJob.result.stats.totalExtracted} icon={CheckCircle2} />
              <StatCard label="Lieux uniques" value={currentJob.result.stats.uniqueCount} icon={Sparkles} />
              <StatCard label="Doublons fusionnés" value={currentJob.result.stats.duplicatesCount} icon={AlertCircle} />
              <StatCard label="Pages scrapées" value={currentJob.result.stats.pagesScraped} icon={Activity} />
              <StatCard label="Blocages rencontrés" value={currentJob.result.stats.blocksEncountered} icon={XCircle} />
              <StatCard label="Retries" value={currentJob.result.stats.retries} icon={RefreshCw} />
              <StatCard label="Durée totale" value={`${(currentJob.result.stats.durationMs / 1000).toFixed(1)}s`} icon={Clock} />
              <StatCard label="Vitesse moyenne" value={`${(currentJob.result.stats.totalExtracted / (currentJob.result.stats.durationMs / 1000)).toFixed(2)} lieu/s`} icon={Activity} />
              <StatCard label="Taux de succès" value={`${currentJob.result.stats.totalExtracted > 0 ? ((currentJob.result.stats.uniqueCount / currentJob.result.stats.totalExtracted) * 100).toFixed(1) : 0}%`} icon={CheckCircle2} />
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* État initial : pas de job */}
      {!currentJob && !launching && (
        <Card>
          <CardContent className="p-12 text-center">
            <Radar className="h-12 w-12 mx-auto mb-3 text-primary opacity-50" />
            <p className="font-semibold mb-1">Prêt à scraper</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Configurez vos critères ci-dessus puis cliquez sur « Lancer le scraping ».
              Le moteur ouvrira Google Maps en mode headless, extraira chaque fiche et
              dédupliquera les résultats automatiquement.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] text-muted-foreground">
              <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-2.5 w-2.5 text-primary" /> Playwright + Chromium</Badge>
              <Badge variant="outline" className="gap-1"><Sparkles className="h-2.5 w-2.5 text-primary" /> pgvector ready</Badge>
              <Badge variant="outline" className="gap-1"><Activity className="h-2.5 w-2.5 text-primary" /> Anti-CAPTCHA</Badge>
            </div>
          </CardContent>
        </Card>
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
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" >
      <CardContent className="p-4" onClick={onClick}>
        <div className="flex items-start gap-2 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs shrink-0">
            {place.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-tight line-clamp-2">{place.name}</p>
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
          {place.website && (
            <div className="flex items-center gap-1.5 text-muted-foreground truncate">
              <Globe className="h-3 w-3 shrink-0" />
              <span className="truncate">{place.website.replace(/^https?:\/\//, "")}</span>
            </div>
          )}
          {place.email && (
            <div className="flex items-center gap-1.5 text-muted-foreground truncate">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{place.email}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-2 pt-2 border-t text-[10px]">
          <div className="flex items-center gap-2">
            {place.reviewCount && (
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

function formatEvent(event: { type: string; [key: string]: unknown }): string {
  switch (event.type) {
    case "start":
      return `🚀 Démarrage du scraping`
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
      return `⏹️ Annulé`
    default:
      return event.type
  }
}
