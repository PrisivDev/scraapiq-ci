"use client"

import { useState, useEffect } from "react"
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
import { AssistantView } from "@/components/dashboard/views/assistant-view"
import { IntelligentSearchView } from "@/components/dashboard/views/intelligent-search-view"
import { CompaniesView } from "@/components/dashboard/views/companies-view"
import { OSMMapViewWrapper } from "@/components/dashboard/views/osm-map-wrapper"
import { SourcesView } from "@/components/dashboard/views/sources-view"
import { JobsView } from "@/components/dashboard/views/jobs-view"
import { ScraperView } from "@/components/dashboard/views/scraper-view"
import { ExportEngineView } from "@/components/dashboard/views/export-engine-view"
import { TeamView } from "@/components/dashboard/views/team-view"
import { SettingsView } from "@/components/dashboard/views/settings-view"
import { ApiDocsView } from "@/components/dashboard/views/api-docs-view"
import { NotificationsView } from "@/components/dashboard/views/notifications-view"
import { BackOfficeView } from "@/components/dashboard/views/back-office-view"
import { QueueMonitoringView } from "@/components/dashboard/views/queue-monitoring-view"
import { SecurityView } from "@/components/dashboard/views/security-view"
import { PWAView } from "@/components/dashboard/views/pwa-view"
import { BusinessIntelView } from "@/components/dashboard/views/business-intel-view"
import { SaasView } from "@/components/dashboard/views/saas-view"
import type { SearchFilters } from "@/components/dashboard/search-panel"
import { canAccess, canPerform, type UserRole, DEFAULT_ROLE } from "@/lib/rbac-nav"
import { ShieldX } from "lucide-react"

const navTitles: Record<NavKey, { title: string; subtitle: string }> = {
  dashboard: { title: "Tableau de bord", subtitle: "Vue d'ensemble — Abidjan & Côte d'Ivoire" },
  assistant: { title: "Assistant IA", subtitle: "Recherche en langage naturel" },
  search: { title: "Recherche multicritère", subtitle: "Découvrez des entreprises ivoiriennes" },
  companies: { title: "Entreprises", subtitle: "Toutes les entreprises indexées" },
  map: { title: "Cartographie", subtitle: "Géolocalisation sur Abidjan" },
  sources: { title: "Sources de données", subtitle: "6 sources connectées" },
  jobs: { title: "Jobs de scraping", subtitle: "File d'attente et historique" },
  scraper: { title: "Moteur de scraping", subtitle: "Google Maps · Facebook · LinkedIn · Sites web · IA" },
  exports: { title: "Exports", subtitle: "Historique des exports générés" },
  api: { title: "API REST", subtitle: "v1 · CRUD · Swagger · JWT · Pagination · Filtres · Tri · Recherche · Webhooks" },
  notifications: { title: "Notifications", subtitle: "Multi-canal · Alertes auto · Rapports planifiés" },
  team: { title: "Équipe & tenants", subtitle: "Membres et permissions" },
  backoffice: { title: "Back Office", subtitle: "Administration · Utilisateurs · Abonnements · API · Logs · Audit · Maintenance" },
  queue: { title: "Architecture distribuée", subtitle: "Redis · BullMQ · Workers · Auto-scaling" },
  security: { title: "Centre de sécurité", subtitle: "Rate Limiting · WAF · DDoS · Chiffrement · RGPD · Audit" },
  pwa: { title: "Progressive Web App", subtitle: "Offline · Sync · Notifications · Installation · IndexedDB" },
  bi: { title: "Business Intelligence", subtitle: "Power BI Ready · Prévisions · Secteurs · Croissance · Qualité" },
  saas: { title: "SaaS Enterprise", subtitle: "Licence · Quota · Abonnements · API Keys · Facturation" },
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
  const [userRole, setUserRole] = useState<UserRole>(DEFAULT_ROLE)

  // Fetch le rôle de l'utilisateur connecté
  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.user?.role) {
          setUserRole(d.user.role as UserRole)
        }
      })
      .catch(() => {})
  }, [])

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
    // Vérifie si l'utilisateur a le droit d'accéder à cette section
    if (!canAccess(userRole, key)) {
      toast.error("Accès refusé", {
        description: `Votre rôle (${userRole}) ne permet pas d'accéder à cette section.`,
      })
      return
    }
    setActiveNav(key)
    setMobileNavOpen(false)
    const main = document.querySelector("main")
    if (main) main.scrollTop = 0
  }

  // Navigation depuis la command palette
  const handlePaletteNavigate = (url: string) => {
    const key = url.replace("#", "") as NavKey
    if (["dashboard", "assistant", "search", "companies", "map", "sources", "jobs", "scraper", "exports", "api", "notifications", "team", "backoffice", "queue", "security", "pwa", "bi", "saas", "settings"].includes(key)) {
      handleNavSelect(key as NavKey)
    }
  }

  const currentTitle = navTitles[activeNav]

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar active={activeNav} onSelect={handleNavSelect} userRole={userRole} />

      {/* Mobile sidebar */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[260px] p-0">
          <Sidebar active={activeNav} mobile onSelect={handleNavSelect} userRole={userRole} />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0">
        <DashboardHeader
          onNewJob={canPerform(userRole, "job:create") ? () => setNewJobOpen(true) : undefined}
          onMobileMenu={() => setMobileNavOpen(true)}
          onNavigate={handlePaletteNavigate}
          title={currentTitle.title}
          subtitle={currentTitle.subtitle}
        />

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 space-y-5 max-w-[1800px] mx-auto">
            {/* Protection RBAC : si l'utilisateur n'a pas accès, affiche un message */}
            {!canAccess(userRole, activeNav) ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
                  <ShieldX className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold mb-2">Accès refusé</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Votre rôle ({userRole}) ne vous permet pas d'accéder à cette section.
                  Contactez un administrateur si vous pensez qu'il s'agit d'une erreur.
                </p>
              </div>
            ) : (
              <>
            {activeNav === "dashboard" && (
              <AnalyticsDashboard onNavigate={handlePaletteNavigate} />
            )}

            {activeNav === "assistant" && (
              <AssistantView />
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

            {activeNav === "exports" && <ExportEngineView />}

            {activeNav === "api" && <ApiDocsView />}

            {activeNav === "notifications" && <NotificationsView />}

            {activeNav === "team" && <TeamView />}

            {activeNav === "backoffice" && <BackOfficeView />}

            {activeNav === "queue" && <QueueMonitoringView />}

            {activeNav === "security" && <SecurityView />}

            {activeNav === "pwa" && <PWAView />}

            {activeNav === "bi" && <BusinessIntelView />}

            {activeNav === "saas" && <SaasView />}

            {activeNav === "settings" && <SettingsView />}
              </>
            )}
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
