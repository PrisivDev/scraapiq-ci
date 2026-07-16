"use client"

import { Activity, Clock, User, CheckCircle2, Loader2, Pause, XCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { scrapingJobs, type JobStatus } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const statusMeta: Record<
  JobStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  running: { label: "En cours", icon: Loader2, className: "bg-primary/10 text-primary border-primary/20" },
  completed: { label: "Terminé", icon: CheckCircle2, className: "bg-accent/20 text-accent-foreground border-accent/30" },
  queued: { label: "En file", icon: Pause, className: "bg-muted text-muted-foreground border-border" },
  failed: { label: "Échec", icon: XCircle, className: "bg-destructive/10 text-destructive border-destructive/20" },
}

export function JobsList() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Jobs de scraping récents</CardTitle>
              <CardDescription className="text-xs">
                Suivi en temps réel du pipeline
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm" className="h-8">
            Voir tout
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[400px] overflow-y-auto">
          {scrapingJobs.map((job) => {
            const meta = statusMeta[job.status]
            const StatusIcon = meta.icon
            return (
              <div
                key={job.id}
                className="flex items-start gap-3 p-3 border-b last:border-b-0 hover:bg-muted/40 transition-colors"
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                    meta.className
                  )}
                >
                  <StatusIcon
                    className={cn(
                      "h-4 w-4",
                      job.status === "running" && "animate-spin"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{job.keyword}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">{job.id}</p>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0", meta.className)}>
                      {meta.label}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-1.5">
                    {job.sources.slice(0, 3).map((s) => (
                      <span key={s} className="text-[10px] text-muted-foreground">
                        {s}
                      </span>
                    ))}
                    {job.sources.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{job.sources.length - 3}
                      </span>
                    )}
                  </div>

                  {job.status === "running" && (
                    <div className="mt-2">
                      <Progress value={job.progress} className="h-1.5" />
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {job.results} résultats
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {job.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {job.user}
                    </span>
                    <span className="ml-auto">{job.createdAt}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
