"use client"

import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ChartContainer, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react"
import {
  scrapingTimeseries30d, sectorDistribution, communeDistribution,
  qualityRadar, qualityEvolution, sourcePerformance,
} from "@/lib/dashboard-data"
import { TrendingUp, PieChart as PieIcon, MapPin, Radar as RadarIcon, Activity, BarChart3 } from "lucide-react"

const trendConfig = {
  google: { label: "Google Maps", color: "var(--chart-1)" },
  facebook: { label: "Facebook", color: "var(--chart-2)" },
  linkedin: { label: "LinkedIn", color: "var(--chart-3)" },
  website: { label: "Sites web", color: "var(--chart-4)" },
} satisfies ChartConfig

const qualityConfig = {
  current: { label: "Mois courant", color: "var(--chart-1)" },
  previous: { label: "Mois précédent", color: "var(--chart-4)" },
} satisfies ChartConfig

export function AnalyticsCharts() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d">("30d")

  return (
    <div className="space-y-4">
      {/* Row 1: Volume scraping (large) + Secteurs (small) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Volume de scraping */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Volume de scraping</CardTitle>
                  <CardDescription className="text-xs">Par source · 30 derniers jours</CardDescription>
                </div>
              </div>
              <Tabs value={timeRange} onValueChange={(v) => setTimeRange(v as "7d" | "30d")}>
                <TabsList className="h-7">
                  <TabsTrigger value="7d" className="text-[11px] px-2 h-5">7j</TabsTrigger>
                  <TabsTrigger value="30d" className="text-[11px] px-2 h-5">30j</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <ChartContainer config={trendConfig} className="h-[260px] w-full">
              <AreaChart data={scrapingTimeseries30d} margin={{ left: -12, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gGoogle" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gFb" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gLi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gWs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-4)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--chart-4)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="dateLabel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                  stroke="var(--muted-foreground)"
                  interval={4}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="google" stroke="var(--chart-1)" fill="url(#gGoogle)" strokeWidth={2} />
                <Area type="monotone" dataKey="facebook" stroke="var(--chart-2)" fill="url(#gFb)" strokeWidth={2} />
                <Area type="monotone" dataKey="linkedin" stroke="var(--chart-3)" fill="url(#gLi)" strokeWidth={2} />
                <Area type="monotone" dataKey="website" stroke="var(--chart-4)" fill="url(#gWs)" strokeWidth={2} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Répartition par secteur */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
                <PieIcon className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Par secteur</CardTitle>
                <CardDescription className="text-xs">8 secteurs principaux</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <ChartContainer config={{ value: { label: "Entreprises" } }} className="h-[260px] w-full">
              <PieChart>
                <Pie
                  data={sectorDistribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {sectorDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload?.length) {
                      const p = payload[0].payload as typeof sectorDistribution[0]
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-md">
                          <p className="text-xs font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.value.toLocaleString("fr-FR")} ({p.percentage}%)
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 10, marginTop: 4 }}
                />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Communes (bar) + Radar qualité */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Densité par commune (Abidjan)</CardTitle>
                <CardDescription className="text-xs">Entreprises indexées + croissance</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <ChartContainer config={{ entreprises: { label: "Entreprises" } }} className="h-[240px] w-full">
              <BarChart data={communeDistribution} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="commune"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                  stroke="var(--muted-foreground)"
                  angle={-20}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                  stroke="var(--muted-foreground)"
                />
                <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
                <Bar dataKey="entreprises" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Radar qualité */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
                <RadarIcon className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Qualité des données</CardTitle>
                <CardDescription className="text-xs">7 dimensions · vs mois prec.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <ChartContainer config={qualityConfig} className="h-[240px] w-full">
              <RadarChart data={qualityRadar} outerRadius={75}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" />
                <Radar name="current" dataKey="current" stroke="var(--chart-1)" fill="var(--chart-1)" fillOpacity={0.4} strokeWidth={2} />
                <Radar name="previous" dataKey="previous" stroke="var(--chart-4)" fill="var(--chart-4)" fillOpacity={0.2} strokeWidth={2} strokeDasharray="4 4" />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip content={<ChartTooltipContent />} />
              </RadarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Évolution qualité (line) + Performance sources (bar horizontal) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Évolution des scores qualité</CardTitle>
                <CardDescription className="text-xs">12 derniers mois</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <ChartContainer
              config={{
                overall: { label: "Global", color: "var(--chart-1)" },
                completeness: { label: "Complétude", color: "var(--chart-2)" },
                contactValidity: { label: "Contacts", color: "var(--chart-3)" },
                geoAccuracy: { label: "Géoloc", color: "var(--chart-4)" },
              }}
              className="h-[240px] w-full"
            >
              <LineChart data={qualityEvolution} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" domain={[0, 100]} />
                <Tooltip content={<ChartTooltipContent />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="overall" stroke="var(--chart-1)" strokeWidth={3} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="completeness" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="contactValidity" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="geoAccuracy" stroke="var(--chart-4)" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Performance des sources</CardTitle>
                <CardDescription className="text-xs">Taux de succès · temps moyen</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <ChartContainer
              config={{ success: { label: "Taux de succès (%)" } }}
              className="h-[240px] w-full"
            >
              <BarChart data={sourcePerformance} layout="vertical" margin={{ left: 80, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis type="category" dataKey="source" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={80} />
                <Tooltip cursor={{ fill: "var(--muted)" }} content={<ChartTooltipContent />} />
                <Bar dataKey="success" radius={[0, 4, 4, 0]}>
                  {sourcePerformance.map((s, i) => (
                    <Cell key={i} fill={s.success >= 95 ? "var(--chart-1)" : s.success >= 85 ? "var(--chart-2)" : "var(--chart-5)"} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
