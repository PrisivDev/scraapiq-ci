"use client"

import { useState, useEffect } from "react"
import {
  CheckCircle2, AlertTriangle, XCircle, Download, GitMerge, Sparkles,
  Building2, Play, UserPlus, Database, Lock, LogIn, Info, Bell,
  Activity as ActivityIcon, Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { recentActivities, dashboardAlerts, type Activity, type Alert, type ActivityType } from "@/lib/dashboard-data"

const iconMap: Record<string, React.ElementType> = {
  "check-circle": CheckCircle2,
  "alert-triangle": AlertTriangle,
  "x-circle": XCircle,
  "download": Download,
  "git-merge": GitMerge,
  "sparkles": Sparkles,
  "building": Building2,
  "play": Play,
  "user-plus": UserPlus,
  "database": Database,
  "lock": Lock,
  "log-in": LogIn,
  "info": Info,
  "bell": Bell,
}

const colorMap: Record<string, string> = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  orange: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h}h ${min % 60}min`
  const d = Math.floor(h / 24)
  return `il y a ${d}j`
}

const severityConfig = {
  critical: { label: "Critique", className: "bg-red-500/10 text-red-600 border-red-500/30", icon: "x-circle" },
  warning: { label: "Warning", className: "bg-orange-500/10 text-orange-600 border-orange-500/30", icon: "alert-triangle" },
  info: { label: "Info", className: "bg-blue-500/10 text-blue-600 border-blue-500/30", icon: "info" },
}

export function ActivityAndAlerts() {
  const [activityFilter, setActivityFilter] = useState<"all" | "jobs" | "ai" | "system">("all")
  const [liveActivities, setLiveActivities] = useState<Activity[]>(recentActivities)

  // Simule l'ajout d'activités en temps réel
  useEffect(() => {
    const interval = setInterval(() => {
      // Petite variation : ajoute une activité "pulse" toutes les 30s
      // (en production : WebSocket)
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const filteredActivities = liveActivities.filter((a) => {
    if (activityFilter === "all") return true
    if (activityFilter === "jobs") return ["job_started", "job_completed", "job_failed"].includes(a.type)
    if (activityFilter === "ai") return ["ai_dedup", "ai_enrich", "company_merged", "company_enriched"].includes(a.type)
    if (activityFilter === "system") return ["source_synced", "source_degraded", "alert_triggered", "alert_resolved", "user_login", "user_invited"].includes(a.type)
    return true
  })

  const activeAlerts = dashboardAlerts.filter((a) => a.status === "active")
  const criticalCount = activeAlerts.filter((a) => a.severity === "critical").length
  const warningCount = activeAlerts.filter((a) => a.severity === "warning").length

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Fil d'activité temps réel */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ActivityIcon className="h-4 w-4" />
                <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse ring-2 ring-background" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Activité en temps réel
                </CardTitle>
                <CardDescription className="text-xs">
                  {liveActivities.length} événements · live
                </CardDescription>
              </div>
            </div>
            <Tabs value={activityFilter} onValueChange={(v) => setActivityFilter(v as "all" | "jobs" | "ai" | "system")}>
              <TabsList className="h-7">
                <TabsTrigger value="all" className="text-[11px] px-2 h-5">Tous</TabsTrigger>
                <TabsTrigger value="jobs" className="text-[11px] px-2 h-5">Jobs</TabsTrigger>
                <TabsTrigger value="ai" className="text-[11px] px-2 h-5">IA</TabsTrigger>
                <TabsTrigger value="system" className="text-[11px] px-2 h-5">Système</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[420px] overflow-y-auto">
            {filteredActivities.map((activity) => {
              const Icon = iconMap[activity.icon] || ActivityIcon
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 border-b last:border-b-0 hover:bg-muted/40 transition-colors"
                >
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", colorMap[activity.color])}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">{activity.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{activity.description}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {timeAgo(activity.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="outline" className="text-[9px] h-4 px-1">
                        {activity.user}
                      </Badge>
                      {activity.type.startsWith("ai_") && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 bg-violet-500/10 text-violet-600 border-violet-500/20">
                          IA
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Alertes */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
                <Bell className="h-4 w-4" />
                {activeAlerts.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-orange-500 animate-pulse ring-2 ring-background" />
                )}
              </div>
              <div>
                <CardTitle className="text-base">Alertes</CardTitle>
                <CardDescription className="text-xs">
                  {criticalCount} critique · {warningCount} warning
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[420px] overflow-y-auto">
            {dashboardAlerts.map((alert) => {
              const config = severityConfig[alert.severity]
              const Icon = iconMap[alert.icon] || Info
              return (
                <div
                  key={alert.id}
                  className={cn(
                    "flex items-start gap-3 p-3 border-b last:border-b-0 hover:bg-muted/40 transition-colors",
                    alert.status === "resolved" && "opacity-60"
                  )}
                >
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", config.className)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{alert.title}</p>
                      <Badge
                        variant="outline"
                        className={cn("text-[9px] h-4 px-1 shrink-0", config.className)}
                      >
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.description}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[10px] text-muted-foreground">
                        {alert.source} · {timeAgo(alert.triggeredAt)}
                      </span>
                      {alert.status === "resolved" ? (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 bg-emerald-500/10 text-emerald-600">
                          Résolue
                        </Badge>
                      ) : alert.status === "acknowledged" ? (
                        <Badge variant="outline" className="text-[9px] h-4 px-1">
                          Acquittée
                        </Badge>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-5 text-[10px] px-2">
                          Acquitter
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
