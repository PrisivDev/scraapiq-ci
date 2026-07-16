"use client"

import { useState } from "react"
import { Sidebar, type NavKey } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { KpiCards } from "@/components/dashboard/kpi-cards"
import { Charts } from "@/components/dashboard/charts"
import { SearchPanel, type SearchFilters } from "@/components/dashboard/search-panel"
import { MapView } from "@/components/dashboard/map-view"
import { ResultsTable } from "@/components/dashboard/results-table"
import { CompanyDetailDialog } from "@/components/dashboard/company-detail-dialog"
import { NewJobDialog } from "@/components/dashboard/new-job-dialog"
import { JobsList } from "@/components/dashboard/jobs-list"
import { SourcesList } from "@/components/dashboard/sources-list"
import { Footer } from "@/components/dashboard/footer"
import { companies, type Company } from "@/lib/mock-data"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { FileSpreadsheet, CheckCircle2, Download } from "lucide-react"

export default function Home() {
  const [activeNav, setActiveNav] = useState<NavKey>("dashboard")
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [newJobOpen, setNewJobOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [highlightedId, setHighlightedId] = useState<string | undefined>()

  const handleSelectCompany = (c: Company) => {
    setSelectedCompany(c)
    setHighlightedId(c.id)
    setDetailOpen(true)
  }

  const handleSearch = (filters: SearchFilters) => {
    toast.success("Recherche lancée", {
      description: `${filters.keyword || "Tous mots-clés"} · ${filters.communes.length} commune(s) · ${filters.sources.length} source(s)`,
    })
  }

  const handleExport = () => {
    setExporting(true)
    toast.info("Génération du fichier Excel…", {
      description: `${companies.length} entreprises à exporter`,
    })
    setTimeout(() => {
      setExporting(false)
      toast.success("Export Excel prêt !", {
        description: "Le fichier entreprises_ci.xlsx est disponible.",
        icon: <FileSpreadsheet className="h-4 w-4" />,
        action: {
          label: "Télécharger",
          onClick: () => toast.success("Téléchargement démarré"),
        },
      })
    }, 1800)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar active={activeNav} onSelect={setActiveNav} />

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[260px] p-0">
          <Sidebar
            active={activeNav}
            mobile
            onSelect={(k) => {
              setActiveNav(k)
              setMobileNavOpen(false)
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        <Header
          onNewJob={() => setNewJobOpen(true)}
          onMobileMenu={() => setMobileNavOpen(true)}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 space-y-5 max-w-[1800px] mx-auto">
            {/* Page title */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Tableau de bord
                </h1>
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

            {/* KPIs */}
            <KpiCards />

            {/* Search panel */}
            <SearchPanel onSearch={handleSearch} />

            {/* Charts */}
            <Charts />

            {/* Map + Jobs side by side */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="xl:col-span-2">
                <MapView onSelectCompany={handleSelectCompany} highlightedId={highlightedId} />
              </div>
              <div className="xl:col-span-1">
                <JobsList />
              </div>
            </div>

            {/* Results table */}
            <ResultsTable
              onSelectCompany={handleSelectCompany}
              highlightedId={highlightedId}
              onExport={handleExport}
            />

            {/* Sources */}
            <SourcesList />

            {/* Export banner */}
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
                <Button variant="outline" onClick={handleExport} disabled={exporting} className="gap-2">
                  <Download className="h-4 w-4" />
                  {exporting ? "Génération…" : "CSV"}
                </Button>
                <Button onClick={handleExport} disabled={exporting} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  {exporting ? "Génération…" : "Exporter Excel"}
                </Button>
              </div>
            </div>
          </div>
        </main>

        <Footer />
      </div>

      {/* Dialogs */}
      <CompanyDetailDialog
        company={selectedCompany}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o)
          if (!o) setHighlightedId(undefined)
        }}
      />
      <NewJobDialog open={newJobOpen} onOpenChange={setNewJobOpen} />
    </div>
  )
}
