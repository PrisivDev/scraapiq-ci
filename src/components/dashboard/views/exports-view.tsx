"use client"

import { Download, FileSpreadsheet, FileText, FileJson, Plus, Clock, CheckCircle2, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface ExportRecord {
  id: string
  filename: string
  format: "xlsx" | "csv" | "json"
  rows: number
  size: string
  status: "completed" | "processing" | "failed"
  createdAt: string
  createdBy: string
}

const mockExports: ExportRecord[] = [
  { id: "exp-001", filename: "entreprises_ci_dec2026.xlsx", format: "xlsx", rows: 12384, size: "2.4 Mo", status: "completed", createdAt: "Il y a 5 min", createdBy: "A. Koné" },
  { id: "exp-002", filename: "pharma_cocody.csv", format: "csv", rows: 284, size: "85 Ko", status: "completed", createdAt: "Hier", createdBy: "M. Traoré" },
  { id: "exp-003", filename: "banques_abidjan.json", format: "json", rows: 156, size: "120 Ko", status: "completed", createdAt: "Il y a 2 j", createdBy: "A. Koné" },
  { id: "exp-004", filename: "btp_yopougon.xlsx", format: "xlsx", rows: 89, size: "45 Ko", status: "processing", createdAt: "En cours", createdBy: "S. Bamba" },
  { id: "exp-005", filename: "hotels_sanpedro.xlsx", format: "xlsx", rows: 0, size: "-", status: "failed", createdAt: "Il y a 5 j", createdBy: "S. Bamba" },
]

const formatMeta = {
  xlsx: { icon: FileSpreadsheet, label: "Excel", className: "bg-primary/10 text-primary" },
  csv: { icon: FileText, label: "CSV", className: "bg-accent/20 text-accent-foreground" },
  json: { icon: FileJson, label: "JSON", className: "bg-muted text-muted-foreground" },
}

export function ExportsView() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Download className="h-6 w-6 text-primary" />
            Exports
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {mockExports.length} exports · {mockExports.filter((e) => e.status === "completed").length} disponibles
          </p>
        </div>
        <Button className="gap-2" onClick={() => toast.info("Ouvrir la modale de création d'export")}>
          <Plus className="h-4 w-4" />
          Nouvel export
        </Button>
      </div>

      {/* Stats quota */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">68 / 100</p>
            <p className="text-xs text-muted-foreground mt-1">Exports ce mois</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">2.7 Go</p>
            <p className="text-xs text-muted-foreground mt-1">Volume total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold">12 829</p>
            <p className="text-xs text-muted-foreground mt-1">Lignes exportées</p>
          </CardContent>
        </Card>
      </div>

      {/* Liste exports */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Exports récents</CardTitle>
          <CardDescription className="text-xs">Téléchargez vos fichiers ou régénérez-les</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {mockExports.map((exp) => {
              const meta = formatMeta[exp.format]
              const Icon = meta.icon
              return (
                <div key={exp.id} className="flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 ${meta.className}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{exp.filename}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                      <span>{exp.rows.toLocaleString("fr-FR")} lignes</span>
                      <span>·</span>
                      <span>{exp.size}</span>
                      <span>·</span>
                      <span>{exp.createdBy}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {exp.createdAt}
                      </span>
                    </div>
                  </div>
                  {exp.status === "completed" && (
                    <>
                      <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/20">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Prêt
                      </Badge>
                      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => toast.success(`Téléchargement de ${exp.filename}`)}>
                        <Download className="h-3.5 w-3.5" />
                        Télécharger
                      </Button>
                    </>
                  )}
                  {exp.status === "processing" && (
                    <>
                      <Badge variant="outline" className="text-[10px] gap-1 bg-accent/20 text-accent-foreground">
                        <Loader2 className="h-2.5 w-2.5 animate-spin" />
                        Génération
                      </Badge>
                      <Button variant="ghost" size="sm" disabled className="h-8">
                        En cours…
                      </Button>
                    </>
                  )}
                  {exp.status === "failed" && (
                    <>
                      <Badge variant="outline" className="text-[10px] gap-1 bg-destructive/10 text-destructive">
                        Échec
                      </Badge>
                      <Button variant="outline" size="sm" className="h-8" onClick={() => toast.info("Relance programmée")}>
                        Régénérer
                      </Button>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
