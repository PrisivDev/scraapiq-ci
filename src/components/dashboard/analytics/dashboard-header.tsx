"use client"

import { useState, useCallback } from "react"
import { Search, Bell, Plus, Sun, Moon, Menu, Building2, ChevronDown, Zap, Command } from "lucide-react"
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
  const activeAlerts = dashboardAlerts.filter((a) => a.status === "active")

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
              <span className="truncate">AgriBusiness CI</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Organisations</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {["AgriBusiness CI", "Pharma Distribution", "BTP Express"].map((t) => (
              <DropdownMenuItem key={t}>
                <Building2 className="h-4 w-4 mr-2" />
                {t}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-primary">
              <Plus className="h-4 w-4 mr-2" />
              Créer une organisation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Quota */}
        <div className="hidden lg:flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5">
          <Zap className="h-4 w-4 text-accent-foreground" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Quota API</span>
            <span className="text-xs font-semibold">68 / 100 k</span>
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
    </>
  )
}
