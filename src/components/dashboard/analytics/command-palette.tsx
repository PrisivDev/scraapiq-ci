"use client"

import { useState, useEffect, useRef } from "react"
import {
  Search, Building2, Activity, Download, Bell, LayoutDashboard,
  Database, Users, Settings, Map, Radar, Play, FileSpreadsheet,
  UserPlus, Moon, Sun, CornerDownLeft, ArrowRight, Shield,
} from "lucide-react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { searchableItems, type SearchItem } from "@/lib/dashboard-data"

const iconMap: Record<string, React.ElementType> = {
  "layout-dashboard": LayoutDashboard,
  "search": Search,
  "building": Building2,
  "map": Map,
  "radar": Radar,
  "database": Database,
  "activity": Activity,
  "download": Download,
  "users": Users,
  "settings": Settings,
  "play": Play,
  "file-spreadsheet": FileSpreadsheet,
  "user-plus": UserPlus,
  "moon": Moon,
  "sun": Sun,
  "bell": Bell,
  "shield": Shield,
}

const typeMeta: Record<SearchItem["type"], { label: string; color: string }> = {
  page: { label: "Page", color: "bg-emerald-500/10 text-emerald-600" },
  action: { label: "Action", color: "bg-violet-500/10 text-violet-600" },
  company: { label: "Entreprise", color: "bg-blue-500/10 text-blue-600" },
  job: { label: "Job", color: "bg-orange-500/10 text-orange-600" },
  export: { label: "Export", color: "bg-slate-500/10 text-slate-600" },
  alert: { label: "Alerte", color: "bg-red-500/10 text-red-600" },
}

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onNavigate?: (url: string) => void
}

export function CommandPalette({ open, onOpenChange, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Raccourci clavier ⌘K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        onOpenChange(!open)
      }
      if (e.key === "Escape" && open) {
        onOpenChange(false)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onOpenChange])

  // Focus input à l'ouverture
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Reset state quand la palette se ferme
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setQuery("")
        setSelectedIndex(0)
      }, 200)
      return () => clearTimeout(t)
    }
  }, [open])

  // Filtrage fuzzy
  const filtered = query.trim()
    ? searchableItems.filter((item) => {
        const q = query.toLowerCase()
        return (
          item.label.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.toLowerCase().includes(q)) ||
          item.description?.toLowerCase().includes(q)
        )
      })
    : searchableItems.slice(0, 8)

  // Navigation clavier
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedIndex((i) => Math.max(i - 1, 0))
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault()
        // Inline the select logic to avoid dependency on handleSelect
        const item = filtered[selectedIndex]
        onOpenChange(false)
        if (item?.url && onNavigate) {
          onNavigate(item.url)
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, filtered, selectedIndex, onOpenChange, onNavigate])

  const handleSelect = (item: SearchItem) => {
    onOpenChange(false)
    if (item.url && onNavigate) {
      onNavigate(item.url)
    }
  }

  // Groupe par type
  const grouped = filtered.reduce<Record<string, SearchItem[]>>((acc, item) => {
    if (!acc[item.type]) acc[item.type] = []
    acc[item.type].push(item)
    return acc
  }, {})

  const typeOrder: SearchItem["type"][] = ["page", "action", "company", "job", "export", "alert"]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>Recherche globale</DialogTitle>
        </DialogHeader>

        {/* Input */}
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-5 w-5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Rechercher une page, une entreprise, un job, une action…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* Résultats */}
        <div className="max-h-[400px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Aucun résultat pour "{query}"</p>
            </div>
          ) : (
            <div className="py-2">
              {typeOrder.map((type) => {
                const items = grouped[type]
                if (!items || items.length === 0) return null
                return (
                  <div key={type} className="mb-2">
                    <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {typeMeta[type].label}
                    </p>
                    {items.map((item) => {
                      const Icon = iconMap[item.icon] || Search
                      const globalIndex = filtered.indexOf(item)
                      const isSelected = globalIndex === selectedIndex
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                            isSelected ? "bg-accent" : "hover:bg-accent/50"
                          )}
                        >
                          <div className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            typeMeta[type].color
                          )}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.label}</p>
                            {item.description && (
                              <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                            )}
                          </div>
                          {isSelected && (
                            <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[9px]">↑↓</kbd>
              Naviguer
            </span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border bg-muted px-1 font-mono text-[9px]">↵</kbd>
              Sélectionner
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            ScrapIQ CI · Recherche globale
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

import { Sparkles } from "lucide-react"
