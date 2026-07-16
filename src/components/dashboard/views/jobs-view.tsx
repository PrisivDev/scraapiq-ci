"use client"

import { Activity, Clock, User, CheckCircle2, Loader2, Pause, XCircle, Play, RotateCw, Trash2, Eye } from "lucide-react"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { scrapingJobs, type JobStatus, type ScrapingJob } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const statusMeta: Record<JobStatus, { label: string; icon: React.ElementType; className: string }> = {
  running: { label: "En cours", icon: Loader2, className: "bg-primary/10 text-primary border-primary/20" },
  completed: { label: "Terminé", icon: CheckCircle2, className: "bg-accent/20 text-accent-foreground border-accent/30" },
  queued: { label: "En file", icon: Pause, className: "bg-muted text-muted-foreground border-border" },
  failed: { label: "Échec", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
}

export function JobsView() {
  const [filter, setFilter] = useState<"all" | JobStatus>("all")
  const [selected, setSelected] = useState<ScrapingJob | null>(null)

  const filtered = filter === "all" ? scrapingJobs : scrapingJobs.filter((j) => j.status === filter)

  const counts = {
    all: scrapingJobs.length,
    running: scrapingJobs.filter((j) => j.status === "running").length,
    queued: scrapingJobs.filter((j) => j.status === "queued").length,
    completed: scrapingJobs.filter((j) => j.status === "completed").length,
    failed: scrapingJobs.filter((j) => j.status === "failed").length,
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
            ● {counts.running} en cours · {counts.queued} en file · {counts.completed} terminés · {counts.failed} échecs
          </p>
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | JobStatus)}>
        <TabsList>
          <TabsTrigger value="all">Tous ({counts.all})</TabsTrigger>
          <TabsTrigger value="running">En cours ({counts.running})</TabsTrigger>
          <TabsTrigger value="queued">En file ({counts.queued})</TabsTrigger>
          <TabsTrigger value="completed">Terminés ({counts.completed})</TabsTrigger>
          <TabsTrigger value="failed">Échecs ({counts.failed})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Liste jobs */}
        <div className={cn("space-y-2", selected && "lg:col-span-1")}>
          {filtered.map((job) => {
            const meta = statusMeta[job.status]
            const StatusIcon = meta.icon
            const isSelected = selected?.id === job.id
            return (
              <Card
                key={job.id}
                className={cn("cursor-pointer transition-all hover:shadow-sm", isSelected && "ring-2 ring-primary")}
              >
                <CardContent className="p-3" onClick={() => setSelected(job)}>
                  <div className="flex items-start gap-3">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg border shrink-0", meta.className)}>
                      <StatusIcon className={cn("h-4 w-4", job.status === "running" && "animate-spin")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{job.keyword}</p>
                        <Badge variant="outline" className={cn("text-[10px] shrink-0", meta.className)}>
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono">{job.id}</p>
                      {job.status === "running" && (
                        <Progress value={job.progress} className="h-1 mt-2" />
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {job.results} résultats
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {job.duration}
                        </span>
                        <span className="ml-auto">{job.createdAt}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Détail job */}
        {selected ? (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground">{selected.id}</span>
                  </CardTitle>
                  <CardDescription className="mt-1">{selected.keyword}</CardDescription>
                </div>
                <div className="flex items-center gap-1">
                  {selected.status === "running" && (
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => toast.info("Job mis en pause")}>
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </Button>
                  )}
                  {selected.status === "failed" && (
                    <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => toast.success("Relance programmée")}>
                      <RotateCw className="h-3.5 w-3.5" /> Relancer
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info("Job supprimé")}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Statut</p>
                  <Badge variant="outline" className={cn("mt-1 text-[10px]", statusMeta[selected.status].className)}>
                    {statusMeta[selected.status].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Progression</p>
                  <p className="font-semibold mt-1">{selected.progress}%</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Résultats</p>
                  <p className="font-semibold mt-1">{selected.results}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Durée</p>
                  <p className="font-semibold mt-1">{selected.duration}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold mb-2">Sources interrogées</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.sources.map((s) => (
                    <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                  ))}
                </div>
              </div>

              {selected.status === "running" && (
                <div>
                  <p className="text-xs font-semibold mb-2">Log streaming (temps réel)</p>
                  <div className="rounded-lg bg-slate-950 text-slate-100 p-3 font-mono text-[11px] space-y-0.5 max-h-48 overflow-y-auto">
                    <div className="text-emerald-400">[{new Date().toLocaleTimeString("fr-FR")}] Worker-3 démarré</div>
                    <div className="text-slate-400">[{new Date().toLocaleTimeString("fr-FR")}] GET maps.google.com/{selected.keyword.replace(/\s/g, "+")}</div>
                    <div className="text-slate-400">[{new Date().toLocaleTimeString("fr-FR")}] {selected.results} résultats extraits</div>
                    <div className="text-cyan-400">[{new Date().toLocaleTimeString("fr-FR")}] [Fusion] Normalisation téléphonique +225...</div>
                    <div className="text-amber-400">[{new Date().toLocaleTimeString("fr-FR")}] [Dedup-IA] 3 doublons potentiels détectés</div>
                    <div className="text-emerald-400">[{new Date().toLocaleTimeString("fr-FR")}] [Enrichment] Web search complétée</div>
                    <div className="text-slate-500 animate-pulse">▋</div>
                  </div>
                </div>
              )}

              {selected.status === "failed" && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <p className="text-sm font-semibold text-destructive mb-1">Échec du job</p>
                  <p className="text-xs text-muted-foreground">
                    Erreur : Timeout lors de la connexion à la source. Vérifiez le statut de la source et relancez le job.
                  </p>
                </div>
              )}

              {selected.status === "completed" && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">
                    <User className="h-3 w-3 inline mr-1" />
                    Lancé par {selected.user} · {selected.createdAt}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="lg:col-span-2 hidden lg:flex items-center justify-center">
            <CardContent className="p-12 text-center text-muted-foreground">
              <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sélectionnez un job pour voir les détails</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
