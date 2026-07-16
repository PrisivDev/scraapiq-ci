"use client"

import { useState } from "react"
import { Sidebar, type NavKey } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
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
import { DashboardHome } from "@/components/dashboard/views/dashboard-home"
import { SearchView } from "@/components/dashboard/views/search-view"
import { CompaniesView } from "@/components/dashboard/views/companies-view"
import { MapViewFull } from "@/components/dashboard/views/map-view-full"
import { SourcesView } from "@/components/dashboard/views/sources-view"
import { JobsView } from "@/components/dashboard/views/jobs-view"
import { ExportsView } from "@/components/dashboard/views/exports-view"
import { TeamView } from "@/components/dashboard/views/team-view"
import { SettingsView } from "@/components/dashboard/views/settings-view"
import type { SearchFilters } from "@/components/dashboard/search-panel"

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
    // Scroll en haut lors du changement de vue
    const main = document.querySelector("main")
    if (main) main.scrollTop = 0
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar active={activeNav} onSelect={handleNavSelect} />

      {/* Mobile sidebar (Sheet) */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[260px] p-0">
          <Sidebar active={activeNav} mobile onSelect={handleNavSelect} />
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
            {activeNav === "dashboard" && (
              <DashboardHome
                onSelectCompany={handleSelectCompany}
                highlightedId={highlightedId}
                onExport={handleExport}
                exporting={exporting}
                onSearch={handleSearch}
              />
            )}

            {activeNav === "search" && (
              <SearchView onSearch={handleSearch} />
            )}

            {activeNav === "companies" && (
              <CompaniesView
                onSelectCompany={handleSelectCompany}
                onExport={handleExport}
              />
            )}

            {activeNav === "map" && (
              <MapViewFull
                onSelectCompany={handleSelectCompany}
                highlightedId={highlightedId}
              />
            )}

            {activeNav === "sources" && <SourcesView />}

            {activeNav === "jobs" && <JobsView />}

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
