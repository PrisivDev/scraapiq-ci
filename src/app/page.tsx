"use client"

import { useState, useEffect, type ComponentType } from "react"
import { Footer } from "@/components/dashboard/footer"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { canAccess, canPerform, type UserRole, DEFAULT_ROLE } from "@/lib/rbac-nav"
import type { NavKey } from "@/components/dashboard/sidebar"
import { ShieldX, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Company } from "@/lib/mock-data"

function Loader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  )
}

// Map des loaders — chaque vue n'est chargée QU'au runtime quand l'utilisateur clique
// Pas d'import statique, pas de dynamic() au niveau du module (qui force Turbopack à analyser)
const viewLoaders: Record<NavKey, () => Promise<{ default: ComponentType<any> }>> = {
  dashboard: () => import("@/components/dashboard/analytics/analytics-dashboard").then(m => ({ default: m.AnalyticsDashboard as any })),
  assistant: () => import("@/components/dashboard/views/assistant-view").then(m => ({ default: m.AssistantView as any })),
  search: () => import("@/components/dashboard/views/intelligent-search-view").then(m => ({ default: m.IntelligentSearchView as any })),
  companies: () => import("@/components/dashboard/views/companies-view").then(m => ({ default: m.CompaniesView as any })),
  map: () => import("@/components/dashboard/views/osm-map-wrapper").then(m => ({ default: m.OSMMapViewWrapper as any })),
  sources: () => import("@/components/dashboard/views/sources-view").then(m => ({ default: m.SourcesView as any })),
  jobs: () => import("@/components/dashboard/views/jobs-view").then(m => ({ default: m.JobsView as any })),
  scraper: () => import("@/components/dashboard/views/scraper-view").then(m => ({ default: m.ScraperView as any })),
  exports: () => import("@/components/dashboard/views/export-engine-view").then(m => ({ default: m.ExportEngineView as any })),
  team: () => import("@/components/dashboard/views/team-view").then(m => ({ default: m.TeamView as any })),
  settings: () => import("@/components/dashboard/views/settings-view").then(m => ({ default: m.SettingsView as any })),
  api: () => import("@/components/dashboard/views/api-docs-view").then(m => ({ default: m.ApiDocsView as any })),
  notifications: () => import("@/components/dashboard/views/notifications-view").then(m => ({ default: m.NotificationsView as any })),
  backoffice: () => import("@/components/dashboard/views/back-office-view").then(m => ({ default: m.BackOfficeView as any })),
  queue: () => import("@/components/dashboard/views/queue-monitoring-view").then(m => ({ default: m.QueueMonitoringView as any })),
  security: () => import("@/components/dashboard/views/security-view").then(m => ({ default: m.SecurityView as any })),
  pwa: () => import("@/components/dashboard/views/pwa-view").then(m => ({ default: m.PWAView as any })),
  bi: () => import("@/components/dashboard/views/business-intel-view").then(m => ({ default: m.BusinessIntelView as any })),
  saas: () => import("@/components/dashboard/views/saas-view").then(m => ({ default: m.SaasView as any })),
  agents: () => import("@/components/dashboard/views/agents-view").then(m => ({ default: m.AgentsView as any })),
  db: () => import("@/components/dashboard/views/db-viewer").then(m => ({ default: m.DbViewerView as any })),
}

const componentLoaders = {
  sidebar: () => import("@/components/dashboard/sidebar").then(m => ({ default: m.Sidebar as any })),
  header: () => import("@/components/dashboard/analytics/dashboard-header").then(m => ({ default: m.DashboardHeader as any })),
  companyDialog: () => import("@/components/dashboard/company-detail-dialog").then(m => ({ default: m.CompanyDetailDialog as any })),
  newJobDialog: () => import("@/components/dashboard/new-job-dialog").then(m => ({ default: m.NewJobDialog as any })),
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

function useLazyComponent(loader: () => Promise<{ default: ComponentType<any> }>) {
  const [Comp, setComp] = useState<ComponentType<any> | null>(null)
  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const mod = await loader()
        if (active) setComp(() => mod.default)
      } catch (e) {
        console.error("Lazy load error:", e)
      }
    }
    load()
    return () => { active = false }
  }, [loader])
  return Comp
}

function LazySidebar(props: any) {
  const Comp = useLazyComponent(componentLoaders.sidebar)
  if (!Comp) return <aside className="hidden md:flex w-[260px] border-r bg-sidebar" />
  // eslint-disable-next-line react-hooks/static-components
  return <Comp {...props} />
}

function LazyHeader(props: any) {
  const Comp = useLazyComponent(componentLoaders.header)
  if (!Comp) return <div className="h-16 border-b bg-background" />
  // eslint-disable-next-line react-hooks/static-components
  return <Comp {...props} />
}

function LazyNewJobDialog(props: any) {
  const Comp = useLazyComponent(componentLoaders.newJobDialog)
  if (!Comp) return null
  // eslint-disable-next-line react-hooks/static-components
  return <Comp {...props} />
}

function LazyCompanyDetailDialog(props: any) {
  const Comp = useLazyComponent(componentLoaders.companyDialog)
  if (!Comp) return null
  // eslint-disable-next-line react-hooks/static-components
  return <Comp {...props} />
}

function LazyView({ navKey, props }: { navKey: NavKey; props?: Record<string, unknown> }) {
  const [state, setState] = useState<{ View: ComponentType<any> | null; key: NavKey }>({ View: null, key: navKey })
  useEffect(() => {
    let active = true
    const load = async () => {
      const loader = viewLoaders[navKey]
      if (!loader) return
      try {
        const mod = await loader()
        if (active) setState({ View: mod.default, key: navKey })
      } catch (e) {
        console.error("View load error:", e)
      }
    }
    load()
    return () => { active = false }
  }, [navKey])
  if (state.key !== navKey || !state.View) return <Loader />
  return <state.View {...props} />
}

export default function Home() {
  const [activeNav, setActiveNav] = useState<NavKey>("dashboard")
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [newJobOpen, setNewJobOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [userRole, setUserRole] = useState<UserRole>(DEFAULT_ROLE)

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.user?.role) setUserRole(d.user.role as UserRole) })
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
    toast.success(`Export ${format.toUpperCase()} prêt !`, { description: "Le fichier a été téléchargé." })
  }

  const handlePaletteNavigate = (key: NavKey) => handleNavSelect(key)
  const currentTitle = navTitles[activeNav]

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <LazySidebar active={activeNav} onSelect={handleNavSelect} userRole={userRole} />

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[260px] p-0">
          <LazySidebar active={activeNav} mobile onSelect={handleNavSelect} userRole={userRole} />
        </SheetContent>
      </Sheet>

      <div className="flex flex-col flex-1 min-w-0">
        <LazyHeader
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
              <LazyView navKey={activeNav} props={{
                onNavigate: handlePaletteNavigate,
                onSelectCompany: handleSelectCompany,
                onExport: handleExport,
              }} />
            )}
          </div>
        </main>

        <Footer />
      </div>

      {/* Dialogs */}
      <LazyNewJobDialog open={newJobOpen} onOpenChange={setNewJobOpen} />
      <LazyCompanyDetailDialog
        company={selectedCompany}
        open={detailOpen}
        onOpenChange={(o: boolean) => setDetailOpen(o)}
      />
    </div>
  )
}
