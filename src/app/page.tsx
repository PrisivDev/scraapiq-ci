"use client"

import { useState } from "react"
import { Sidebar, type NavKey } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/analytics/dashboard-header"
import { CompanyDetailDialog } from "@/components/dashboard/company-detail-dialog"
import { NewJobDialog } from "@/components/dashboard/new-job-dialog"
import { Footer } from "@/components/dashboard/footer"
import { companies, type Company } from "@/lib/mock-data"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet"

// Views
import { AnalyticsDashboard } from "@/components/dashboard/analytics/analytics-dashboard"
import { IntelligentSearchView } from "@/components/dashboard/views/intelligent-search-view"
import { CompaniesView } from "@/components/dashboard/views/companies-view"
import { OSMMapViewWrapper } from "@/components/dashboard/views/osm-map-wrapper"
import { SourcesView } from "@/components/dashboard/views/sources-view"
import { JobsView } from "@/components/dashboard/views/jobs-view"
import { ScraperView } from "@/components/dashboard/views/scraper-view"
import { ExportsView } from "@/components/dashboard/views/exports-view"
import { TeamView } from "@/components/dashboard/views/team-view"
import { SettingsView } from "@/components/dashboard/views/settings-view"
import type { SearchFilters } from "@/components/dashboard/search-panel"

const navTitles: Record<NavKey, { title: string; subtitle: string }> = {
  dashboard: { title: "Tableau de bord", subtitle: "Vue d'ensemble — Abidjan & Côte d'Ivoire" },
  search: { title: "Recherche multicritère", subtitle: "Découvrez des entreprises ivoiriennes" },
  companies: { title: "Entreprises", subtitle: "Toutes les entreprises indexées" },
  map: { title: "Cartographie", subtitle: "Géolocalisation sur Abidjan" },
  sources: { title: "Sources de données", subtitle: "6 sources connectées" },
  jobs: { title: "Jobs de scraping", subtitle: "File d'attente et historique" },
  scraper: { title: "Moteur de scraping", subtitle: "Google Maps · Facebook · LinkedIn · Sites web · IA" },
  exports: { title: "Exports", subtitle: "Historique des exports générés" },
  team: { title: "Équipe & tenants", subtitle: "Membres et permissions" },
  settings: { title: "Paramètres", subtitle: "Profil, sécurité, facturation" },
}

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
      })
    }, 1800)
  }

  const handleNavSelect = (key: NavKey) => {
    setActiveNav(key)
    setMobileNavOpen(false)
    const main = document.querySelector("main")
    if (main) main.scrollTop = 0
  }

  // Navigation depuis la command palette
  const handlePaletteNavigate = (url: string) => {
    const key = url.replace("#", "") as NavKey
    if (["dashboard", "search", "companies", "map", "sources", "jobs", "scraper", "exports", "team", "settings"].includes(key)) {
      handleNavSelect(key as NavKey)
    }
  }

  const currentTitle = navTitles[activeNav]

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar active={activeNav} onSelect={handleNavSelect} />

      {/* Mobile sidebar */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[260px] p-0">
          <Sidebar active={activeNav} mobile onSelect={handleNavSelect} />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        <DashboardHeader
          onNewJob={() => setNewJobOpen(true)}
          onMobileMenu={() => setMobileNavOpen(true)}
          onNavigate={handlePaletteNavigate}
          title={currentTitle.title}
          subtitle={currentTitle.subtitle}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 space-y-5 max-w-[1800px] mx-auto">
            {activeNav === "dashboard" && (
              <AnalyticsDashboard onNavigate={handlePaletteNavigate} />
            )}

            {activeNav === "search" && (
              <IntelligentSearchView />
            )}

            {activeNav === "companies" && (
              <CompaniesView
                onSelectCompany={handleSelectCompany}
                onExport={handleExport}
              />
            )}

            {activeNav === "map" && (
              <OSMMapViewWrapper />
            )}

            {activeNav === "sources" && <SourcesView />}

            {activeNav === "jobs" && <JobsView />}

            {activeNav === "scraper" && <ScraperView />}

            {activeNav === "exports" && <ExportsView />}

            {activeNav === "team" && <TeamView />}

            {activeNav === "settings" && <SettingsView />}
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
