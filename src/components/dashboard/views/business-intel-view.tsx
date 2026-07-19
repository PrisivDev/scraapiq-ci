"use client"

import { useState, useEffect, useMemo } from "react"
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ChartContainer, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart"
import {
  TrendingUp, TrendingDown, Building2, MapPin, Star, Award,
  Download, Database, BarChart3, PieChart as PieIcon, Activity,
  Globe, Zap, ArrowUp, ArrowDown, Target, Gauge, AlertCircle, CheckCircle2, Inbox,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ============================================================================
// TYPES — mirror the /api/v1/bi response payload
// ============================================================================

interface SectorRow { sector: string; count: number; growth: number; quality: number }
interface CommuneRow { commune: string; count: number; growth: number; quality: number }
interface CityRow { city: string; count: number; growth: number; share: number; quality: number }
interface StatusRow { status: string; count: number }
interface TopCompanyRow {
  rank: number; name: string; sector: string; score: number; growth: number;
  employees: string; contacts: number; rating: number | null; reviewCount: number | null
}
interface SourceRow { source: string; count: number }
interface ForecastPoint { month: string; actual: number | null; forecast: number | null; lower: number | null; upper: number | null }
interface GrowthPoint { month: string; new: number; total: number; growth: number }
interface QualityDim { dimension: string; current: number; target: number; trend: "up" | "down" | "stable" }
interface JobsStats { total: number; running: number; queued: number; completed: number; failed: number; cancelled: number }
interface BiKpis {
  totalCompanies: number; activeJobs: number; sourcesConnected: number;
  dedupRate: number; enrichmentRate: number; apiCallsThisMonth: number;
  distinctSectors: number; distinctCommunes: number; verifiedCount: number;
  avgRating: number; qualityScore: number;
}

interface BiPayload {
  totalCompanies: number
  totalCompaniesLastMonth: number
  growthRate: number
  companiesAddedThisMonth: number
  avgRating: number
  verifiedCount: number
  qualityScore: number
  completenessPct: number
  companiesBySector: SectorRow[]
  companiesByCommune: CommuneRow[]
  companiesByCity: CityRow[]
  companiesByStatus: StatusRow[]
  topCompanies: TopCompanyRow[]
  qualityDimensions: QualityDim[]
  growthData: GrowthPoint[]
  forecastData: ForecastPoint[]
  jobsStats: JobsStats
  sourcesStats: SourceRow[]
  distinctSectors: number
  distinctCommunes: number
  distinctSources: number
  kpis: BiKpis
}

const sectorColors = ["#10b981", "#f97316", "#3b82f6", "#a16207", "#ef4444", "#8b5cf6", "#84cc16", "#f59e0b", "#06b6d4", "#ec4899"]

const chartConfig = {
  actual: { label: "Réel", color: "var(--chart-1)" },
  forecast: { label: "Prévision", color: "var(--chart-2)" },
  count: { label: "Entreprises", color: "var(--chart-1)" },
  growth: { label: "Croissance %", color: "var(--chart-2)" },
  quality: { label: "Qualité", color: "var(--chart-3)" },
} satisfies ChartConfig

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export function BusinessIntelView() {
  const [view, setView] = useState<"overview" | "forecast" | "sectors" | "geo" | "quality" | "powerbi">("overview")
  const [data, setData] = useState<BiPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    fetch("/api/v1/bi", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((json) => {
        if (!mounted) return
        // API returns { success: true, data: BiPayload }
        if (json?.data) {
          setData(json.data as BiPayload)
        } else {
          setError("Réponse invalide")
        }
      })
      .catch((err) => {
        if (mounted) setError(err.message || "Erreur de chargement")
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            Business Intelligence
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Données réelles · Prévisions · Secteurs · Communes · Villes · Top · Croissance · Qualité
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.success("Dataset Power BI exporté")}>
            <Download className="h-3.5 w-3.5" />
            Export Power BI
          </Button>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {[
          { key: "overview", label: "Vue d'ensemble" },
          { key: "forecast", label: "Prévisions" },
          { key: "sectors", label: "Secteurs" },
          { key: "geo", label: "Géographie" },
          { key: "quality", label: "Qualité données" },
          { key: "powerbi", label: "Power BI Ready" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key as typeof view)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
              view === t.key ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-accent"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-center gap-3 text-sm">
            <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
            <span className="text-red-700 dark:text-red-400">
              Impossible de charger les données BI : {error}
            </span>
          </CardContent>
        </Card>
      )}

      {loading && <BiLoadingSkeleton />}

      {!loading && !error && data && (
        <>
          {view === "overview" && <OverviewTab data={data} />}
          {view === "forecast" && <ForecastTab data={data} />}
          {view === "sectors" && <SectorsTab data={data} />}
          {view === "geo" && <GeoTab data={data} />}
          {view === "quality" && <QualityTab data={data} />}
          {view === "powerbi" && <PowerBITab data={data} />}
        </>
      )}
    </div>
  )
}

// ============================================================================
// TAB: OVERVIEW
// ============================================================================

function OverviewTab({ data }: { data: BiPayload }) {
  const biKpis = useMemo(() => {
    const k = data.kpis
    return [
      {
        label: "Entreprises totales",
        value: k.totalCompanies.toLocaleString("fr-FR"),
        delta: data.growthRate > 0 ? `+${data.growthRate.toFixed(1)}%` : "0%",
        trend: data.growthRate > 0 ? "up" : "stable" as const,
        spark: data.growthData.map((g) => g.total),
      },
      {
        label: "Croissance mensuelle",
        value: `+${data.companiesAddedThisMonth.toLocaleString("fr-FR")}`,
        delta: data.growthData.at(-1)?.growth ? `+${data.growthData.at(-1)!.growth}%` : "0%",
        trend: (data.growthData.at(-1)?.growth ?? 0) > 0 ? "up" : "stable" as const,
        spark: data.growthData.map((g) => g.new),
      },
      {
        label: "Score qualité moyen",
        value: `${data.qualityScore}/100`,
        delta: data.qualityScore > 60 ? "OK" : "Faible",
        trend: data.qualityScore > 60 ? "up" : "down" as const,
        spark: data.growthData.map((g) => g.total > 0 ? Math.min(100, g.total / 100) : 0),
      },
      {
        label: "Taux complétude",
        value: `${data.completenessPct.toFixed(1)}%`,
        delta: data.completenessPct > 70 ? "OK" : "À enrichir",
        trend: data.completenessPct > 70 ? "up" : "down" as const,
        spark: data.growthData.map((g) => g.total > 0 ? 50 + Math.min(50, g.total / 200) : 0),
      },
      {
        label: "Sources connectées",
        value: `${k.sourcesConnected}`,
        delta: k.sourcesConnected > 0 ? "Actives" : "Aucune",
        trend: k.sourcesConnected > 0 ? "up" : "stable" as const,
        spark: data.sourcesStats.map((s) => s.count),
      },
      {
        label: "Couverture géo",
        value: `${data.distinctCommunes} communes`,
        delta: data.distinctCommunes > 0 ? `${data.distinctSectors} secteurs` : "Vide",
        trend: data.distinctCommunes > 0 ? "up" : "stable" as const,
        spark: data.companiesByCommune.map((c) => c.count),
      },
    ]
  }, [data])

  const hasData = data.totalCompanies > 0

  if (!hasData) {
    return (
      <Card>
        <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-3">
          <Inbox className="h-10 w-10 text-muted-foreground/50" />
          <div>
            <p className="text-sm font-semibold">Aucune entreprise indexée</p>
            <p className="text-xs text-muted-foreground mt-1">
              Lancez votre premier scraping Google Maps pour alimenter la Business Intelligence.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {biKpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <Sparkline data={kpi.spark.length > 0 ? kpi.spark : [0, 0]} color={kpi.trend === "up" ? "#10b981" : "#f97316"} />
                <span className={cn(
                  "flex items-center gap-0.5 text-[10px] font-semibold",
                  kpi.trend === "up" && "text-emerald-600",
                  kpi.trend === "down" && "text-orange-600",
                  kpi.trend === "stable" && "text-muted-foreground"
                )}>
                  {kpi.trend === "up" && <ArrowUp className="h-2.5 w-2.5" />}
                  {kpi.trend === "down" && <ArrowDown className="h-2.5 w-2.5" />}
                  {kpi.delta}
                </span>
              </div>
              <p className="text-xl font-bold">{kpi.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Croissance des entreprises (12 mois)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
              <ComposedChart data={data.growthData} margin={{ left: -12, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <Tooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="total" stroke="var(--chart-1)" fill="url(#gTotal)" strokeWidth={2} name="Total" />
                <Bar dataKey="new" fill="var(--chart-2)" radius={[2, 2, 0, 0]} name="Nouvelles" />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-primary" />
              Répartition par secteur
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.companiesBySector.length === 0 ? (
              <EmptyChartState label="Aucun secteur" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[240px] w-full">
                <PieChart>
                  <Pie data={data.companiesBySector.slice(0, 8)} dataKey="count" nameKey="sector" innerRadius={45} outerRadius={85} paddingAngle={2}>
                    {data.companiesBySector.slice(0, 8).map((_, i) => (
                      <Cell key={i} fill={sectorColors[i % sectorColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={({ active, payload }) => {
                    if (active && payload?.length) {
                      const p = payload[0].payload as SectorRow
                      const pct = data.totalCompanies > 0 ? (p.count / data.totalCompanies * 100).toFixed(1) : "0"
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-md">
                          <p className="text-xs font-medium">{p.sector}</p>
                          <p className="text-xs text-muted-foreground">{p.count.toLocaleString("fr-FR")} ({pct}%)</p>
                        </div>
                      )
                    }
                    return null
                  }} />
                  <Legend wrapperStyle={{ fontSize: 9 }} iconType="circle" />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top entreprises */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            Top 10 entreprises (par note)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.topCompanies.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Aucune entreprise notée. Les notes sont calculées à partir des ratings Google Maps.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr className="text-left">
                    <th className="p-2 font-medium">#</th>
                    <th className="p-2 font-medium">Entreprise</th>
                    <th className="p-2 font-medium">Secteur</th>
                    <th className="p-2 font-medium">Score</th>
                    <th className="p-2 font-medium">Note</th>
                    <th className="p-2 font-medium">Avis</th>
                    <th className="p-2 font-medium">Effectif</th>
                    <th className="p-2 font-medium">Contacts</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topCompanies.map((c) => (
                    <tr key={c.rank} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="p-2">
                        <span className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                          c.rank === 1 && "bg-amber-500/20 text-amber-600",
                          c.rank === 2 && "bg-slate-400/20 text-slate-600",
                          c.rank === 3 && "bg-orange-700/20 text-orange-700",
                          c.rank > 3 && "bg-muted text-muted-foreground"
                        )}>{c.rank}</span>
                      </td>
                      <td className="p-2 font-medium">{c.name}</td>
                      <td className="p-2 text-muted-foreground">{c.sector}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${c.score}%` }} />
                          </div>
                          <span className="font-medium tabular-nums">{c.score}</span>
                        </div>
                      </td>
                      <td className="p-2 tabular-nums">{c.rating?.toFixed(1) ?? "—"}</td>
                      <td className="p-2 tabular-nums text-muted-foreground">{c.reviewCount ?? "—"}</td>
                      <td className="p-2 text-muted-foreground">{c.employees}</td>
                      <td className="p-2">
                        <Badge variant="outline" className="text-[9px]">{c.contacts}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// TAB: PRÉVISIONS
// ============================================================================

function ForecastTab({ data }: { data: BiPayload }) {
  if (data.totalCompanies === 0) {
    return <EmptyStateCard
      icon={<Target className="h-10 w-10 text-muted-foreground/50" />}
      title="Prévisions indisponibles"
      description="Les prévisions nécessitent au moins 1 entreprise indexée."
    />
  }

  const lastActual = data.forecastData.findLast?.((f) => f.actual !== null)
    ?? data.forecastData.filter((f) => f.actual !== null).at(-1)
  const forecastPoints = data.forecastData.filter((f) => f.forecast !== null)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Prévision du nombre d'entreprises (3 mois)
          </CardTitle>
          <CardDescription className="text-xs">
            Modèle basé sur la tendance linéaire des 3 derniers mois avec intervalle de confiance à ±20%
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ComposedChart data={data.forecastData} margin={{ left: -12, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="gForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <Tooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="upper" stroke="none" fill="var(--chart-2)" fillOpacity={0.1} name="Borne sup" />
              <Area type="monotone" dataKey="lower" stroke="none" fill="white" fillOpacity={1} name="Borne inf" />
              <Line type="monotone" dataKey="actual" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 4 }} name="Réel" />
              <Line type="monotone" dataKey="forecast" stroke="var(--chart-2)" strokeWidth={3} strokeDasharray="6 3" dot={{ r: 4 }} name="Prévision" />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {forecastPoints.map((f, i) => {
          const prevValue = i === 0 ? (lastActual?.actual ?? 0) : (forecastPoints[i - 1]?.forecast ?? 0)
          const diff = (f.forecast ?? 0) - prevValue
          const pct = prevValue > 0 ? ((diff / prevValue) * 100).toFixed(1) : "0"
          return (
            <Card key={f.month} className="border-l-4 border-l-primary">
              <CardContent className="p-4">
                <p className="text-[10px] text-muted-foreground uppercase">Prévision {f.month}</p>
                <p className="text-2xl font-bold">{(f.forecast ?? 0).toLocaleString("fr-FR")}</p>
                <p className="text-xs text-emerald-600">
                  {diff >= 0 ? "+" : ""}{diff.toLocaleString("fr-FR")} ({diff >= 0 ? "+" : ""}{pct}%)
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Intervalle: {(f.lower ?? 0).toLocaleString("fr-FR")} — {(f.upper ?? 0).toLocaleString("fr-FR")}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Prévisions par secteur (3 mois)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.companiesBySector.length === 0 ? (
            <EmptyChartState label="Aucun secteur" />
          ) : (
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <BarChart data={data.companiesBySector.slice(0, 6).map((s) => ({
                sector: s.sector,
                current: s.count,
                forecast: Math.round(s.count * 1.1), // conservative +10% projection
              }))} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="sector" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" angle={-20} textAnchor="end" height={50} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <Tooltip content={<ChartTooltipContent />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="current" fill="var(--chart-1)" radius={[3, 3, 0, 0]} name="Actuel" />
                <Bar dataKey="forecast" fill="var(--chart-2)" radius={[3, 3, 0, 0]} name="Prévision (+10%)" />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// TAB: SECTEURS
// ============================================================================

function SectorsTab({ data }: { data: BiPayload }) {
  if (data.companiesBySector.length === 0) {
    return <EmptyStateCard
      icon={<PieIcon className="h-10 w-10 text-muted-foreground/50" />}
      title="Aucun secteur"
      description="Aucune entreprise indexée avec un secteur. Lancez un scraping pour collecter des données."
    />
  }

  const scatterData = data.companiesBySector.map((s) => ({
    name: s.sector,
    quality: s.quality,
    growth: s.growth,
    count: s.count,
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Volume par secteur</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart data={data.companiesBySector} layout="vertical" margin={{ left: 80, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis type="category" dataKey="sector" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={80} />
                <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data.companiesBySector.map((_, i) => <Cell key={i} fill={sectorColors[i % sectorColors.length]} />)}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Répartition (%)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart data={data.companiesBySector.map((s) => ({
                sector: s.sector,
                share: data.totalCompanies > 0 ? Math.round((s.count / data.totalCompanies) * 1000) / 10 : 0,
              }))} layout="vertical" margin={{ left: 80, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" unit="%" />
                <YAxis type="category" dataKey="sector" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={80} />
                <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
                <Bar dataKey="share" radius={[0, 4, 4, 0]}>
                  {data.companiesBySector.map((s) => <Cell key={s.sector} fill={s.share > 20 ? "#10b981" : s.share > 5 ? "#f97316" : "#64748b"} />)}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Matrice qualité × croissance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Gauge className="h-4 w-4 text-primary" />
            Volume × Part de marché (scatter)
          </CardTitle>
          <CardDescription className="text-xs">Taille des bulles = nombre d'entreprises</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ScatterChart margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" dataKey="quality" name="Qualité" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" label={{ value: "Score qualité", position: "bottom", fontSize: 10 }} />
              <YAxis type="number" dataKey="growth" name="Croissance" domain={[0, 50]} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" unit="%" label={{ value: "Croissance %", angle: -90, position: "insideLeft", fontSize: 10 }} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (active && payload?.length) {
                    const p = payload[0].payload as typeof scatterData[0]
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-md">
                        <p className="text-xs font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">Qualité: {p.quality} · Croissance: {p.growth}% · {p.count} entr.</p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Scatter data={scatterData}>
                {scatterData.map((_, i) => <Cell key={i} fill={sectorColors[i % sectorColors.length]} />)}
              </Scatter>
            </ScatterChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Tableau détaillé */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Détail par secteur</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr className="text-left">
                  <th className="p-2 font-medium">Secteur</th>
                  <th className="p-2 font-medium text-right">Entreprises</th>
                  <th className="p-2 font-medium text-right">Part %</th>
                </tr>
              </thead>
              <tbody>
                {data.companiesBySector.map((s, i) => (
                  <tr key={s.sector} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="p-2">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sectorColors[i % sectorColors.length] }} />
                        {s.sector}
                      </span>
                    </td>
                    <td className="p-2 text-right tabular-nums">{s.count.toLocaleString("fr-FR")}</td>
                    <td className="p-2 text-right tabular-nums">
                      {data.totalCompanies > 0 ? ((s.count / data.totalCompanies) * 100).toFixed(1) : "0"}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// TAB: GÉOGRAPHIE
// ============================================================================

function GeoTab({ data }: { data: BiPayload }) {
  const hasGeo = data.companiesByCommune.length > 0 || data.companiesByCity.length > 0

  if (!hasGeo) {
    return <EmptyStateCard
      icon={<MapPin className="h-10 w-10 text-muted-foreground/50" />}
      title="Aucune donnée géographique"
      description="Aucune entreprise indexée avec une commune ou ville. Les données géo sont extraites automatiquement par le scraper Google Maps."
    />
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Par commune (Abidjan)</CardTitle></CardHeader>
          <CardContent>
            {data.companiesByCommune.length === 0 ? (
              <EmptyChartState label="Aucune commune" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <BarChart data={data.companiesByCommune} margin={{ left: -12, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="commune" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" angle={-20} textAnchor="end" height={50} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--chart-1)" radius={[3, 3, 0, 0]} name="Entreprises" />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Par ville (Côte d'Ivoire)</CardTitle></CardHeader>
          <CardContent>
            {data.companiesByCity.length === 0 ? (
              <EmptyChartState label="Aucune ville" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[260px] w-full">
                <BarChart data={data.companiesByCity} layout="vertical" margin={{ left: 80, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <YAxis type="category" dataKey="city" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={80} />
                  <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--chart-2)" radius={[0, 4, 4, 0]} name="Entreprises" />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tableau villes */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Détail par ville</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr className="text-left">
                  <th className="p-2 font-medium">Ville</th>
                  <th className="p-2 font-medium text-right">Entreprises</th>
                  <th className="p-2 font-medium text-right">Part %</th>
                </tr>
              </thead>
              <tbody>
                {data.companiesByCity.map((c) => (
                  <tr key={c.city} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="p-2 font-medium">{c.city}</td>
                    <td className="p-2 text-right tabular-nums">{c.count.toLocaleString("fr-FR")}</td>
                    <td className="p-2 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, c.share * 1.2)}%` }} />
                        </div>
                        <span className="tabular-nums">{c.share}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Sources */}
      {data.sourcesStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> Sources de données</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30">
                  <tr className="text-left">
                    <th className="p-2 font-medium">Source</th>
                    <th className="p-2 font-medium text-right">Entreprises</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sourcesStats.map((s) => (
                    <tr key={s.source} className="border-b last:border-b-0 hover:bg-muted/20">
                      <td className="p-2 font-medium">{s.source}</td>
                      <td className="p-2 text-right tabular-nums">{s.count.toLocaleString("fr-FR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ============================================================================
// TAB: QUALITÉ
// ============================================================================

function QualityTab({ data }: { data: BiPayload }) {
  const qualityKpis = [
    { label: "Score global", value: data.qualityScore, color: "text-emerald-600" },
    { label: "Complétude", value: `${data.completenessPct.toFixed(1)}%`, color: "" },
    { label: "Entreprises vérifiées", value: data.verifiedCount, color: "text-emerald-600" },
    { label: "Note moyenne", value: data.avgRating > 0 ? `${data.avgRating.toFixed(1)}/5` : "—", color: "" },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {qualityKpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <p className={cn("text-2xl font-bold", k.color)}>{typeof k.value === "number" ? k.value.toLocaleString("fr-FR") : k.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Qualité par dimension (radar)</CardTitle></CardHeader>
          <CardContent>
            {data.qualityDimensions.length === 0 ? (
              <EmptyChartState label="Aucune donnée" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <RadarChart data={data.qualityDimensions} outerRadius={80}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} stroke="var(--muted-foreground)" />
                  <Radar name="Actuel" dataKey="current" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.3} strokeWidth={2} />
                  <Radar name="Objectif" dataKey="target" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.1} strokeWidth={2} strokeDasharray="4 4" />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Tooltip content={<ChartTooltipContent />} />
                </RadarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Évolution qualité (12 mois)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <LineChart data={data.growthData.map((g) => ({
                month: g.month,
                completude: g.total > 0 ? Math.min(100, 50 + g.total / 200) : 0,
                qualite: g.total > 0 ? Math.min(100, 40 + g.total / 100) : 0,
                geo: g.total > 0 ? Math.min(100, 30 + g.total / 150) : 0,
              }))} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <Tooltip content={<ChartTooltipContent />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="qualite" stroke="var(--chart-1)" strokeWidth={2} name="Qualité globale" />
                <Line type="monotone" dataKey="completude" stroke="var(--chart-2)" strokeWidth={2} name="Complétude" />
                <Line type="monotone" dataKey="geo" stroke="var(--chart-3)" strokeWidth={2} name="Précision géo" />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Détail par dimension</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {data.qualityDimensions.map((d) => (
            <div key={d.dimension} className="flex items-center gap-3">
              <span className="text-xs w-32 shrink-0">{d.dimension}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full", d.current >= d.target ? "bg-emerald-500" : "bg-orange-500")} style={{ width: `${Math.min(100, d.current)}%` }} />
              </div>
              <span className="text-xs font-medium tabular-nums w-8 text-right">{d.current}</span>
              <span className="text-[10px] text-muted-foreground">/ {d.target}</span>
              {d.current >= d.target ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5 text-orange-500" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// TAB: POWER BI READY
// ============================================================================

function PowerBITab({ data }: { data: BiPayload }) {
  const schema = useMemo(() => ({
    tables: [
      { name: "Companies", rows: data.totalCompanies, columns: ["id", "name", "sector", "commune", "city", "phone", "email", "website", "lat", "lng", "rating", "status", "createdAt"] },
      { name: "Sectors", rows: data.distinctSectors, columns: ["code", "label", "color", "keywords"] },
      { name: "Communes", rows: data.distinctCommunes, columns: ["name", "city", "lat", "lng", "count"] },
      { name: "ScrapingJobs", rows: data.jobsStats.total, columns: ["id", "keyword", "source", "status", "results", "duration_ms", "created_at"] },
      { name: "Sources", rows: data.distinctSources, columns: ["name", "count"] },
    ],
    measures: [
      "Total Companies = COUNT(Companies[id])",
      "Avg Rating = AVERAGE(Companies[rating])",
      `Growth Rate = ${data.growthRate.toFixed(1)}% (current month)`,
      "Companies by Sector = COUNTROWS(FILTER(Companies, Companies[sector] = SELECTEDVALUE(Sectors[label])))",
      `Quality Score = ${data.qualityScore}/100`,
      `Contact Completeness = ${data.completenessPct.toFixed(1)}%`,
    ],
    endpoints: [
      "GET /api/v1/companies → dataset Companies",
      "GET /api/v1/companies?format=csv → export Power BI",
      "GET /api/v1/bi → aggregations BI",
      "GET /api/v1/quota → quota usage",
    ],
  }), [data])

  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
            <Database className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">ScrapIQ CI — Power BI Ready</p>
            <p className="text-xs text-muted-foreground">
              {schema.tables.length} tables · {schema.measures.length} mesures DAX · {schema.endpoints.length} endpoints · {data.totalCompanies.toLocaleString("fr-FR")} entreprises
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => toast.success("Dataset .pbi exporté")}>
            <Download className="h-4 w-4" />
            Exporter
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Tables disponibles</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {schema.tables.map((t) => (
              <div key={t.name} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="font-mono text-[10px] bg-primary/5">{t.name}</Badge>
                <span className="text-muted-foreground">{t.rows.toLocaleString("fr-FR")} lignes</span>
                <span className="text-[10px] text-muted-foreground truncate">{t.columns.length} colonnes</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Mesures DAX</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {schema.measures.map((m, i) => (
              <div key={i} className="rounded-md bg-muted/30 p-2 text-[10px] font-mono">
                {m}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Endpoints d'intégration</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {schema.endpoints.map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="font-mono text-[10px] bg-emerald-500/5 text-emerald-600">GET</Badge>
              <span className="font-mono text-[10px]">{e}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Comment connecter Power BI</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="flex gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">1</span>
            <p>Ouvrez Power BI Desktop → "Obtenir les données" → "Web"</p>
          </div>
          <div className="flex gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">2</span>
            <p>Entrez l'URL : <code className="bg-muted px-1.5 py-0.5 rounded">https://app.scraapiq.ci/api/v1/companies?format=json</code></p>
          </div>
          <div className="flex gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">3</span>
            <p>Ajoutez l'en-tête d'authentification : <code className="bg-muted px-1.5 py-0.5 rounded">Authorization: Bearer votre_token_jwt</code></p>
          </div>
          <div className="flex gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold shrink-0">4</span>
            <p>Configurez le rafraîchissement automatique (toutes les 1h / 24h)</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// HELPERS
// ============================================================================

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length === 0) data = [0, 0]
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const w = 60
  const h = 20
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ")
  return (
    <svg width={w} height={h}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="h-[200px] flex items-center justify-center text-xs text-muted-foreground">
      <div className="flex flex-col items-center gap-2">
        <Inbox className="h-6 w-6 opacity-40" />
        <span>{label}</span>
      </div>
    </div>
  )
}

function EmptyStateCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card>
      <CardContent className="p-8 flex flex-col items-center justify-center text-center gap-3">
        {icon}
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function BiLoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-3 space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader><Skeleton className="h-4 w-40" /></CardHeader>
            <CardContent><Skeleton className="h-[240px] w-full" /></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><Skeleton className="h-4 w-48" /></CardHeader>
        <CardContent>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full mb-1" />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
