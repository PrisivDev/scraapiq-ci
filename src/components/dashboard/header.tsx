"use client"

import { useState } from "react"
import {
  Search,
  Bell,
  Plus,
  Sun,
  Moon,
  Menu,
  Building2,
  ChevronDown,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "next-themes"

interface HeaderProps {
  onNewJob: () => void
  onMobileMenu: () => void
}

export function Header({ onNewJob, onMobileMenu }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const [tenant, setTenant] = useState("AgriBusiness CI")

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onMobileMenu}
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Global search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher une entreprise, un job, un secteur…"
          className="pl-9 bg-muted/50 border-transparent focus-visible:border-border"
        />
      </div>

      {/* Tenant selector */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="hidden sm:flex gap-2 max-w-[200px]">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="truncate">{tenant}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Organisations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {["AgriBusiness CI", "Pharma Distribution", "BTP Express"].map((t) => (
            <DropdownMenuItem key={t} onClick={() => setTenant(t)}>
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

      {/* Quota indicator */}
      <div className="hidden lg:flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5">
        <Zap className="h-4 w-4 text-accent-foreground" />
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Quota API</span>
          <span className="text-xs font-semibold">68 / 100 k</span>
        </div>
      </div>

      {/* New job button */}
      <Button onClick={onNewJob} className="gap-2">
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Nouveau job</span>
      </Button>

      {/* Notifications */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px] p-0 flex items-center justify-center">
              3
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            { t: "Job #0091 terminé", d: "142 entreprises récupérées", time: "2 min" },
            { t: "Dédup IA terminée", d: "18 doublons fusionnés", time: "12 min" },
            { t: "Quota à 68%", d: "Pensez à recharger votre forfait", time: "1 h" },
          ].map((n, i) => (
            <DropdownMenuItem key={i} className="flex-col items-start py-2">
              <div className="flex w-full justify-between">
                <span className="text-sm font-medium">{n.t}</span>
                <span className="text-[10px] text-muted-foreground">{n.time}</span>
              </div>
              <span className="text-xs text-muted-foreground">{n.d}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Theme toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Changer de thème"
      >
        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </Button>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-full outline-none">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                AK
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-medium">Amadou Koné</span>
              <span className="text-xs text-muted-foreground font-normal">amadou@agribusiness.ci</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Mon profil</DropdownMenuItem>
          <DropdownMenuItem>Clés API</DropdownMenuItem>
          <DropdownMenuItem>Facturation</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive">Se déconnecter</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
