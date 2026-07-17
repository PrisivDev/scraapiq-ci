"use client"

import { Building2, Activity, Database, GitMerge, Sparkles, Zap, Award, Bell, TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { dashboardKpis, type KpiData } from "@/lib/dashboard-data"

const iconMap: Record<string, React.ElementType> = {
  building: Building2,
  activity: Activity,
  database: Database,
  "git-merge": GitMerge,
  sparkles: Sparkles,
  zap: Zap,
  award: Award,
  bell: Bell,
}

const colorMap: Record<string, { bg: string; text: string; spark: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", spark: "#10b981" },
  orange: { bg: "bg-orange-500/10", text: "text-orange-600 dark:text-orange-400", spark: "#f97316" },
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
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
      {/* Point final */}
      <circle
        cx={width}
        cy={height - ((data[data.length - 1] - min) / range) * height}
        r="2"
        fill={color}
      />
    </svg>
  )
}

export function AnalyticsKpis() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {dashboardKpis.map((kpi) => (
        <KpiCard key={kpi.id} kpi={kpi} />
      ))}
    </div>
  )
}

function KpiCard({ kpi }: { kpi: KpiData }) {
  const Icon = iconMap[kpi.icon] || Building2
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
          <p className="text-2xl font-bold tracking-tight">{kpi.formattedValue}</p>
          <span
            className={cn(
              "flex items-center gap-0.5 text-[11px] font-semibold",
              kpi.trend === "up" && "text-emerald-600 dark:text-emerald-400",
              kpi.trend === "down" && "text-orange-600 dark:text-orange-400",
              kpi.trend === "stable" && "text-muted-foreground"
            )}
          >
            <TrendIcon className="h-3 w-3" />
            {kpi.delta > 0 ? "+" : ""}{kpi.delta}{typeof kpi.value === "number" && kpi.value < 100 ? "%" : ""}
          </span>
        </div>

        <p className="text-xs text-muted-foreground mt-0.5">{kpi.label}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">{kpi.deltaLabel}</p>
      </CardContent>
    </Card>
  )
}
