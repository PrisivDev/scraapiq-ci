"use client"

import { useState, useEffect } from "react"
import { Building2, Activity, Database, GitMerge, Sparkles, Zap, TrendingUp, TrendingDown, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { KpiData } from "@/lib/dashboard-data"

// ============================================================================
// Types — mirror the /api/v1/bi response `kpis` field
// ============================================================================

interface BiKpisResponse {
  totalCompanies: number
  activeJobs: number
  sourcesConnected: number
  dedupRate: number
  enrichmentRate: number
  apiCallsThisMonth: number
  distinctSectors: number
  distinctCommunes: number
  verifiedCount: number
  avgRating: number
  qualityScore: number
}

interface BiResponse {
  success: boolean
  data?: {
    kpis: BiKpisResponse
    growthRate: number
    companiesAddedThisMonth: number
    totalCompanies: number
    growthData: Array<{ month: string; new: number; total: number; growth: number }>
  }
}

// ============================================================================
// KPI definitions (static config — values are dynamic)
// ============================================================================

interface KpiConfig {
  id: string
  label: string
  icon: React.ElementType
  color: "emerald" | "orange"
  hint: string
  // Compute value + delta from the real BI payload
  compute: (data: BiResponse["data"]) => {
    formattedValue: string
    delta: number
    deltaLabel: string
    trend: "up" | "down" | "stable"
    sparkline: number[]
  }
}

const KPI_CONFIGS: KpiConfig[] = [
  {
    id: "companies",
    label: "Entreprises indexées",
    icon: Building2,
    color: "emerald",
    hint: "Total en base (filtré par organisation)",
    compute: (d) => ({
      formattedValue: d!.kpis.totalCompanies.toLocaleString("fr-FR"),
      delta: Math.round(d!.growthRate * 10) / 10,
      deltaLabel: `${d!.companiesAddedThisMonth} ce mois`,
      trend: d!.growthRate > 0 ? "up" : "stable",
      sparkline: d!.growthData.map((g) => g.total),
    }),
  },
  {
    id: "jobs",
    label: "Jobs actifs",
    icon: Activity,
    color: "orange",
    hint: "Jobs de scraping running + queued",
    compute: (d) => ({
      formattedValue: String(d!.kpis.activeJobs),
      delta: 0,
      deltaLabel: d!.kpis.activeJobs > 0 ? "En cours" : "Aucun job actif",
      trend: d!.kpis.activeJobs > 0 ? "up" : "stable",
      sparkline: d!.growthData.map((g) => g.new),
    }),
  },
  {
    id: "sources",
    label: "Sources connectées",
    icon: Database,
    color: "emerald",
    hint: "Sources de données ayant déjà fourni des entreprises",
    compute: (d) => ({
      formattedValue: String(d!.kpis.sourcesConnected),
      delta: 0,
      deltaLabel: d!.kpis.sourcesConnected > 0
        ? `${d!.kpis.distinctSectors} secteurs`
        : "Lancez un scraping",
      trend: d!.kpis.sourcesConnected > 0 ? "up" : "stable",
      sparkline: d!.growthData.map(() => d!.kpis.sourcesConnected),
    }),
  },
  {
    id: "dedup",
    label: "Taux dédup",
    icon: GitMerge,
    color: "orange",
    hint: "Taux de déduplication IA (non tracé — 0%)",
    compute: (d) => ({
      formattedValue: `${d!.kpis.dedupRate.toFixed(1)}%`,
      delta: 0,
      deltaLabel: "Pas encore tracé",
      trend: "stable",
      sparkline: d!.growthData.map(() => d!.kpis.dedupRate),
    }),
  },
  {
    id: "enrichment",
    label: "Taux enrichissement",
    icon: Sparkles,
    color: "emerald",
    hint: "Entreprises avec email ET téléphone",
    compute: (d) => ({
      formattedValue: `${d!.kpis.enrichmentRate.toFixed(1)}%`,
      delta: 0,
      deltaLabel: d!.kpis.enrichmentRate > 50 ? "Bon" : d!.kpis.enrichmentRate > 0 ? "À améliorer" : "Vide",
      trend: d!.kpis.enrichmentRate > 50 ? "up" : "stable",
      sparkline: d!.growthData.map(() => d!.kpis.enrichmentRate),
    }),
  },
  {
    id: "api",
    label: "Appels API",
    icon: Zap,
    color: "orange",
    hint: "Appels API ce mois (quota d'organisation)",
    compute: (d) => ({
      formattedValue: d!.kpis.apiCallsThisMonth.toLocaleString("fr-FR"),
      delta: 0,
      deltaLabel: "Ce mois",
      trend: d!.kpis.apiCallsThisMonth > 0 ? "up" : "stable",
      sparkline: d!.growthData.map(() => d!.kpis.apiCallsThisMonth),
    }),
  },
]

// ============================================================================
// Color + Sparkline helpers
// ============================================================================

const colorMap: Record<string, { bg: string; text: string; spark: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", spark: "#10b981" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", spark: "#f97316" },
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length === 0) data = [0, 0]
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const width = 80
  const height = 28
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={`0,${height} ${points} ${width},${height}`}
        fill={color}
        opacity="0.1"
      />
      <circle
        cx={width}
        cy={height - ((data[data.length - 1] - min) / range) * height}
        r="2"
        fill={color}
      />
    </svg>
  )
}

// ============================================================================
// Main component — fetch /api/v1/bi on mount
// ============================================================================

export function AnalyticsKpis() {
  const [data, setData] = useState<BiResponse["data"] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true
    fetch("/api/v1/bi", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((json: BiResponse) => {
        if (!mounted) return
        if (json?.success && json.data) {
          setData(json.data)
        } else {
          setError(true)
        }
      })
      .catch(() => {
        if (mounted) setError(true)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {KPI_CONFIGS.slice(0, 4).map((kpi) => (
          <Card key={kpi.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-9 w-9 rounded-lg" />
                <Skeleton className="h-7 w-20" />
              </div>
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {KPI_CONFIGS.slice(0, 4).map((kpi) => {
          const Icon = kpi.icon
          const colors = colorMap[kpi.color]
          return (
            <Card key={kpi.id} className="opacity-60">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", colors.bg, colors.text)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
                <p className="text-2xl font-bold tracking-tight">—</p>
                <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-1">Données indisponibles</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {KPI_CONFIGS.slice(0, 4).map((kpi) => {
        const computed = kpi.compute(data)
        // Build a KpiData-compatible object so the existing KpiCard renders
        // without modification.
        const kpiData: KpiData = {
          id: kpi.id,
          label: kpi.label,
          value: 0,
          formattedValue: computed.formattedValue,
          delta: computed.delta,
          deltaLabel: computed.deltaLabel,
          trend: computed.trend,
          sparkline: computed.sparkline.length > 0 ? computed.sparkline : [0, 0],
          icon: kpi.id === "companies" ? "building"
            : kpi.id === "jobs" ? "activity"
            : kpi.id === "sources" ? "database"
            : "git-merge",
          color: kpi.color,
          hint: kpi.hint,
        }
        return <KpiCard key={kpi.id} kpi={kpiData} IconOverride={kpi.icon} />
      })}
    </div>
  )
}

function KpiCard({ kpi, IconOverride }: { kpi: KpiData; IconOverride?: React.ElementType }) {
  const Icon = IconOverride || Building2
  const colors = colorMap[kpi.color] || colorMap.emerald
  const TrendIcon = kpi.trend === "up" ? TrendingUp : kpi.trend === "down" ? TrendingDown : TrendingUp

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow group">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", colors.bg, colors.text)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1">
            <Sparkline data={kpi.sparkline} color={colors.spark} />
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold tracking-tight tabular-nums">{kpi.formattedValue}</p>
          {kpi.delta !== 0 && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-[11px] font-semibold",
                kpi.trend === "up" && "text-emerald-600 dark:text-emerald-400",
                kpi.trend === "down" && "text-orange-600 dark:text-orange-400",
                kpi.trend === "stable" && "text-muted-foreground"
              )}
            >
              <TrendIcon className="h-3 w-3" />
              {kpi.delta > 0 ? "+" : ""}{kpi.delta}{kpi.value < 100 ? "%" : ""}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">{kpi.deltaLabel}</p>
      </CardContent>
    </Card>
  )
}
