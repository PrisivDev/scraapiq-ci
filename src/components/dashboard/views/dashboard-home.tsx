"use client"

import { KpiCards } from "@/components/dashboard/kpi-cards"
import { Charts } from "@/components/dashboard/charts"
import { SearchPanel, type SearchFilters } from "@/components/dashboard/search-panel"
import { MapView } from "@/components/dashboard/map-view"
import { ResultsTable } from "@/components/dashboard/results-table"
import { JobsList } from "@/components/dashboard/jobs-list"
import { SourcesList } from "@/components/dashboard/sources-list"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, CheckCircle2, Download } from "lucide-react"
import { companies, type Company } from "@/lib/mock-data"
import { toast } from "sonner"

interface DashboardHomeProps {
  onSelectCompany: (c: Company) => void
  highlightedId?: string
  onExport: () => void
  exporting: boolean
  onSearch: (filters: SearchFilters) => void
}

export function DashboardHome({
  onSelectCompany,
  highlightedId,
  onExport,
  exporting,
  onSearch,
}: DashboardHomeProps) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Vue d'ensemble de l'activité de scraping et d'enrichissement — Abidjan & Côte d'Ivoire
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium">Système opérationnel</span>
          </div>
        </div>
      </div>

      <KpiCards />

      <SearchPanel onSearch={onSearch} />

      <Charts />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <MapView onSelectCompany={onSelectCompany} highlightedId={highlightedId} />
        </div>
        <div className="xl:col-span-1">
          <JobsList />
        </div>
      </div>

      <ResultsTable
        onSelectCompany={onSelectCompany}
        highlightedId={highlightedId}
        onExport={onExport}
      />

      <SourcesList />

      <div className="rounded-xl border bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">Export Enterprise</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Exportez l'ensemble de vos entreprises en Excel, CSV, JSON ou via l'API REST.
            Format adapté à Excel, Google Sheets et aux CRM (Salesforce, HubSpot).
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-primary" /> Champs normalisés (+225)
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-primary" /> Coordonnées complètes
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-primary" /> Géolocalisation incluse
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-primary" /> Multi-format
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onExport} disabled={exporting} className="gap-2">
            <Download className="h-4 w-4" />
            {exporting ? "Génération…" : "CSV"}
          </Button>
          <Button onClick={onExport} disabled={exporting} className="gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            {exporting ? "Génération…" : "Exporter Excel"}
          </Button>
        </div>
      </div>
    </>
  )
}
