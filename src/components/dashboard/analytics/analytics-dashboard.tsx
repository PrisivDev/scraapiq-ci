"use client"

import { useState, useEffect } from "react"
import { AnalyticsKpis } from "./kpi-cards"
import { AnalyticsCharts } from "./charts"
import { GeographicHeatmap } from "./geographic-heatmap"
import { ActivityAndAlerts } from "./activity-alerts"
import { ExportsAndLeaderboard, RealtimeStats } from "./exports-leaderboard"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, Sparkles, RefreshCw } from "lucide-react"
import { toast } from "sonner"

interface AnalyticsDashboardProps {
  onNavigate?: (key: string) => void
}

export function AnalyticsDashboard({ onNavigate }: AnalyticsDashboardProps) {
  // Récupère le prénom et l'organisation réels depuis /api/me
  // (mock "Adama" / "AgriBusiness CI" supprimé)
  const [firstName, setFirstName] = useState<string>("")
  const [organizationName, setOrganizationName] = useState<string>("votre organisation")
  useEffect(() => {
    let mounted = true
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!mounted || !d?.user) return
        const name: string | undefined = d.user.name
        if (name) {
          setFirstName(name.split(" ")[0])
        }
        const orgName = d.user.memberships?.[0]?.organization?.name
        if (orgName) setOrganizationName(orgName)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])
  return (
    <div className="space-y-5">
      {/* Hero greeting */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {firstName ? `Bonjour ${firstName}` : "Bonjour"} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Voici l'activité de <span className="font-medium text-foreground">{organizationName}</span> — Abidjan & Côte d'Ivoire
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-emerald-500/5 border-emerald-500/20 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Système opérationnel</span>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Rafraîchissement…")}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </Button>
          <Button size="sm" className="gap-2" onClick={() => onNavigate?.("scraper")}>
            <Sparkles className="h-3.5 w-3.5" />
            Nouveau scraping
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <AnalyticsKpis />

      {/* Graphiques principaux */}
      <AnalyticsCharts />

      {/* Carte de chaleur géographique */}
      <GeographicHeatmap />

      {/* Activité + Alertes */}
      <ActivityAndAlerts />

      {/* Exports + Leaderboard */}
      <ExportsAndLeaderboard />

      {/* Stats temps réel système */}
      <RealtimeStats />

      {/* Export banner */}
      <div className="rounded-xl border bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
          <Download className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Export Enterprise</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Exportez l'ensemble de vos 38 862 entreprises en Excel, CSV, JSON ou via l'API REST.
            Champs normalisés (+225), coordonnées complètes, géolocalisation incluse.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted-foreground">
            <Badge variant="outline" className="gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Excel xlsx
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
              CSV
            </Badge>
            <Badge variant="outline" className="gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              JSON API
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => toast.success("Export CSV démarré")} className="gap-2">
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button onClick={() => toast.success("Export Excel démarré")} className="gap-2">
            <Download className="h-4 w-4" />
            Exporter Excel
          </Button>
        </div>
      </div>
    </div>
  )
}
