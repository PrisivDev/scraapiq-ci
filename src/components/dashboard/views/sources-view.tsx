"use client"

import { Database, RefreshCw, MoreVertical, Plus, Activity, CheckCircle2, AlertTriangle, Wrench } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { dataSources } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const statusMeta = {
  active: { label: "Actif", icon: CheckCircle2, className: "bg-primary/10 text-primary border-primary/20" },
  degraded: { label: "Dégradé", icon: AlertTriangle, className: "bg-accent/20 text-accent-foreground border-accent/30" },
  maintenance: { label: "Maintenance", icon: Wrench, className: "bg-muted text-muted-foreground border-border" },
}

export function SourcesView() {
  const totalRecords = dataSources.reduce((sum, s) => sum + s.records, 0)
  const activeCount = dataSources.filter((s) => s.status === "active").length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Sources de données
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {dataSources.length} sources · {activeCount} actives · {totalRecords.toLocaleString("fr-FR")} enregistrements
          </p>
        </div>
        <Button className="gap-2" onClick={() => toast.info("Bientôt disponible : connecteur personnalisé")}>
          <Plus className="h-4 w-4" />
          Connecter une source
        </Button>
      </div>

      {/* Stats résumé */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{dataSources.length}</p>
            <p className="text-xs text-muted-foreground mt-1">Sources totales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-primary">{activeCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Actives</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">{(totalRecords / 1000).toFixed(1)}k</p>
            <p className="text-xs text-muted-foreground mt-1">Enregistrements</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">
              {dataSources.length > 0
                ? (dataSources.reduce((s, x) => s + x.successRate, 0) / dataSources.length).toFixed(1)
                : "—"}
              %
            </p>
            <p className="text-xs text-muted-foreground mt-1">Taux succès moyen</p>
          </CardContent>
        </Card>
      </div>

      {/* Liste détaillée */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {dataSources.map((src) => {
          const meta = statusMeta[src.status]
          const StatusIcon = meta.icon
          return (
            <Card key={src.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-muted text-xl shrink-0">
                    {src.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold truncate">{src.name}</p>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{src.type}</p>
                    <Badge variant="outline" className={cn("text-[10px] mt-1.5 gap-1", meta.className)}>
                      <StatusIcon className="h-2.5 w-2.5" />
                      {meta.label}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Enregistrements</p>
                    <p className="font-semibold">{src.records.toLocaleString("fr-FR")}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Taux de succès</p>
                    <div className="flex items-center gap-2">
                      <Progress value={src.successRate} className="h-1.5 flex-1" />
                      <span className="font-semibold tabular-nums text-[11px]">{src.successRate}%</span>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[10px] text-muted-foreground uppercase">Dernière sync</p>
                    <p className="text-[11px]">{src.lastSync}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8"
                    onClick={() => toast.success(`Synchronisation de ${src.name} lancée`)}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Synchroniser
                  </Button>
                  {src.status === "degraded" && (
                    <Button variant="ghost" size="sm" className="h-8 text-destructive">
                      <Activity className="h-3 w-3 mr-1" />
                      Diagnostiquer
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
