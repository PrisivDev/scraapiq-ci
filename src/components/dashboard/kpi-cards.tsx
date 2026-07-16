"use client"

import {
  Building2,
  Activity,
  Database,
  GitMerge,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { kpis } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const items = [
  {
    label: "Entreprises indexées",
    value: kpis.totalCompanies.toLocaleString("fr-FR"),
    delta: "+12,4 %",
    trend: "up" as const,
    icon: Building2,
    hint: "vs. mois dernier",
  },
  {
    label: "Jobs de scraping actifs",
    value: String(kpis.activeJobs),
    delta: "+3",
    trend: "up" as const,
    icon: Activity,
    hint: "2 en cours, 10 en file",
  },
  {
    label: "Sources connectées",
    value: String(kpis.activeSources),
    delta: "5/6 OK",
    trend: "up" as const,
    icon: Database,
    hint: "LinkedIn en maintenance",
  },
  {
    label: "Taux de déduplication",
    value: `${kpis.dedupRate}%`,
    delta: "-1,2 %",
    trend: "down" as const,
    icon: GitMerge,
    hint: "8 421 doublons ce mois",
  },
  {
    label: "Taux d'enrichissement",
    value: `${kpis.enrichmentRate}%`,
    delta: "+4,8 %",
    trend: "up" as const,
    icon: Sparkles,
    hint: "par moteur IA",
  },
  {
    label: "Appels API (30 j)",
    value: (kpis.apiCalls / 1000).toFixed(1) + " k",
    delta: "+18,9 %",
    trend: "up" as const,
    icon: TrendingUp,
    hint: "68 % du quota utilisé",
  },
]

export function KpiCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {items.map((item) => {
        const Icon = item.icon
        const TrendIcon = item.trend === "up" ? TrendingUp : TrendingDown
        return (
          <Card key={item.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <span
                  className={cn(
                    "flex items-center gap-0.5 text-[11px] font-semibold",
                    item.trend === "up" ? "text-primary" : "text-destructive"
                  )}
                >
                  <TrendIcon className="h-3 w-3" />
                  {item.delta}
                </span>
              </div>
              <p className="text-2xl font-bold tracking-tight">{item.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">{item.hint}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
