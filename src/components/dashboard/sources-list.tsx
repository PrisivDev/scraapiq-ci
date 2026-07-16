"use client"

import { Database, MoreVertical, RefreshCw } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { dataSources } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const statusMeta = {
  active: { label: "Actif", className: "bg-primary/10 text-primary border-primary/20" },
  degraded: { label: "Dégradé", className: "bg-accent/20 text-accent-foreground border-accent/30" },
  maintenance: { label: "Maintenance", className: "bg-muted text-muted-foreground border-border" },
}

export function SourcesList() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Sources connectées</CardTitle>
              <CardDescription className="text-xs">
                6 sources actives · 143 k enregistrements
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[400px] overflow-y-auto">
          {dataSources.map((src) => {
            const meta = statusMeta[src.status]
            return (
              <div
                key={src.id}
                className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-muted/40 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
                  {src.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{src.name}</p>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0", meta.className)}>
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{src.type}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      {src.records.toLocaleString("fr-FR")} enr.
                    </span>
                    <div className="flex items-center gap-1.5 flex-1 max-w-[120px]">
                      <Progress
                        value={src.successRate}
                        className="h-1"
                      />
                      <span className="text-[10px] font-medium tabular-nums">
                        {src.successRate}%
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Sync : {src.lastSync}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
