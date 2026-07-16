"use client"

import { Radar, Shield, Heart } from "lucide-react"

/**
 * Footer used across auth + account pages.
 * Sticky to the bottom when used inside a `min-h-screen flex flex-col` wrapper
 * thanks to the `mt-auto` class.
 */
export function AuthFooter() {
  return (
    <footer className="mt-auto border-t bg-background/80 backdrop-blur">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Radar className="h-3.5 w-3.5 text-primary" />
          <span>
            <span className="font-semibold text-foreground">ScrapIQ CI</span> — Web Scraping Intelligent
          </span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">v1.0 Enterprise</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-primary" />
            Conforme APIPD · Données publiques uniquement
          </span>
          <span className="hidden md:flex items-center gap-1">
            Conçu avec <Heart className="h-3 w-3 fill-destructive text-destructive" /> à Abidjan
          </span>
        </div>
      </div>
    </footer>
  )
}
