"use client"

import { useState, useMemo } from "react"
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ChartContainer, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart"
import {
  TrendingUp, TrendingDown, Building2, MapPin, Star, Award,
  Download, Database, BarChart3, PieChart as PieIcon, Activity,
  Globe, Zap, ArrowUp, ArrowDown, Target, Gauge,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ============================================================================
// DONNÉES BI
// ============================================================================

const biKpis = [
  { label: "Entreprises totales", value: "38 862", delta: "+12.4%", trend: "up", spark: [28500, 29800, 31200, 32800, 34100, 35900, 37200, 38862] },
  { label: "Croissance mensuelle", value: "+4 283", delta: "+8.2%", trend: "up", spark: [2100, 2400, 2800, 3100, 3500, 3900, 4100, 4283] },
  { label: "Score qualité moyen", value: "78/100", delta: "+5 pts", trend: "up", spark: [65, 68, 70, 72, 74, 76, 77, 78] },
  { label: "Taux complétude", value: "84.2%", delta: "+4.8%", trend: "up", spark: [72, 75, 78, 79, 81, 82, 83, 84.2] },
  { label: "Sources actives", value: "6/6", delta: "Stable", trend: "stable", spark: [6, 6, 6, 5, 6, 6, 6, 6] },
  { label: "Couverture géo", value: "12 communes", delta: "+2", trend: "up", spark: [8, 9, 9, 10, 10, 11, 11, 12] },
]

// Prévisions (3 mois) avec intervalle de confiance
const forecastData = [
  { month: "Avr", actual: 32800, forecast: null, lower: null, upper: null },
  { month: "Mai", actual: 34100, forecast: null, lower: null, upper: null },
  { month: "Juin", actual: 35900, forecast: null, lower: null, upper: null },
  { month: "Juil", actual: 37200, forecast: null, lower: null, upper: null },
  { month: "Août", actual: 38862, forecast: null, lower: null, upper: null },
  { month: "Sep", actual: null, forecast: 41200, lower: 39800, upper: 42600 },
  { month: "Oct", actual: null, forecast: 43500, lower: 41200, upper: 45800 },
  { month: "Nov", actual: null, forecast: 45800, lower: 42500, upper: 49100 },
]

// Par secteur
const sectorData = [
  { sector: "Restauration", count: 8420, growth: 14.2, quality: 82, revenue: 4.2 },
  { sector: "Commerce", count: 7180, growth: 8.5, quality: 75, revenue: 6.8 },
  { sector: "Télécom", count: 5240, growth: 5.2, quality: 91, revenue: 12.4 },
  { sector: "BTP", count: 4620, growth: 18.3, quality: 78, revenue: 8.9 },
  { sector: "Santé", count: 3890, growth: 9.4, quality: 85, revenue: 5.6 },
  { sector: "Banque", count: 3210, growth: 4.8, quality: 93, revenue: 15.2 },
  { sector: "Agro", count: 2840, growth: 14.8, quality: 72, revenue: 7.3 },
  { sector: "Transport", count: 2120, growth: 11.5, quality: 76, revenue: 4.8 },
  { sector: "IT", count: 1820, growth: 22.1, quality: 88, revenue: 3.9 },
  { sector: "Tourisme", count: 1450, growth: 3.2, quality: 80, revenue: 2.8 },
]

const sectorColors = ["#10b981", "#f97316", "#3b82f6", "#a16207", "#ef4444", "#8b5cf6", "#84cc16", "#f59e0b", "#06b6d4", "#ec4899"]

// Par commune
const communeData = [
  { commune: "Cocody", count: 8210, growth: 14.2, quality: 84, density: 92 },
  { commune: "Plateau", count: 6890, growth: 8.5, quality: 88, density: 85 },
  { commune: "Yopougon", count: 5760, growth: 18.3, quality: 72, density: 68 },
  { commune: "Marcory", count: 4340, growth: 6.1, quality: 79, density: 74 },
  { commune: "Treichville", count: 3980, growth: 4.8, quality: 81, density: 78 },
  { commune: "Koumassi", count: 3620, growth: 9.4, quality: 75, density: 65 },
  { commune: "Abobo", count: 3450, growth: 22.1, quality: 68, density: 58 },
  { commune: "Adjamé", count: 3280, growth: 7.2, quality: 73, density: 71 },
]

// Par ville
const cityData = [
  { city: "Abidjan", count: 38862, growth: 12.4, share: 78.5, quality: 78 },
  { city: "Bouaké", count: 3210, growth: 8.9, share: 6.5, quality: 72 },
  { city: "Yamoussoukro", count: 2450, growth: 6.2, share: 4.9, quality: 75 },
  { city: "San-Pédro", count: 1890, growth: 11.5, share: 3.8, quality: 70 },
  { city: "Korhogo", count: 1240, growth: 5.4, share: 2.5, quality: 68 },
  { city: "Daloa", count: 980, growth: 7.8, share: 2.0, quality: 71 },
  { city: "Grand-Bassam", count: 620, growth: 15.2, share: 1.3, quality: 76 },
  { city: "Man", count: 390, growth: 4.1, share: 0.8, quality: 65 },
]

// Top entreprises
const topCompanies = [
  { rank: 1, name: "Orange CI", sector: "Télécom", score: 98, growth: 12.4, employees: "5000+", contacts: 8 },
  { rank: 2, name: "MTN Côte d'Ivoire", sector: "Télécom", score: 96, growth: 8.9, employees: "3000+", contacts: 7 },
  { rank: 3, name: "BICICI", sector: "Banque", score: 95, growth: 5.2, employees: "1000+", contacts: 9 },
  { rank: 4, name: "SIFCA Industries", sector: "Agro", score: 94, growth: 18.3, employees: "2000+", contacts: 6 },
  { rank: 5, name: "CFAO Motors CI", sector: "Commerce", score: 92, growth: 6.7, employees: "500+", contacts: 7 },
  { rank: 6, name: "Société Cacao CI", sector: "Agro", score: 91, growth: 14.8, employees: "1000+", contacts: 5 },
  { rank: 7, name: "Hôtel Ibis Plateau", sector: "Tourisme", score: 89, growth: 3.2, employees: "100+", contacts: 8 },
  { rank: 8, name: "BTP Afrique", sector: "BTP", score: 87, growth: 22.1, employees: "200+", contacts: 4 },
  { rank: 9, name: "Abidjan Tech Hub", sector: "IT", score: 86, growth: 28.4, employees: "50+", contacts: 6 },
  { rank: 10, name: "EcoBank CI", sector: "Banque", score: 85, growth: 4.1, employees: "800+", contacts: 8 },
]

// Croissance par mois (12 mois)
const growthData = Array.from({ length: 12 }, (_, i) => {
  const date = new Date()
  date.setMonth(date.getMonth() - (11 - i))
  return {
    month: date.toLocaleDateString("fr-FR", { month: "short" }),
    new: Math.floor(2000 + Math.random() * 3000 + i * 200),
    total: 38862 - (11 - i) * 3500 + Math.floor(Math.random() * 500),
    growth: parseFloat((8 + Math.random() * 6 + i * 0.3).toFixed(1)),
  }
})

// Qualité des données par dimension
const qualityDimensions = [
  { dimension: "Complétude", current: 85, target: 90, trend: "up" },
  { dimension: "Validité contacts", current: 78, target: 85, trend: "up" },
  { dimension: "Qualité nom", current: 92, target: 95, trend: "up" },
  { dimension: "Précision géo", current: 68, target: 80, trend: "up" },
  { dimension: "Fiabilité source", current: 88, target: 90, trend: "stable" },
  { dimension: "Fraîcheur", current: 92, target: 85, trend: "up" },
  { dimension: "Présence online", current: 72, target: 80, trend: "up" },
]

// Matrice qualité × croissance (scatter)
const qualityGrowthMatrix = sectorData.map((s) => ({
  name: s.sector,
  quality: s.quality,
  growth: s.growth,
  count: s.count,
}))

// Power BI dataset structure
const powerBISchema = {
  tables: [
    { name: "Companies", rows: 38862, columns: ["id", "name", "sector", "commune", "city", "phone", "email", "website", "lat", "lng", "rating", "status", "quality_score", "created_at"] },
    { name: "Sectors", rows: 10, columns: ["code", "label", "color", "keywords"] },
    { name: "Communes", rows: 12, columns: ["name", "city", "lat", "lng", "count"] },
    { name: "ScrapingJobs", rows: 4821, columns: ["id", "keyword", "source", "status", "results", "duration_ms", "created_at"] },
    { name: "AuditLogs", rows: 12450, columns: ["id", "user_id", "action", "category", "ip", "created_at"] },
  ],
  measures: [
    "Total Companies = COUNT(Companies[id])",
    "Avg Quality = AVERAGE(Companies[quality_score])",
    "Growth Rate = ([Total Companies] - PREVIOUSMONTH([Total Companies])) / PREVIOUSMONTH([Total Companies])",
    "Companies by Sector = COUNTROWS(FILTER(Companies, Companies[sector] = SELECTEDVALUE(Sectors[label])))",
    "Quality Score = AVERAGE(Companies[quality_score])",
    "Contact Completeness = DIVIDE(COUNTROWS(FILTER(Companies, NOT(ISBLANK(Companies[phone])))), [Total Companies])",
  ],
  endpoints: [
    "GET /api/v1/companies → dataset Companies",
    "GET /api/v1/companies?format=csv → export Power BI",
    "GET /api/v1/queue → metrics temps réel",
    "WebSocket → streaming data",
  ],
}

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
            Power BI Ready · Prévisions · Secteurs · Communes · Villes · Top · Croissance · Qualité
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

      {view === "overview" && <OverviewTab />}
      {view === "forecast" && <ForecastTab />}
      {view === "sectors" && <SectorsTab />}
      {view === "geo" && <GeoTab />}
      {view === "quality" && <QualityTab />}
      {view === "powerbi" && <PowerBITab />}
    </div>
  )
}

// ============================================================================
// TAB: OVERVIEW
// ============================================================================

function OverviewTab() {
  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {biKpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-1">
                <Sparkline data={kpi.spark} color={kpi.trend === "up" ? "#10b981" : "#f97316"} />
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
              <ComposedChart data={growthData} margin={{ left: -12, right: 8, top: 8 }}>
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
            <ChartContainer config={chartConfig} className="h-[240px] w-full">
              <PieChart>
                <Pie data={sectorData.slice(0, 8)} dataKey="count" nameKey="sector" innerRadius={45} outerRadius={85} paddingAngle={2}>
                  {sectorData.slice(0, 8).map((_, i) => (
                    <Cell key={i} fill={sectorColors[i]} />
                  ))}
                </Pie>
                <Tooltip content={({ active, payload }) => {
                  if (active && payload?.length) {
                    const p = payload[0].payload as typeof sectorData[0]
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-md">
                        <p className="text-xs font-medium">{p.sector}</p>
                        <p className="text-xs text-muted-foreground">{p.count.toLocaleString("fr-FR")} ({(p.count / 38862 * 100).toFixed(1)}%)</p>
                      </div>
                    )
                  }
                  return null
                }} />
                <Legend wrapperStyle={{ fontSize: 9 }} iconType="circle" />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top entreprises */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            Top 10 entreprises (par score qualité)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr className="text-left">
                  <th className="p-2 font-medium">#</th>
                  <th className="p-2 font-medium">Entreprise</th>
                  <th className="p-2 font-medium">Secteur</th>
                  <th className="p-2 font-medium">Score</th>
                  <th className="p-2 font-medium">Croissance</th>
                  <th className="p-2 font-medium">Effectif</th>
                  <th className="p-2 font-medium">Contacts</th>
                </tr>
              </thead>
              <tbody>
                {topCompanies.map((c) => (
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
                    <td className="p-2">
                      <span className="text-emerald-600 font-medium">+{c.growth}%</span>
                    </td>
                    <td className="p-2 text-muted-foreground">{c.employees}</td>
                    <td className="p-2">
                      <Badge variant="outline" className="text-[9px]">{c.contacts}</Badge>
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
// TAB: PRÉVISIONS
// ============================================================================

function ForecastTab() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Prévision du nombre d'entreprises (3 mois)
          </CardTitle>
          <CardDescription className="text-xs">Modèle basé sur la tendance linéaire des 5 derniers mois avec intervalle de confiance à 95%</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ComposedChart data={forecastData} margin={{ left: -12, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="gForecast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" domain={[30000, 50000]} />
              <Tooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {/* Intervalle de confiance */}
              <Area type="monotone" dataKey="upper" stroke="none" fill="var(--chart-2)" fillOpacity={0.1} name="Borne sup" />
              <Area type="monotone" dataKey="lower" stroke="none" fill="white" fillOpacity={1} name="Borne inf" />
              {/* Réel */}
              <Line type="monotone" dataKey="actual" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 4 }} name="Réel" />
              {/* Prévision */}
              <Line type="monotone" dataKey="forecast" stroke="var(--chart-2)" strokeWidth={3} strokeDasharray="6 3" dot={{ r: 4 }} name="Prévision" />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase">Prévision Septembre</p>
            <p className="text-2xl font-bold">41 200</p>
            <p className="text-xs text-emerald-600">+2 338 vs Août (+6.0%)</p>
            <p className="text-[10px] text-muted-foreground mt-1">Intervalle: 39 800 — 42 600</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase">Prévision Octobre</p>
            <p className="text-2xl font-bold">43 500</p>
            <p className="text-xs text-emerald-600">+2 300 vs Sept (+5.6%)</p>
            <p className="text-[10px] text-muted-foreground mt-1">Intervalle: 41 200 — 45 800</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-[10px] text-muted-foreground uppercase">Prévision Novembre</p>
            <p className="text-2xl font-bold">45 800</p>
            <p className="text-xs text-emerald-600">+2 300 vs Oct (+5.3%)</p>
            <p className="text-[10px] text-muted-foreground mt-1">Intervalle: 42 500 — 49 100</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Prévisions par secteur (3 mois)</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <BarChart data={sectorData.slice(0, 6).map((s) => ({
              sector: s.sector,
              current: s.count,
              forecast: Math.round(s.count * (1 + s.growth / 100 * 3)),
            }))} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="sector" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" angle={-20} textAnchor="end" height={50} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <Tooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="current" fill="var(--chart-1)" radius={[3, 3, 0, 0]} name="Actuel" />
              <Bar dataKey="forecast" fill="var(--chart-2)" radius={[3, 3, 0, 0]} name="Prévision (+3 mois)" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// TAB: SECTEURS
// ============================================================================

function SectorsTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Volume par secteur</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart data={sectorData} layout="vertical" margin={{ left: 80, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis type="category" dataKey="sector" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={80} />
                <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {sectorData.map((_, i) => <Cell key={i} fill={sectorColors[i]} />)}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Croissance par secteur (%)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart data={sectorData} layout="vertical" margin={{ left: 80, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" unit="%" />
                <YAxis type="category" dataKey="sector" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={80} />
                <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
                <Bar dataKey="growth" radius={[0, 4, 4, 0]}>
                  {sectorData.map((s) => <Cell key={s.sector} fill={s.growth > 15 ? "#10b981" : s.growth > 8 ? "#f97316" : "#64748b"} />)}
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
            Matrice Qualité × Croissance (scatter)
          </CardTitle>
          <CardDescription className="text-xs">Taille des bulles = nombre d'entreprises</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px] w-full">
            <ScatterChart margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis type="number" dataKey="quality" name="Qualité" domain={[60, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" label={{ value: "Score qualité", position: "bottom", fontSize: 10 }} />
              <YAxis type="number" dataKey="growth" name="Croissance" domain={[0, 30]} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" unit="%" label={{ value: "Croissance %", angle: -90, position: "insideLeft", fontSize: 10 }} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                content={({ active, payload }) => {
                  if (active && payload?.length) {
                    const p = payload[0].payload as typeof qualityGrowthMatrix[0]
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
              <Scatter data={qualityGrowthMatrix}>
                {qualityGrowthMatrix.map((_, i) => <Cell key={i} fill={sectorColors[i]} />)}
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
                  <th className="p-2 font-medium text-right">Croissance</th>
                  <th className="p-2 font-medium text-right">Qualité</th>
                  <th className="p-2 font-medium text-right">CA estimé (Mds FCFA)</th>
                </tr>
              </thead>
              <tbody>
                {sectorData.map((s, i) => (
                  <tr key={s.sector} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="p-2">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sectorColors[i] }} />
                        {s.sector}
                      </span>
                    </td>
                    <td className="p-2 text-right tabular-nums">{s.count.toLocaleString("fr-FR")}</td>
                    <td className="p-2 text-right"><span className="text-emerald-600">+{s.growth}%</span></td>
                    <td className="p-2 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <div className="w-8 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${s.quality}%` }} />
                        </div>
                        <span className="tabular-nums">{s.quality}</span>
                      </div>
                    </td>
                    <td className="p-2 text-right tabular-nums">{s.revenue}</td>
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

function GeoTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Communes */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> Par commune (Abidjan)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart data={communeData} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="commune" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" angle={-20} textAnchor="end" height={50} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--chart-1)" radius={[3, 3, 0, 0]} name="Entreprises" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Villes */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Par ville (Côte d'Ivoire)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[260px] w-full">
              <BarChart data={cityData} layout="vertical" margin={{ left: 80, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis type="category" dataKey="city" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={80} />
                <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[0, 4, 4, 0]} name="Entreprises" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Croissance communale */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Croissance & qualité par commune</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[240px] w-full">
            <ComposedChart data={communeData} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="commune" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" angle={-20} textAnchor="end" height={50} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
              <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" domain={[0, 30]} unit="%" />
              <Tooltip content={<ChartTooltipContent />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="left" dataKey="count" fill="var(--chart-1)" radius={[3, 3, 0, 0]} name="Entreprises" />
              <Line yAxisId="right" type="monotone" dataKey="growth" stroke="var(--chart-2)" strokeWidth={2} name="Croissance %" />
              <Line yAxisId="right" type="monotone" dataKey="quality" stroke="var(--chart-3)" strokeWidth={2} strokeDasharray="4 2" name="Qualité" />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

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
                  <th className="p-2 font-medium text-right">Croissance</th>
                  <th className="p-2 font-medium text-right">Qualité</th>
                </tr>
              </thead>
              <tbody>
                {cityData.map((c) => (
                  <tr key={c.city} className="border-b last:border-b-0 hover:bg-muted/20">
                    <td className="p-2 font-medium">{c.city}</td>
                    <td className="p-2 text-right tabular-nums">{c.count.toLocaleString("fr-FR")}</td>
                    <td className="p-2 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${c.share * 1.2}%` }} />
                        </div>
                        <span className="tabular-nums">{c.share}%</span>
                      </div>
                    </td>
                    <td className="p-2 text-right text-emerald-600">+{c.growth}%</td>
                    <td className="p-2 text-right tabular-nums">{c.quality}</td>
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
// TAB: QUALITÉ
// ============================================================================

function QualityTab() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-emerald-600">78</p><p className="text-[10px] text-muted-foreground uppercase">Score global</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">84.2%</p><p className="text-[10px] text-muted-foreground uppercase">Complétude</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">17.8%</p><p className="text-[10px] text-muted-foreground uppercase">Doublons détectés</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-emerald-600">8 421</p><p className="text-[10px] text-muted-foreground uppercase">Fiches enrichies IA</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Qualité par dimension (radar)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <RadarChart data={qualityDimensions} outerRadius={80}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 8 }} stroke="var(--muted-foreground)" />
                <Radar name="Actuel" dataKey="current" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.3} strokeWidth={2} />
                <Radar name="Objectif" dataKey="target" stroke="var(--chart-2)" fill="var(--chart-2)" fillOpacity={0.1} strokeWidth={2} strokeDasharray="4 4" />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Tooltip content={<ChartTooltipContent />} />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Évolution qualité (12 mois)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <LineChart data={growthData.map((g, i) => ({
                month: g.month,
                qualite: 60 + i * 2 + Math.random() * 3,
                completude: 65 + i * 2.2 + Math.random() * 3,
                geo: 40 + i * 3 + Math.random() * 4,
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
          {qualityDimensions.map((d) => (
            <div key={d.dimension} className="flex items-center gap-3">
              <span className="text-xs w-32 shrink-0">{d.dimension}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full", d.current >= d.target ? "bg-emerald-500" : "bg-orange-500")} style={{ width: `${d.current}%` }} />
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

function PowerBITab() {
  return (
    <div className="space-y-4">
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
            <Database className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">ScrapIQ CI — Power BI Ready</p>
            <p className="text-xs text-muted-foreground">5 tables · 6 mesures DAX · 4 endpoints · Export direct vers Power BI Desktop / Service</p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => toast.success("Dataset .pbi exporté")}>
            <Download className="h-4 w-4" />
            Exporter
          </Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Tables */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Tables disponibles</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {powerBISchema.tables.map((t) => (
              <div key={t.name} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="font-mono text-[10px] bg-primary/5">{t.name}</Badge>
                <span className="text-muted-foreground">{t.rows.toLocaleString("fr-FR")} lignes</span>
                <span className="text-[10px] text-muted-foreground truncate">{t.columns.length} colonnes</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Measures */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Mesures DAX</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {powerBISchema.measures.map((m, i) => (
              <div key={i} className="rounded-md bg-muted/30 p-2 text-[10px] font-mono">
                {m}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Endpoints */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Endpoints d'intégration</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {powerBISchema.endpoints.map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="font-mono text-[10px] bg-emerald-500/5 text-emerald-600">GET</Badge>
              <span className="font-mono text-[10px]">{e}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Instructions */}
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

// Additional imports
import { AlertCircle, CheckCircle2 } from "lucide-react"
