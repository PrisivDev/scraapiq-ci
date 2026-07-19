"use client"

import { useState, useCallback, useEffect } from "react"
import { Search, Bell, Plus, Sun, Moon, Menu, Building2, ChevronDown, Zap, Command, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { UserMenu } from "@/components/auth/user-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "next-themes"
import { CommandPalette } from "./command-palette"
import { dashboardAlerts } from "@/lib/dashboard-data"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { OrganizationDetailsDialog } from "@/components/dashboard/organization-details-dialog"

interface DashboardHeaderProps {
  onNewJob?: () => void
  onMobileMenu?: () => void
  onNavigate?: (url: string) => void
  title?: string
  subtitle?: string
}

export function DashboardHeader({ onNewJob, onMobileMenu, onNavigate, title, subtitle }: DashboardHeaderProps) {
  const { theme, setTheme } = useTheme()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [orgDetailsOpen, setOrgDetailsOpen] = useState(false)
  const activeAlerts = dashboardAlerts.filter((a) => a.status === "active")

  // Récupère le nom réel de l'organisation depuis /api/me
  // (mock "AgriBusiness CI" / "Pharma Distribution" / "BTP Express" supprimé)
  const [organizationName, setOrganizationName] = useState<string>("...")
  const [allOrgs, setAllOrgs] = useState<string[]>([])
  useEffect(() => {
    let mounted = true
    fetch("/api/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!mounted || !d?.user?.memberships) return
        const orgs = d.user.memberships
          .map((m: { organization?: { name?: string } }) => m.organization?.name)
          .filter((n: string | undefined): n is string => Boolean(n))
        setAllOrgs(orgs)
        setOrganizationName(orgs[0] || "Mon organisation")
      })
      .catch(() => {
        if (mounted) setOrganizationName("Mon organisation")
      })
    return () => {
      mounted = false
    }
  }, [])

  // Quota API réel — fetch /api/v1/quota (used / limit + percentage)
  // Remplace le hardcoded "68 / 100 k" qui était faux.
  // États : loading ("…") → ready ("42 / 100 k") → error ("— / —").
  // Couleur : vert <60%, orange 60-90%, rouge >90%.
  const [quota, setQuota] = useState<{
    used: number | null
    limit: number | null
    percentage: number
  }>({ used: null, limit: null, percentage: 0 })
  useEffect(() => {
    let mounted = true
    fetch("/api/v1/quota", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!mounted || !json?.data?.apiCalls) return
        const api = json.data.apiCalls as { used: number; limit: number; percentage: number }
        setQuota({ used: api.used, limit: api.limit, percentage: api.percentage })
      })
      .catch(() => {
        // Silent fail — header still renders, just no quota number
        if (mounted) setQuota({ used: null, limit: null, percentage: 0 })
      })
    return () => { mounted = false }
  }, [])

  // Format "42 / 100 k" : si limit >= 1000, on divise par 1000 et on suffixe "k"
  function formatQuotaNumber(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
    if (n >= 1000) return `${Math.round(n / 1000)}k`
    return String(n)
  }
  const quotaLabel = quota.used === null || quota.limit === null
    ? "… / …"
    : `${formatQuotaNumber(quota.used)} / ${formatQuotaNumber(quota.limit)}`
  const quotaPct = quota.percentage
  const quotaColor =
    quotaPct >= 90 ? "text-red-600 dark:text-red-400"
    : quotaPct >= 60 ? "text-orange-600 dark:text-orange-400"
    : "text-emerald-600 dark:text-emerald-400"

  const handleNavigate = useCallback((url: string) => {
    if (url.startsWith("#")) {
      const navKey = url.slice(1)
      onNavigate?.(navKey)
    }
  }, [onNavigate])

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 backdrop-blur-md px-4">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMobileMenu}
          aria-label="Ouvrir le menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Title */}
        {(title || subtitle) && (
          <div className="hidden md:block">
            {title && <h1 className="text-lg font-semibold leading-none">{title}</h1>}
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        )}

        {/* Global search — ouvre la palette */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="relative flex-1 max-w-md group"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <div className="flex items-center h-9 pl-9 pr-3 rounded-md border border-input bg-muted/50 text-sm text-muted-foreground hover:bg-muted transition-colors">
            <span className="flex-1 text-left">Rechercher entreprises, jobs, pages…</span>
            <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-0.5 rounded border bg-background px-1.5 font-mono text-[10px]">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </div>
        </button>

        {/* Tenant selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="hidden sm:flex gap-2 max-w-[200px]">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="truncate">{organizationName}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Organisations</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {allOrgs.map((t) => (
              <DropdownMenuItem key={t}>
                <Building2 className="h-4 w-4 mr-2" />
                {t}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setOrgDetailsOpen(true)
              }}
              className="cursor-pointer"
            >
              <Info className="h-4 w-4 mr-2" />
              Voir les détails
            </DropdownMenuItem>
            <DropdownMenuItem className="text-primary">
              <Plus className="h-4 w-4 mr-2" />
              Créer une organisation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Quota — fetch /api/v1/quota (used / limit) */}
        <div className="hidden lg:flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5" title={`Quota API — ${quotaPct.toFixed(1)}% utilisé`}>
          <Zap className={cn("h-4 w-4", quotaColor)} />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Quota API</span>
            <span className={cn("text-xs font-semibold tabular-nums", quotaColor)}>{quotaLabel}</span>
          </div>
        </div>

        {/* New job */}
        {onNewJob && (
          <Button onClick={onNewJob} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nouveau job</span>
          </Button>
        )}

        {/* Notifications */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {activeAlerts.length > 0 && (
                <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] p-0 flex items-center justify-center bg-orange-500 text-white">
                  {activeAlerts.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Notifications ({activeAlerts.length} actives)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {dashboardAlerts.slice(0, 4).map((alert) => (
              <DropdownMenuItem key={alert.id} className="flex-col items-start py-2">
                <div className="flex w-full justify-between">
                  <span className="text-sm font-medium">{alert.title}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      alert.severity === "critical" && "bg-red-500/10 text-red-600",
                      alert.severity === "warning" && "bg-orange-500/10 text-orange-600",
                      alert.severity === "info" && "bg-blue-500/10 text-blue-600"
                    )}
                  >
                    {alert.severity}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground mt-0.5">{alert.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Changer de thème"
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* User — utilise le composant UserMenu qui gère le logout correctement */}
        <UserMenu />
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} onNavigate={handleNavigate} />
      <OrganizationDetailsDialog open={orgDetailsOpen} onOpenChange={setOrgDetailsOpen} />
    </>
  )
}
