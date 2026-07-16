"use client"

import * as React from "react"
import Link from "next/link"
import { Radar, ShieldCheck, Globe2, Search } from "lucide-react"
import { AuthFooter } from "./footer"

interface AuthLayoutProps {
  children: React.ReactNode
  /** Optional panel title override (defaults to "ScrapIQ CI") */
  brandTitle?: string
  /** Right panel tagline (defaults to CI tagline) */
  tagline?: string
}

/**
 * Split-screen layout used by /auth/login, /auth/register and /auth/verify-2fa.
 * - Left (60% on md+): white background holding the form (`children`)
 * - Right (40% on md+): emerald → teal gradient panel with branding
 *
 * On mobile, only the left form panel is rendered and the gradient panel is
 * replaced by a compact brand header on top.
 *
 * The root wrapper uses `min-h-screen flex flex-col` so the included
 * <AuthFooter /> sticks to the bottom of the viewport (mt-auto).
 */
export function AuthLayout({
  children,
  brandTitle = "ScrapIQ CI",
  tagline = "Web Scraping Intelligent pour la Côte d'Ivoire",
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex flex-1 flex-col md:flex-row">
        {/* Left: form panel */}
        <div className="flex flex-1 md:flex-[3] flex-col">
          {/* Mobile brand header */}
          <div className="md:hidden flex items-center gap-2 px-6 pt-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Radar className="h-5 w-5" />
            </div>
            <span className="font-bold tracking-tight">{brandTitle}</span>
          </div>

          <div className="flex flex-1 items-center justify-center px-6 py-8 md:py-12">
            <div className="w-full max-w-md">{children}</div>
          </div>

          <AuthFooter />
        </div>

        {/* Right: gradient brand panel (desktop only) */}
        <aside className="hidden md:flex md:flex-[2] relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white">
          {/* Decorative blurred blobs */}
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-orange-400/30 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-emerald-300/20 blur-3xl" />

          <div className="relative z-10 flex flex-col justify-between p-10 lg:p-12 w-full">
            {/* Brand */}
            <Link href="/" className="flex items-center gap-3 self-start">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur">
                <Radar className="h-6 w-6" />
              </div>
              <span className="text-xl font-bold tracking-tight">{brandTitle}</span>
            </Link>

            {/* Center tagline + features */}
            <div className="space-y-6 max-w-md">
              <h1 className="text-3xl lg:text-4xl font-bold leading-tight tracking-tight">
                {tagline}
              </h1>
              <p className="text-white/80 text-sm lg:text-base">
                Découvrez, enrichissez et dédupliquez automatiquement les entreprises
                ivoiriennes grâce à un moteur IA multi-sources.
              </p>

              <ul className="space-y-3 pt-2">
                {[
                  {
                    icon: Search,
                    title: "Recherche multicritère",
                    desc: "Mots-clés, communes d'Abidjan, secteurs, score de confiance",
                  },
                  {
                    icon: Globe2,
                    title: "Multi-sources",
                    desc: "Pages Jaunes CI, Annuaire CI, RCCM, réseaux sociaux",
                  },
                  {
                    icon: ShieldCheck,
                    title: "Conforme APIPD",
                    desc: "Données publiques uniquement, traçabilité complète",
                  },
                ].map((f) => (
                  <li key={f.title} className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                      <f.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{f.title}</p>
                      <p className="text-xs text-white/70">{f.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer caption */}
            <div className="text-xs text-white/60">
              © {new Date().getFullYear()} ScrapIQ CI · Conçu à Abidjan
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

/**
 * Simpler centered layout used by /account/* pages.
 * Renders a top bar with the ScrapIQ CI brand + a "Back to dashboard" link,
 * the page content centered in a max-width container, then the sticky footer.
 */
export function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Radar className="h-4 w-4" />
            </div>
            <span className="font-bold tracking-tight">ScrapIQ CI</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Retour au tableau de bord
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
      </main>

      <AuthFooter />
    </div>
  )
}
