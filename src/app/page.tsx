"use client"

import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { Footer } from "@/components/dashboard/footer"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { canAccess, canPerform, type UserRole, DEFAULT_ROLE } from "@/lib/rbac-nav"
import type { NavKey } from "@/components/dashboard/sidebar"
import { ShieldX, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Company } from "@/lib/mock-data"

// Tous les composants en lazy loading pour éviter l'OOM
const Sidebar = dynamic(() => import("@/components/dashboard/sidebar").then(m => ({ default: m.Sidebar })), {
  ssr: false,
  loading: () => <aside className="hidden md:flex w-[260px] border-r bg-sidebar" />,
})

const DashboardHeader = dynamic(() => import("@/components/dashboard/analytics/dashboard-header").then(m => ({ default: m.DashboardHeader })), {
  ssr: false,
  loading: () => <div className="h-16 border-b bg-background" />,
})

const CompanyDetailDialog = dynamic(() => import("@/components/dashboard/company-detail-dialog").then(m => ({ default: m.CompanyDetailDialog })), { ssr: false })
const NewJobDialog = dynamic(() => import("@/components/dashboard/new-job-dialog").then(m => ({ default: m.NewJobDialog })), { ssr: false })

const views: Record<NavKey, React.ComponentType<any>> = {
  dashboard: dynamic(() => import("@/components/dashboard/analytics/analytics-dashboard").then(m => ({ default: m.AnalyticsDashboard })), { ssr: false, loading: () => <Loader /> }),
  assistant: dynamic(() => import("@/components/dashboard/views/assistant-view").then(m => ({ default: m.AssistantView })), { ssr: false, loading: () => <Loader /> }),
  search: dynamic(() => import("@/components/dashboard/views/intelligent-search-view").then(m => ({ default: m.IntelligentSearchView })), { ssr: false, loading: () => <Loader /> }),
  companies: dynamic(() => import("@/components/dashboard/views/companies-view").then(m => ({ default: m.CompaniesView })), { ssr: false, loading: () => <Loader /> }),
  map: dynamic(() => import("@/components/dashboard/views/osm-map-wrapper").then(m => ({ default: m.OSMMapViewWrapper })), { ssr: false, loading: () => <Loader /> }),
  sources: dynamic(() => import("@/components/dashboard/views/sources-view").then(m => ({ default: m.SourcesView })), { ssr: false, loading: () => <Loader /> }),
  jobs: dynamic(() => import("@/components/dashboard/views/jobs-view").then(m => ({ default: m.JobsView })), { ssr: false, loading: () => <Loader /> }),
  scraper: dynamic(() => import("@/components/dashboard/views/scraper-view").then(m => ({ default: m.ScraperView })), { ssr: false, loading: () => <Loader /> }),
  exports: dynamic(() => import("@/components/dashboard/views/export-engine-view").then(m => ({ default: m.ExportEngineView })), { ssr: false, loading: () => <Loader /> }),
  team: dynamic(() => import("@/components/dashboard/views/team-view").then(m => ({ default: m.TeamView })), { ssr: false, loading: () => <Loader /> }),
  settings: dynamic(() => import("@/components/dashboard/views/settings-view").then(m => ({ default: m.SettingsView })), { ssr: false, loading: () => <Loader /> }),
  api: dynamic(() => import("@/components/dashboard/views/api-docs-view").then(m => ({ default: m.ApiDocsView })), { ssr: false, loading: () => <Loader /> }),
  notifications: dynamic(() => import("@/components/dashboard/views/notifications-view").then(m => ({ default: m.NotificationsView })), { ssr: false, loading: () => <Loader /> }),
  backoffice: dynamic(() => import("@/components/dashboard/views/back-office-view").then(m => ({ default: m.BackOfficeView })), { ssr: false, loading: () => <Loader /> }),
  queue: dynamic(() => import("@/components/dashboard/views/queue-monitoring-view").then(m => ({ default: m.QueueMonitoringView })), { ssr: false, loading: () => <Loader /> }),
  security: dynamic(() => import("@/components/dashboard/views/security-view").then(m => ({ default: m.SecurityView })), { ssr: false, loading: () => <Loader /> }),
  pwa: dynamic(() => import("@/components/dashboard/views/pwa-view").then(m => ({ default: m.PWAView })), { ssr: false, loading: () => <Loader /> }),
  bi: dynamic(() => import("@/components/dashboard/views/business-intel-view").then(m => ({ default: m.BusinessIntelView })), { ssr: false, loading: () => <Loader /> }),
  saas: dynamic(() => import("@/components/dashboard/views/saas-view").then(m => ({ default: m.SaasView })), { ssr: false, loading: () => <Loader /> }),
  agents: dynamic(() => import("@/components/dashboard/views/agents-view").then(m => ({ default: m.AgentsView })), { ssr: false, loading: () => <Loader /> }),
  db: dynamic(() => import("@/components/dashboard/views/db-viewer").then(m => ({ default: m.DbViewerView })), { ssr: false, loading: () => <Loader /> }),
}

function Loader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  )
}

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
  api: { title: "API REST", subtitle: "v1 · CRUD · Swagger · JWT · Pagination" },
  notifications: { title: "Notifications", subtitle: "Multi-canal · Alertes auto · Rapports planifiés" },
  team: { title: "Équipe & tenants", subtitle: "Membres et permissions" },
  backoffice: { title: "Back Office", subtitle: "Administration" },
  queue: { title: "Architecture distribuée", subtitle: "Redis · BullMQ · Workers" },
  security: { title: "Centre de sécurité", subtitle: "Rate Limiting · WAF · DDoS · Chiffrement · RGPD" },
  pwa: { title: "Progressive Web App", subtitle: "Offline · Sync · Notifications" },
  bi: { title: "Business Intelligence", subtitle: "Power BI Ready · Prévisions · Secteurs" },
  saas: { title: "SaaS Enterprise", subtitle: "Licence · Quota · Abonnements · API Keys" },
  agents: { title: "IA Multi-Agents", subtitle: "10 agents spécialisés" },
  db: { title: "Base de données", subtitle: "Inspector Prisma · OWNER uniquement" },
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

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.user?.role) setUserRole(d.user.role as UserRole)
      })
      .catch(() => {})
  }, [])

  const handleNavSelect = (key: NavKey) => {
    setActiveNav(key)
    setMobileNavOpen(false)
    if (typeof window !== "undefined") window.scrollTo(0, 0)
  }

  const handleSelectCompany = (company: Company) => {
    setSelectedCompany(company)
    setDetailOpen(true)
  }

  const handleExport = async (format: string) => {
    setExporting(true)
    await new Promise((r) => setTimeout(r, 1200))
    setExporting(false)
    toast.success(`Export ${format.toUpperCase()} prêt !`, {
      description: "Le fichier a été téléchargé.",
    })
  }

  const handlePaletteNavigate = (key: NavKey) => {
    handleNavSelect(key)
  }

  const currentTitle = navTitles[activeNav]
  const ActiveView = views[activeNav] || views.dashboard

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar active={activeNav} onSelect={handleNavSelect} userRole={userRole} />

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[260px] p-0">
          <Sidebar active={activeNav} mobile onSelect={handleNavSelect} userRole={userRole} />
        </SheetContent>
      </Sheet>

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
            {!canAccess(userRole, activeNav) ? (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-4">
                  <ShieldX className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold mb-2">Accès refusé</h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Votre rôle ({userRole}) ne vous permet pas d&apos;accéder à cette section.
                </p>
              </div>
            ) : (
              <ActiveView
                onNavigate={handlePaletteNavigate}
                onSelectCompany={handleSelectCompany}
                onExport={handleExport}
              />
            )}
          </div>
        </main>

        <Footer />
      </div>

      <CompanyDetailDialog
        company={selectedCompany}
        open={detailOpen}
        onOpenChange={(o: boolean) => {
          setDetailOpen(o)
          if (!o) setHighlightedId(undefined)
        }}
      />
      <NewJobDialog open={newJobOpen} onOpenChange={setNewJobOpen} />
    </div>
  )
}
