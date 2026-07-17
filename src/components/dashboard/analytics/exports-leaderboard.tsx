"use client"

import {
  Download, FileSpreadsheet, FileText, FileJson, File as FilePdf,
  CheckCircle2, Loader2, XCircle, Clock, User,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { exportHistory, topCompanies, realtimeStats, type ExportRecord } from "@/lib/dashboard-data"
import { toast } from "sonner"

const formatIcons = {
  xlsx: { icon: FileSpreadsheet, className: "bg-emerald-500/10 text-emerald-600" },
  csv: { icon: FileText, className: "bg-orange-500/10 text-orange-600" },
  json: { icon: FileJson, className: "bg-blue-500/10 text-blue-600" },
  pdf: { icon: FilePdf, className: "bg-red-500/10 text-red-600" },
}

const statusMeta = {
  completed: { label: "Prêt", icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  processing: { label: "Génération", icon: Loader2, className: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  failed: { label: "Échec", icon: XCircle, className: "bg-red-500/10 text-red-600 border-red-500/20" },
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h}h`
  const d = Math.floor(h / 24)
  return `il y a ${d}j`
}

export function ExportsAndLeaderboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Historique exports */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Download className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Exports récents</CardTitle>
                <CardDescription className="text-xs">
                  {exportHistory.length} exports · {exportHistory.filter((e) => e.status === "completed").length} disponibles
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-8" onClick={() => toast.info("Nouvel export")}>
              + Nouvel export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {exportHistory.map((exp) => (
              <ExportRow key={exp.id} exp={exp} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top entreprises */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
              🏆
            </div>
            <div>
              <CardTitle className="text-base">Top entreprises</CardTitle>
              <CardDescription className="text-xs">Par score qualité</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {topCompanies.map((c) => (
              <div key={c.rank} className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors">
                <div className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                  c.rank === 1 && "bg-amber-500/20 text-amber-600",
                  c.rank === 2 && "bg-slate-400/20 text-slate-600",
                  c.rank === 3 && "bg-orange-700/20 text-orange-700",
                  c.rank > 3 && "bg-muted text-muted-foreground"
                )}>
                  {c.rank}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">{c.sector} · {c.jobs} jobs</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold tabular-nums">{c.score}</p>
                  <p className="text-[10px] text-emerald-600">+{c.growth}%</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ExportRow({ exp }: { exp: ExportRecord }) {
  const formatMeta = formatIcons[exp.format]
  const statusMetaObj = statusMeta[exp.status]
  const FormatIcon = formatMeta.icon
  const StatusIcon = statusMetaObj.icon

  return (
    <div className="flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors">
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", formatMeta.className)}>
        <FormatIcon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{exp.filename}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
          <span>{exp.rows.toLocaleString("fr-FR")} lignes</span>
          <span>·</span>
          <span>{exp.size}</span>
          <span>·</span>
          <span className="flex items-center gap-0.5"><User className="h-2.5 w-2.5" />{exp.createdBy}</span>
          <span>·</span>
          <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{timeAgo(exp.createdAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className={cn("text-[9px] gap-1", statusMetaObj.className)}>
          <StatusIcon className={cn("h-2.5 w-2.5", exp.status === "processing" && "animate-spin")} />
          {statusMetaObj.label}
        </Badge>
        {exp.status === "completed" && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1"
            onClick={() => toast.success(`Téléchargement de ${exp.filename}`)}
          >
            <Download className="h-3 w-3" />
          </Button>
        )}
        {exp.status === "failed" && (
          <Button variant="outline" size="sm" className="h-7" onClick={() => toast.info("Relance programmée")}>
            Régénérer
          </Button>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// STATS TEMPS RÉEL (système)
// ============================================================================

export function RealtimeStats() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Activity className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse ring-2 ring-background" />
            </div>
            <div>
              <CardTitle className="text-base">Système — Temps réel</CardTitle>
              <CardDescription className="text-xs">Monitoring infrastructure</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1" />
            Operational
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatItem label="Utilisateurs actifs" value={realtimeStats.activeUsers} icon="users" />
        <StatItem label="Req/min" value={realtimeStats.requestsPerMinute} icon="zap" />
        <StatItem label="Latence moy." value={`${realtimeStats.avgResponseTime}ms`} icon="clock" />
        <StatItem label="Uptime" value={`${realtimeStats.uptime}%`} icon="check" />

        <div className="col-span-2 md:col-span-4 space-y-3">
          <ResourceBar label="CPU" value={realtimeStats.cpuUsage} color="emerald" />
          <ResourceBar label="Mémoire" value={realtimeStats.memoryUsage} color="orange" />
          <ResourceBar label="Disque" value={realtimeStats.diskUsage} color="blue" />
        </div>

        <div className="col-span-2 md:col-span-4 text-[11px] text-muted-foreground flex items-center gap-2">
          <Clock className="h-3 w-3" />
          Dernier incident : {realtimeStats.lastIncident}
        </div>
      </CardContent>
    </Card>
  )
}

import { Activity } from "lucide-react"

function StatItem({ label, value, icon }: { label: string; value: string | number; icon: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

function ResourceBar({ label, value, color }: { label: string; value: number; color: string }) {
  const colorClass = color === "emerald" ? "bg-emerald-500" : color === "orange" ? "bg-orange-500" : "bg-blue-500"
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", colorClass)} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}
