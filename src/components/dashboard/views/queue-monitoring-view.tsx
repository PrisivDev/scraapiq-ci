"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Activity, Zap, CheckCircle2, XCircle, Loader2, Clock, Server,
  Cpu, Layers, TrendingUp, AlertTriangle, Play, RefreshCw, Plus,
  ArrowUp, ArrowDown, Gauge,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface QueueMetric {
  queueName: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: boolean
  totalProcessed: number
  avgDurationMs: number
  throughput: number
  config?: {
    label: string
    concurrency: number
    maxRetries: number
    backoffType: string
    backoffDelay: number
    maxJobDuration: number
    defaultPriority: number
    description: string
    color: string
  }
}

interface WorkerStat {
  id: string
  queueName: string
  status: "idle" | "busy" | "error"
  currentJobId?: string
  jobsProcessed: number
  lastJobAt?: string
  uptime: number
}

interface TotalMetrics {
  totalWaiting: number
  totalActive: number
  totalCompleted: number
  totalFailed: number
  totalProcessed: number
  totalThroughput: number
  queues: number
  workers: number
  redisAvailable: boolean
}

export function QueueMonitoringView() {
  const [metrics, setMetrics] = useState<QueueMetric[]>([])
  const [workers, setWorkers] = useState<WorkerStat[]>([])
  const [total, setTotal] = useState<TotalMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/queue", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      setMetrics(data.queues || [])
      setTotal(data.total || null)
    } catch {
      // ignore
    }
  }, [])

  const fetchWorkers = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/queue?view=workers", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      setWorkers(data.workers || [])
    } catch {
      // ignore
    }
  }, [])

  // Polling
  useEffect(() => {
    fetchMetrics()
    fetchWorkers()
    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchMetrics()
        fetchWorkers()
      }, 2000)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, fetchMetrics, fetchWorkers])

  // Test jobs
  const sendTestJobs = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/v1/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "test" }),
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      toast.success("Jobs de test envoyés", {
        description: `${data.jobs.length} jobs sur ${data.jobs.length} queues`,
      })
      setTimeout(() => fetchMetrics(), 500)
    } catch {
      toast.error("Erreur lors de l'envoi des jobs de test")
    } finally {
      setLoading(false)
    }
  }

  // Add custom job
  const addJob = async (queue: string) => {
    try {
      const res = await fetch("/api/v1/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          queue,
          name: `manual-job-${Date.now()}`,
          data: { test: true },
        }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success(`Job ajouté à la queue "${queue}"`)
      setTimeout(() => fetchMetrics(), 500)
    } catch {
      toast.error("Erreur")
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" />
            Architecture distribuée
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Redis · BullMQ · Workers · Queues · Retry · Priorités · Parallélisme · Auto-scaling
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", autoRefresh && "animate-spin")} />
            Auto-refresh
          </Button>
          <Button onClick={sendTestJobs} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Tester les queues
          </Button>
        </div>
      </div>

      {/* Redis status */}
      <Card className={cn(
        "border-l-4",
        total?.redisAvailable ? "border-l-emerald-500" : "border-l-amber-500"
      )}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            total?.redisAvailable ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
          )}>
            {total?.redisAvailable ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {total?.redisAvailable ? "Redis connecté" : "Redis indisponible — Fallback mémoire actif"}
            </p>
            <p className="text-xs text-muted-foreground">
              {total?.redisAvailable
                ? "BullMQ opérationnel avec Redis (production mode)"
                : "Le système fonctionne en mémoire (dev mode). En production, connectez Redis pour la persistance."}
            </p>
          </div>
          <Badge variant="outline" className={total?.redisAvailable ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}>
            {total?.redisAvailable ? "BullMQ + Redis" : "Memory Fallback"}
          </Badge>
        </CardContent>
      </Card>

      {/* Global metrics */}
      {total && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <MetricCard label="Waiting" value={total.totalWaiting} icon={Clock} color="amber" />
          <MetricCard label="Active" value={total.totalActive} icon={Loader2} color="blue" spin />
          <MetricCard label="Completed" value={total.totalCompleted} icon={CheckCircle2} color="emerald" />
          <MetricCard label="Failed" value={total.totalFailed} icon={XCircle} color="red" />
          <MetricCard label="Throughput" value={`${total.totalThroughput}/min`} icon={TrendingUp} color="emerald" />
          <MetricCard label="Queues" value={total.queues} icon={Layers} color="violet" />
          <MetricCard label="Workers" value={total.workers} icon={Cpu} color="slate" />
        </div>
      )}

      {/* Queues detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {metrics.map((m) => (
          <QueueCard key={m.queueName} metric={m} onAddJob={() => addJob(m.queueName)} />
        ))}
      </div>

      {/* Workers */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            Workers ({workers.length})
          </CardTitle>
          <CardDescription className="text-xs">
            {workers.filter((w) => w.status === "busy").length} busy · {" "}
            {workers.filter((w) => w.status === "idle").length} idle · {" "}
            {workers.filter((w) => w.status === "error").length} error
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {workers.map((w) => {
              const config = metrics.find((m) => m.queueName === w.queueName)?.config
              return (
                <div key={w.id} className="flex items-center gap-3 p-2.5">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      w.status === "busy" && "bg-blue-500/10 text-blue-600",
                      w.status === "idle" && "bg-emerald-500/10 text-emerald-600",
                      w.status === "error" && "bg-red-500/10 text-red-600"
                    )}
                  >
                    {w.status === "busy" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : w.status === "idle" ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium font-mono">{w.id}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: config?.color || "#64748b" }}
                      />
                      <span>{config?.label || w.queueName}</span>
                      <span>·</span>
                      <span>{w.jobsProcessed} jobs traités</span>
                      <span>·</span>
                      <span>uptime: {Math.round(w.uptime / 1000)}s</span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] shrink-0",
                      w.status === "busy" && "bg-blue-500/10 text-blue-600",
                      w.status === "idle" && "bg-emerald-500/10 text-emerald-600",
                      w.status === "error" && "bg-red-500/10 text-red-600"
                    )}
                  >
                    {w.status === "busy" ? "BUSY" : w.status === "idle" ? "IDLE" : "ERROR"}
                  </Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Architecture diagram */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            Architecture distribuée
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-3 text-xs">
            <div className="flex items-center gap-4">
              <ArchNode label="API Producer" icon="zap" color="emerald" />
              <ArchArrow />
              <ArchNode label="Redis Queue" icon="layers" color="violet" />
              <ArchArrow />
              <ArchNode label="Workers" icon="cpu" color="blue" />
            </div>
            <div className="text-[10px] text-muted-foreground text-center max-w-md">
              L'API produit des jobs → Redis (ou mémoire) les distribue → Les workers les traitent en parallèle avec retry, backoff et priorités.
              Le monitoring surveille tout en temps réel et l'auto-scaling ajuste le nombre de workers.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ label, value, icon: Icon, color, spin }: {
  label: string
  value: number | string
  icon: React.ElementType
  color: string
  spin?: boolean
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    amber: "bg-amber-500/10 text-amber-600",
    blue: "bg-blue-500/10 text-blue-600",
    red: "bg-red-500/10 text-red-600",
    violet: "bg-violet-500/10 text-violet-600",
    slate: "bg-slate-500/10 text-slate-600",
  }
  return (
    <Card>
      <CardContent className="p-3">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg mb-2", colorMap[color])}>
          <Icon className={cn("h-4 w-4", spin && "animate-spin")} />
        </div>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      </CardContent>
    </Card>
  )
}

function QueueCard({ metric, onAddJob }: { metric: QueueMetric; onAddJob: () => void }) {
  const config = metric.config
  const color = config?.color || "#64748b"
  const total = metric.waiting + metric.active + metric.completed + metric.failed
  const successRate = total > 0 ? Math.round((metric.completed / total) * 100) : 100

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${color}20`, color }}
            >
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm">{config?.label || metric.queueName}</CardTitle>
              <p className="text-[10px] text-muted-foreground">{config?.description}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onAddJob}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-md bg-amber-500/5 p-1.5 text-center">
            <p className="text-sm font-bold text-amber-600 tabular-nums">{metric.waiting}</p>
            <p className="text-[9px] text-muted-foreground uppercase">Waiting</p>
          </div>
          <div className="rounded-md bg-blue-500/5 p-1.5 text-center">
            <p className="text-sm font-bold text-blue-600 tabular-nums">{metric.active}</p>
            <p className="text-[9px] text-muted-foreground uppercase">Active</p>
          </div>
          <div className="rounded-md bg-emerald-500/5 p-1.5 text-center">
            <p className="text-sm font-bold text-emerald-600 tabular-nums">{metric.completed}</p>
            <p className="text-[9px] text-muted-foreground uppercase">Done</p>
          </div>
          <div className="rounded-md bg-red-500/5 p-1.5 text-center">
            <p className="text-sm font-bold text-red-600 tabular-nums">{metric.failed}</p>
            <p className="text-[9px] text-muted-foreground uppercase">Failed</p>
          </div>
        </div>

        {/* Throughput + duration */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {metric.throughput} jobs/min
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {metric.avgDurationMs}ms moy
          </span>
          <span className="flex items-center gap-1">
            <Gauge className="h-3 w-3" />
            {successRate}% succès
          </span>
        </div>

        {/* Config badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-[9px] gap-1">
            <Cpu className="h-2.5 w-2.5" />
            {config?.concurrency} workers
          </Badge>
          <Badge variant="outline" className="text-[9px] gap-1">
            <RefreshCw className="h-2.5 w-2.5" />
            {config?.maxRetries} retry
          </Badge>
          <Badge variant="outline" className="text-[9px] gap-1">
            <ArrowUp className="h-2.5 w-2.5" />
            Priorité {config?.defaultPriority}
          </Badge>
          <Badge variant="outline" className="text-[9px] gap-1">
            {config?.backoffType === "exponential" ? <TrendingUp className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
            {config?.backoffType} {config?.backoffDelay}ms
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function ArchNode({ label, icon, color }: { label: string; icon: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    violet: "bg-violet-500/10 text-violet-600 border-violet-500/30",
    blue: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  }
  return (
    <div className={cn("flex flex-col items-center gap-1 rounded-lg border p-3 min-w-[100px]", colorMap[color])}>
      <span className="text-lg">
        {icon === "zap" ? "⚡" : icon === "layers" ? "📚" : icon === "cpu" ? "🔧" : "📦"}
      </span>
      <span className="text-xs font-medium">{label}</span>
    </div>
  )
}

function ArchArrow() {
  return <ArrowRight className="h-4 w-4 text-muted-foreground" />
}

import { ArrowRight } from "lucide-react"
