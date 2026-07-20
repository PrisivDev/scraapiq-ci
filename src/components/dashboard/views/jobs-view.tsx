"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import {
  Activity,
  Clock,
  CheckCircle2,
  Loader2,
  Pause,
  XCircle,
  MapPin,
  Phone,
  Mail,
  Globe,
  Star,
  Download,
  RefreshCw,
  Search,
  Building2,
  AlertCircle,
  Eye,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { fr } from "date-fns/locale"

// Types alignés sur /api/scraper/jobs
interface JobListItem {
  id: string
  query: {
    keyword: string
    city?: string
    commune?: string
    maxResults?: number
  }
  status: "queued" | "running" | "completed" | "failed" | "cancelled"
  progress: number
  resultsCount: number
  createdAt: string
}

interface JobDetail extends JobListItem {
  progress: {
    jobId: string
    status: JobListItem["status"]
    phase: string
    progress: number
    resultsCount: number
    processedCount: number
    duplicatesDetected: number
    errors: string[]
    startedAt: string
    completedAt?: string
    currentPlace?: string
  }
  result?: {
    places: Array<{
      name?: string
      category?: string
      address?: string
      phone?: string
      email?: string
      website?: string
      rating?: number
      reviewCount?: number
      isOpenNow?: boolean
    }>
    duplicatesRemoved: number
    duration: number
  }
  events: Array<{
    type: string
    progress?: number
    phase?: string
    message?: string
    place?: { name?: string }
    resultsCount?: number
    timestamp?: string
  }>
}

const statusMeta: Record<string, { label: string; icon: React.ElementType; className: string; color: string }> = {
  running: { label: "En cours", icon: Loader2, className: "bg-primary/10 text-primary border-primary/20", color: "text-primary" },
  completed: { label: "Terminé", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", color: "text-emerald-600" },
  queued: { label: "En file", icon: Pause, className: "bg-muted text-muted-foreground border-border", color: "text-muted-foreground" },
  failed: { label: "Échec", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20", color: "text-destructive" },
  cancelled: { label: "Annulé", icon: XCircle, className: "bg-muted text-muted-foreground border-border", color: "text-muted-foreground" },
}

// Fallback pour les statuts inconnus (null, vide, etc.)
const defaultStatusMeta = { label: "Inconnu", icon: XCircle, className: "bg-muted text-muted-foreground border-border", color: "text-muted-foreground" }

function getStatusMeta(status: string | undefined | null) {
  if (!status) return defaultStatusMeta
  return statusMeta[status] || defaultStatusMeta
}

const phaseLabels: Record<string, string> = {
  init: "Initialisation",
  search: "Recherche",
  scrolling: "Scroll des résultats",
  extracting: "Extraction des détails",
  dedup: "Déduplication",
  complete: "Terminé",
  done: "Terminé",
}

export function JobsView() {
  const [jobs, setJobs] = useState<JobListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | JobListItem["status"]>("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<JobDetail | null>(null)
  const [search, setSearch] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/scraper/jobs", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      setJobs(data.jobs || [])
      if (data.jobs?.length > 0 && !selectedId) setSelectedId(data.jobs[0].id)
    } catch {
      // silent
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedId])

  const fetchDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/scraper/jobs/${id}`, { credentials: "include" })
      if (!res.ok) return
      setDetail(await res.json())
    } catch {
      // silent
    }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    fetchDetail(selectedId)
    const current = jobs.find((j) => j.id === selectedId)
    const isRunning = current?.status === "running" || current?.status === "queued"
    if (isRunning) {
      const poll = () => {
        fetchDetail(selectedId)
        fetchJobs()
        pollRef.current = setTimeout(poll, 2000)
      }
      pollRef.current = setTimeout(poll, 2000)
    }
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [selectedId, fetchDetail, fetchJobs, jobs])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchJobs()
    if (selectedId) fetchDetail(selectedId)
  }

  const handleCancel = async (id: string) => {
    try {
      const res = await fetch(`/api/scraper/jobs/${id}`, { method: "DELETE", credentials: "include" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success("Job annulé")
      fetchJobs()
      if (selectedId === id) fetchDetail(id)
    } catch (e) {
      toast.error("Erreur", { description: e instanceof Error ? e.message : "Échec" })
    }
  }

  const handleExport = async (id: string) => {
    try {
      const res = await fetch(`/api/scraper/jobs/${id}?format=csv`, { credentials: "include" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `scrapiq_${id}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Export CSV téléchargé")
    } catch (e) {
      toast.error("Export impossible", { description: e instanceof Error ? e.message : "Échec" })
    }
  }

  const filtered = jobs.filter((j) => {
    if (filter !== "all" && j.status !== filter) return false
    if (search) {
      const q = `${j.query.keyword} ${j.query.city || ""} ${j.query.commune || ""} ${j.id}`
      if (!q.toLowerCase().includes(search.toLowerCase())) return false
    }
    return true
  })

  const counts = {
    all: jobs.length,
    running: jobs.filter((j) => j.status === "running").length,
    queued: jobs.filter((j) => j.status === "queued").length,
    completed: jobs.filter((j) => j.status === "completed").length,
    failed: jobs.filter((j) => j.status === "failed").length,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Jobs de scraping
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {counts.running > 0 && (
              <>
                <span className="inline-flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  {counts.running} en cours
                </span>
                {" · "}
              </>
            )}
            {counts.queued > 0 && `${counts.queued} en file · `}
            {counts.completed} terminé(s) · {counts.failed} échec(s)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par mot-clé, ville, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | JobListItem["status"])}>
          <TabsList className="overflow-x-auto">
            <TabsTrigger value="all">Tous ({counts.all})</TabsTrigger>
            <TabsTrigger value="running">En cours ({counts.running})</TabsTrigger>
            <TabsTrigger value="queued">En file ({counts.queued})</TabsTrigger>
            <TabsTrigger value="completed">Terminés ({counts.completed})</TabsTrigger>
            <TabsTrigger value="failed">Échecs ({counts.failed})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Liste */}
        <div className={cn("space-y-2", selectedId && "lg:col-span-1")}>
          {loading ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-2">Chargement...</p>
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">Aucun job</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {jobs.length === 0
                    ? "Lancez un scraping depuis le Moteur Google Maps."
                    : "Aucun job ne correspond à vos critères."}
                </p>
              </CardContent>
            </Card>
          ) : (
            filtered.map((job) => {
              const meta = getStatusMeta(job.status)
              const Icon = meta.icon
              return (
                <Card
                  key={job.id}
                  className={cn("cursor-pointer transition-all hover:shadow-sm", selectedId === job.id && "ring-2 ring-primary")}
                  onClick={() => setSelectedId(job.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg border shrink-0", meta.className)}>
                        <Icon className={cn("h-4 w-4", job.status === "running" && "animate-spin")} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{job.query.keyword}</p>
                          <Badge variant="outline" className={cn("text-[10px] shrink-0", meta.className)}>
                            {meta.label}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{job.id}</p>
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          {job.query.commune && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-2.5 w-2.5" />
                              {job.query.commune}
                            </span>
                          )}
                          <span className="flex items-center gap-0.5">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            {job.resultsCount} résultats
                          </span>
                        </div>
                        {job.status === "running" && <Progress value={job.progress} className="h-1 mt-2" />}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {/* Détail */}
        {selectedId && detail ? (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle className="text-base flex items-center gap-2">
                    {(() => {
                      const meta = getStatusMeta(detail.progress.status)
                      const Icon = meta.icon
                      return <Icon className={cn("h-4 w-4", meta.color, detail.progress.status === "running" && "animate-spin")} />
                    })()}
                    <span className="truncate">{detail.query.keyword}</span>
                  </CardTitle>
                  <CardDescription className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-[11px]">{detail.id}</span>
                    {detail.query.commune && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        <MapPin className="h-2.5 w-2.5 mr-1" />
                        {detail.query.commune}
                      </Badge>
                    )}
                    {detail.query.city && <Badge variant="outline" className="text-[10px] h-5">{detail.query.city}</Badge>}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(detail.progress.status === "running" || detail.progress.status === "queued") && (
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => handleCancel(detail.id)}>
                      <Pause className="h-3.5 w-3.5" /> Annuler
                    </Button>
                  )}
                  {detail.result && detail.result.places.length > 0 && (
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => handleExport(detail.id)}>
                      <Download className="h-3.5 w-3.5" /> CSV
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <StatBox label="Statut" value={getStatusMeta(detail.progress.status).label} />
                <StatBox label="Progression" value={`${detail.progress.progress}%`} />
                <StatBox label="Résultats" value={String(detail.progress.resultsCount)} />
                <StatBox label="Traités" value={String(detail.progress.processedCount)} />
                <StatBox label="Doublons" value={String(detail.progress.duplicatesDetected)} />
              </div>

              {/* Progress */}
              {(detail.progress.status === "running" || detail.progress.status === "completed") && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold">{phaseLabels[detail.progress.phase] || detail.progress.phase}</p>
                    <span className="text-xs text-muted-foreground">{detail.progress.progress}%</span>
                  </div>
                  <Progress value={detail.progress.progress} className="h-2" />
                  {detail.progress.currentPlace && detail.progress.status === "running" && (
                    <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Extraction : <span className="font-medium">{detail.progress.currentPlace}</span>
                    </p>
                  )}
                </div>
              )}

              {/* Erreurs */}
              {detail.progress.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm font-semibold text-destructive mb-1 flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4" />
                    {detail.progress.errors.length} erreur(s)
                  </p>
                  <ul className="space-y-0.5">
                    {detail.progress.errors.slice(-5).map((err, i) => (
                      <li key={i} className="text-xs text-muted-foreground font-mono">• {err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Events */}
              {detail.events.length > 0 && (
                <div>
                  <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    Événements ({detail.events.length})
                    {detail.progress.status === "running" && (
                      <span className="ml-1 inline-flex items-center gap-1 text-[10px] text-primary">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                        </span>
                        live
                      </span>
                    )}
                  </p>
                  <div className="rounded-lg bg-slate-950 text-slate-100 p-3 font-mono text-[11px] space-y-0.5 max-h-64 overflow-y-auto">
                    {detail.events.slice(-50).map((ev, i) => {
                      const time = ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString("fr-FR") : ""
                      const msg = ev.message || ev.phase || ev.place?.name || ev.type
                      let color = "text-slate-400"
                      if (ev.type === "start" || ev.type === "complete") color = "text-emerald-400"
                      else if (ev.type === "error" || ev.type === "block-detected") color = "text-red-400"
                      else if (ev.type === "place-extracted") color = "text-cyan-400"
                      else if (ev.type === "duplicate-detected") color = "text-amber-400"
                      return (
                        <div key={i} className={cn("flex gap-2", color)}>
                          <span className="text-slate-600 shrink-0">[{time}]</span>
                          <span className="truncate">
                            {ev.type}: {String(msg)}
                            {ev.progress != null && ` (${ev.progress}%)`}
                          </span>
                        </div>
                      )
                    })}
                    {detail.progress.status === "running" && <div className="text-emerald-400 animate-pulse">▋</div>}
                  </div>
                </div>
              )}

              {/* Résultats */}
              {detail.result && detail.result.places.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      Lieux extraits ({detail.result.places.length})
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Durée : {(detail.result.duration / 1000).toFixed(1)}s · {detail.result.duplicatesRemoved} doublon(s)
                    </p>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {detail.result.places.map((place, i) => (
                      <div key={i} className="rounded-lg border bg-card p-3 hover:shadow-sm transition-shadow">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{place.name || "Sans nom"}</p>
                            {place.category && <p className="text-[11px] text-muted-foreground truncate">{place.category}</p>}
                          </div>
                          {place.rating != null && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              <span className="text-xs font-medium">{place.rating.toFixed(1)}</span>
                            </div>
                          )}
                        </div>
                        {place.address && (
                          <p className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1">
                            <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                            <span className="truncate">{place.address}</span>
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px]">
                          {place.phone && (
                            <span className="flex items-center gap-1 text-primary">
                              <Phone className="h-3 w-3" />
                              {place.phone}
                            </span>
                          )}
                          {place.email && (
                            <span className="flex items-center gap-1 text-primary truncate max-w-[180px]">
                              <Mail className="h-3 w-3 shrink-0" />
                              {place.email}
                            </span>
                          )}
                          {place.website && (
                            <a href={place.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline truncate max-w-[180px]">
                              <Globe className="h-3 w-3 shrink-0" />
                              Site web
                            </a>
                          )}
                          {place.isOpenNow != null && (
                            <Badge variant="outline" className={cn("text-[9px] h-4", place.isOpenNow ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}>
                              {place.isOpenNow ? "Ouvert" : "Fermé"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : detail.progress.status === "completed" ? (
                <div className="rounded-lg border bg-muted/30 p-4 text-center">
                  <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-sm font-medium">Job terminé sans résultat</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Aucun lieu trouvé. Élargissez vos critères.</p>
                </div>
              ) : null}

              <div className="text-[11px] text-muted-foreground pt-2 border-t">
                Lancé {formatDistanceToNow(new Date(detail.createdAt), { addSuffix: true, locale: fr })}
                {detail.progress.completedAt && (
                  <> · Terminé {formatDistanceToNow(new Date(detail.progress.completedAt), { addSuffix: true, locale: fr })}</>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="lg:col-span-2 hidden lg:flex items-center justify-center">
            <CardContent className="p-12 text-center text-muted-foreground">
              {selectedId ? (
                <>
                  <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" />
                  <p className="text-sm">Chargement du détail...</p>
                </>
              ) : (
                <>
                  <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Sélectionnez un job pour voir les détails</p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold mt-0.5">{value}</p>
    </div>
  )
}
