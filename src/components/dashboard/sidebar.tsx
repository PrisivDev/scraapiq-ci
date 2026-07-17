"use client"

import { useState } from "react"
import {
  LayoutDashboard,
  Search,
  Building2,
  Map,
  Database,
  Activity,
  Download,
  Settings,
  Users,
  Radar,
  ChevronLeft,
  Sparkles,
  Cpu,
  Code,
  Bell,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export type NavKey =
  | "dashboard"
  | "search"
  | "companies"
  | "map"
  | "sources"
  | "jobs"
  | "scraper"
  | "exports"
  | "team"
  | "api"
  | "notifications"
  | "settings"

interface SidebarProps {
  active: NavKey
  onSelect: (key: NavKey) => void
  mobile?: boolean
}

const navItems: {
  key: NavKey
  label: string
  icon: React.ElementType
  badge?: string
  section: string
}[] = [
  { key: "dashboard", label: "Tableau de bord", icon: LayoutDashboard, section: "Pilotage" },
  { key: "search", label: "Recherche multicritère", icon: Search, badge: "Nouveau", section: "Pilotage" },
  { key: "companies", label: "Entreprises", icon: Building2, section: "Données" },
  { key: "map", label: "Cartographie", icon: Map, section: "Données" },
  { key: "sources", label: "Sources de données", icon: Database, section: "Données" },
  { key: "jobs", label: "Jobs de scraping", icon: Activity, badge: "12", section: "Opérations" },
  { key: "scraper", label: "Moteur Google Maps", icon: Cpu, badge: "Nouveau", section: "Opérations" },
  { key: "exports", label: "Exports", icon: Download, section: "Opérations" },
  { key: "api", label: "API REST", icon: Code, badge: "v1", section: "Administration" },
  { key: "notifications", label: "Notifications", icon: Bell, badge: "Multi-canal", section: "Administration" },
  { key: "team", label: "Équipe & tenants", icon: Users, section: "Administration" },
  { key: "settings", label: "Paramètres", icon: Settings, section: "Administration" },
]

export function Sidebar({ active, onSelect, mobile = false }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  const sections = Array.from(new Set(navItems.map((i) => i.section)))

  return (
    <aside
      className={cn(
        "flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300",
        mobile ? "flex w-[260px] h-full" : "hidden md:flex",
        !mobile && (collapsed ? "w-[68px]" : "w-[260px]")
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 h-16 px-4 border-b">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Radar className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="flex flex-col leading-none">
            <span className="font-bold text-base">ScrapIQ</span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Côte d'Ivoire
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-7 w-7"
          onClick={() => setCollapsed((c) => !c)}
          aria-label="Réduire le menu"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        {sections.map((section) => (
          <div key={section} className="space-y-1">
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section}
              </p>
            )}
            {navItems
              .filter((i) => i.section === section)
              .map((item) => {
                const Icon = item.icon
                const isActive = active === item.key
                return (
                  <button
                    key={item.key}
                    onClick={() => onSelect(item.key)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      isActive && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                      collapsed && "justify-center"
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
                    {!collapsed && item.badge && (
                      <Badge
                        variant={isActive ? "secondary" : "default"}
                        className={
                          item.badge === "Nouveau"
                            ? "bg-accent text-accent-foreground text-[10px] px-1.5"
                            : "text-[10px] px-1.5"
                        }
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </button>
                )
              })}
          </div>
        ))}
      </nav>

      {/* Footer card: IA status */}
      {!collapsed && (
        <div className="m-3 rounded-lg border bg-gradient-to-br from-primary/10 to-accent/10 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold">Moteur IA actif</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Dédup & enrichissement LLM opérationnels. 8 421 doublons fusionnés ce mois.
          </p>
        </div>
      )}
    </aside>
  )
}
