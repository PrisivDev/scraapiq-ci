"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Search, Radar, Sparkles, GitMerge, Brain, ShieldCheck,
  MapPin, Tag, Gauge, Download, Play, Loader2, CheckCircle2,
  XCircle, Clock, Zap, ArrowRight, Activity, RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const iconMap: Record<string, React.ElementType> = {
  search: Search, radar: Radar, sparkles: Sparkles, "git-merge": GitMerge,
  brain: Brain, "shield-check": ShieldCheck, "map-pin": MapPin, tag: Tag,
  gauge: Gauge, download: Download,
}

const agentDefs = [
  { number: 1, id: "sources", name: "Recherche de Sources", role: "Identifie les sources pertinentes", icon: "search", color: "#10b981", critical: true },
  { number: 2, id: "scraping", name: "Scraping", role: "Collecte les données brutes", icon: "radar", color: "#3b82f6", critical: true },
  { number: 3, id: "cleaning", name: "Nettoyage", role: "Normalise et corrige", icon: "sparkles", color: "#8b5cf6", critical: true },
  { number: 4, id: "dedup", name: "Déduplication", role: "Détecte et fusionne les doublons", icon: "git-merge", color: "#f97316", critical: true },
  { number: 5, id: "enrichment", name: "Enrichissement", role: "Complète via IA (LLM z-ai)", icon: "brain", color: "#06b6d4", critical: false, parallel: true },
  { number: 6, id: "validation", name: "Validation", role: "Vérifie qualité et cohérence", icon: "shield-check", color: "#ef4444", critical: false, parallel: true },
  { number: 7, id: "geocoding", name: "Géocodage", role: "Convertit adresses → GPS", icon: "map-pin", color: "#84cc16", critical: false },
  { number: 8, id: "classification", name: "Classification", role: "Détecte le secteur d'activité", icon: "tag", color: "#ec4899", critical: false },
  { number: 9, id: "scoring", name: "Scoring", role: "Calcule le score de qualité", icon: "gauge", color: "#f59e0b", critical: false },
  { number: 10, id: "export", name: "Export", role: "Génère fichiers + notifie", icon: "download", color: "#a16207", critical: false },
]

interface AgentResult {
  agentId: string
  status: string
  durationMs: number
  attempts: number
  result: Record<string, unknown>
  error?: string
}

interface AgentEvent {
  agentId: string
  type: string
  message: string
  timestamp: string
  data?: Record<string, unknown>
}

interface PipelineState {
  jobId: string
  query: string
  status: string
  currentAgent: string | null
  agentResults: Record<string, AgentResult>
  events: AgentEvent[]
  totalDurationMs: number
  sharedData: Record<string, unknown>
}

export function AgentsView() {
  const [query, setQuery] = useState("restaurant")
  const [city, setCity] = useState("Abidjan")
  const [commune, setCommune] = useState("Cocody")
  const [pipeline, setPipeline] = useState<PipelineState | null>(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)

  const launchPipeline = async () => {
    setLoading(true)
    setPipeline(null)
    try {
      const res = await fetch("/api/v1/agents", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ query, city, commune }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      toast.success("Pipeline lancé", { description: `${data.agents} agents spécialisés` })
      setPolling(true)
      pollPipeline(data.jobId)
    } catch { toast.error("Erreur lancement pipeline") }
    finally { setLoading(false) }
  }

  const pollPipeline = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/v1/agents/${jobId}`, { credentials: "include" })
      if (!res.ok) return
      const data: PipelineState = await res.json()
      setPipeline(data)

      if (data.status === "running") {
        setTimeout(() => pollPipeline(jobId), 1000)
      } else {
        setPolling(false)
        if (data.status === "completed") {
          toast.success("Pipeline terminé", { description: `${data.totalDurationMs}ms` })
        } else if (data.status === "failed") {
          toast.error("Pipeline échoué")
        }
      }
    } catch {}
  }, [])

  const completedCount = pipeline ? Object.values(pipeline.agentResults).filter((r) => r.status === "completed").length : 0
  const failedCount = pipeline ? Object.values(pipeline.agentResults).filter((r) => r.status === "failed").length : 0
  const skippedCount = pipeline ? Object.values(pipeline.agentResults).filter((r) => r.status === "skipped").length : 0
  const progress = pipeline ? (completedCount / 10) * 100 : 0

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          Architecture IA Multi-Agents
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          10 agents spécialisés · Pipeline coordonné · Retry · Checkpoint · Reprise sur erreur
        </p>
      </div>

      {/* Form */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Requête</Label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="restaurant" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ville</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Abidjan" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Commune</Label>
              <Input value={commune} onChange={(e) => setCommune(e.target.value)} placeholder="Cocody" className="h-9" />
            </div>
            <div className="flex items-end">
              <Button onClick={launchPipeline} disabled={loading || polling} className="w-full gap-2 h-9">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                Lancer le pipeline
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress bar */}
      {pipeline && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {pipeline.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                {pipeline.status === "completed" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                {pipeline.status === "failed" && <XCircle className="h-4 w-4 text-red-600" />}
                <span className="text-sm font-semibold">
                  Pipeline {pipeline.status === "running" ? "en cours" : pipeline.status === "completed" ? "terminé" : "échoué"}
                </span>
                <Badge variant="outline" className="text-[10px]">{completedCount}/10 terminés</Badge>
                {failedCount > 0 && <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600">{failedCount} échec</Badge>}
                {skippedCount > 0 && <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600">{skippedCount} ignoré</Badge>}
              </div>
              <span className="text-xs text-muted-foreground">{pipeline.totalDurationMs}ms</span>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      {/* Pipeline diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agents list */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Agents ({agentDefs.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {agentDefs.map((agent) => {
                const Icon = iconMap[agent.icon] || Activity
                const result = pipeline?.agentResults[agent.id]
                const isCurrent = pipeline?.currentAgent === agent.id
                return (
                  <div key={agent.id} className={cn(
                    "flex items-center gap-3 p-3 transition-colors",
                    isCurrent && "bg-primary/5 ring-1 ring-primary/20"
                  )}>
                    <div className="flex items-center justify-center shrink-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: agent.color }}>
                        {agent.number}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: agent.color }} />
                        <p className="text-xs font-medium truncate">{agent.name}</p>
                        {agent.parallel && <Badge variant="outline" className="text-[9px] px-1 h-3.5">Parallèle</Badge>}
                        {agent.critical && <Badge variant="outline" className="text-[9px] px-1 h-3.5 bg-red-500/5 text-red-600">Critique</Badge>}
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{agent.role}</p>
                    </div>
                    <div className="shrink-0">
                      {!result && (
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/20" />
                      )}
                      {result?.status === "completed" && (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-[9px] text-muted-foreground tabular-nums">{result.durationMs}ms</span>
                        </div>
                      )}
                      {result?.status === "running" && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      )}
                      {result?.status === "failed" && (
                        <XCircle className="h-3.5 w-3.5 text-red-600" />
                      )}
                      {result?.status === "skipped" && (
                        <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600">Skip</Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Events log + details */}
        <div className="space-y-4">
          {/* Events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Flux d'événements
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[250px] overflow-y-auto rounded-lg bg-slate-950 p-3 font-mono text-[10px] space-y-0.5">
                {(pipeline?.events || []).slice(-20).map((event, i) => (
                  <div key={i} className={cn(
                    event.type === "error" && "text-red-400",
                    event.type === "complete" && "text-emerald-400",
                    event.type === "start" && "text-cyan-400",
                    event.type === "retry" && "text-amber-400",
                    event.type === "skip" && "text-amber-400",
                    !["error", "complete", "start", "retry", "skip"].includes(event.type) && "text-slate-400",
                  )}>
                    [{event.timestamp.slice(11, 19)}] {event.message}
                  </div>
                ))}
                {pipeline?.status === "running" && <div className="text-slate-500 animate-pulse">▋</div>}
                {!pipeline && <div className="text-slate-600">En attente du lancement…</div>}
              </div>
            </CardContent>
          </Card>

          {/* Shared data summary */}
          {pipeline && completedCount > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Données partagées (shared state)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {Object.entries(pipeline.sharedData).slice(0, 8).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground font-mono">{key}</span>
                    <span className="font-medium truncate max-w-[60%]">
                      {Array.isArray(value) ? `${value.length} items` :
                       typeof value === "object" && value ? `${Object.keys(value).length} keys` :
                       String(value).slice(0, 40)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Architecture description */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Architecture & coordination</CardTitle>
          <CardDescription className="text-xs">Pipeline séquentiel + branches parallèles · Blackboard pattern · Checkpoint · Circuit breaker</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <p className="font-semibold mb-1">Flux de données</p>
              <div className="flex items-center gap-1 flex-wrap text-[10px]">
                <Badge variant="outline" style={{ borderColor: "#10b981", color: "#10b981" }}>1. Sources</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" style={{ borderColor: "#3b82f6", color: "#3b82f6" }}>2. Scraping</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" style={{ borderColor: "#8b5cf6", color: "#8b5cf6" }}>3. Nettoyage</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" style={{ borderColor: "#f97316", color: "#f97316" }}>4. Dédup</Badge>
              </div>
              <div className="flex items-center gap-1 flex-wrap text-[10px] mt-1">
                <Badge variant="outline" style={{ borderColor: "#06b6d4", color: "#06b6d4" }}>5. Enrichissement</Badge>
                <span className="text-muted-foreground">+</span>
                <Badge variant="outline" style={{ borderColor: "#ef4444", color: "#ef4444" }}>6. Validation</Badge>
                <span className="text-muted-foreground">(parallèle)</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" style={{ borderColor: "#84cc16", color: "#84cc16" }}>7. Géocodage</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" style={{ borderColor: "#ec4899", color: "#ec4899" }}>8. Classification</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" style={{ borderColor: "#f59e0b", color: "#f59e0b" }}>9. Scoring</Badge>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <Badge variant="outline" style={{ borderColor: "#a16207", color: "#a16207" }}>10. Export</Badge>
              </div>
            </div>
            <div>
              <p className="font-semibold mb-1">Reprise sur erreur</p>
              <ul className="space-y-0.5 text-[10px] text-muted-foreground">
                <li>• <strong>Retry</strong> : 3 tentatives par agent, backoff exponentiel (1s → 4s → 16s)</li>
                <li>• <strong>Checkpoint</strong> : état sauvegardé après chaque agent → reprise possible</li>
                <li>• <strong>Circuit breaker</strong> : agent marqué défaillant après 3 échecs consécutifs</li>
                <li>• <strong>Skip</strong> : agent non critique échoué → pipeline continue</li>
                <li>• <strong>Abort</strong> : agent critique échoué → pipeline arrêté</li>
                <li>• <strong>Timeout</strong> : chaque agent a un timeout (30s à 5min selon l'agent)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
