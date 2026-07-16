"use client"

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { scrapingTrend, sectorDistribution, communeDistribution, dedupStats } from "@/lib/mock-data"
import { GitMerge, MapPin, TrendingUp, PieChart as PieIcon } from "lucide-react"

const trendConfig = {
  google: { label: "Google Maps", color: "var(--chart-1)" },
  annuaire: { label: "Annuaires", color: "var(--chart-2)" },
  social: { label: "Réseaux sociaux", color: "var(--chart-3)" },
} satisfies ChartConfig

const sectorConfig = {
  value: { label: "Entreprises" },
} satisfies ChartConfig

export function Charts() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Trend chart */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Volume de scraping (7 derniers jours)</CardTitle>
              <CardDescription className="text-xs">
                Évolution par type de source
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <ChartContainer config={trendConfig} className="h-[240px] w-full">
            <AreaChart data={scrapingTrend} margin={{ left: -16, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="gGoogle" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gAnnuaire" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gSocial" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                stroke="var(--muted-foreground)"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11 }}
                stroke="var(--muted-foreground)"
              />
              <Tooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="google"
                stroke="var(--chart-1)"
                fill="url(#gGoogle)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="annuaire"
                stroke="var(--chart-2)"
                fill="url(#gAnnuaire)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="social"
                stroke="var(--chart-3)"
                fill="url(#gSocial)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Sector distribution */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
              <PieIcon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Répartition par secteur</CardTitle>
              <CardDescription className="text-xs">Top secteurs d'activité</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <ChartContainer config={sectorConfig} className="h-[240px] w-full">
            <PieChart>
              <Pie
                data={sectorDistribution}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={2}
              >
                {sectorDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-md">
                        <p className="text-xs font-medium">{payload[0].name}</p>
                        <p className="text-xs text-muted-foreground">
                          {payload[0].value?.toLocaleString("fr-FR")} entreprises
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

      {/* Commune distribution */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Densité par commune (Abidjan)</CardTitle>
              <CardDescription className="text-xs">
                Nombre d'entreprises indexées
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <ChartContainer config={{ entreprises: { label: "Entreprises" } }} className="h-[220px] w-full">
            <BarChart data={communeDistribution} margin={{ left: -16, right: 8, top: 8 }}>
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
                tick={{ fontSize: 11 }}
                stroke="var(--muted-foreground)"
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                content={<ChartTooltipContent />}
              />
              <Bar dataKey="entreprises" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Dedup stats card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
              <GitMerge className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base">Déduplication IA</CardTitle>
              <CardDescription className="text-xs">Cycle en cours</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-2xl font-bold">{dedupStats.merged.toLocaleString("fr-FR")}</p>
              <p className="text-[11px] text-muted-foreground">entités uniques conservées</p>
            </div>
            <span className="text-xs font-semibold text-primary">{dedupStats.rate}%</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Brutes collectées</span>
              <span className="font-medium">{dedupStats.total.toLocaleString("fr-FR")}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">Doublons détectés</span>
              <span className="font-medium text-destructive">
                {dedupStats.duplicates.toLocaleString("fr-FR")}
              </span>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
              style={{ width: `${100 - dedupStats.rate}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Embeddings pgvector + LLM z-ai pour la résolution d'entités
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
