"use client"

import { useState } from "react"
import { MapPin, Navigation, Layers, Activity, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { communeDistribution } from "@/lib/dashboard-data"

const BOUNDS = {
  minLat: 5.25,
  maxLat: 5.45,
  minLng: -4.1,
  maxLng: -3.87,
}

function project(lat: number, lng: number, w: number, h: number) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * w
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * h
  return { x, y }
}

export function GeographicHeatmap() {
  const [hovered, setHovered] = useState<string | null>(null)
  const [activeCommune, setActiveCommune] = useState<string | null>(null)
  const W = 1000
  const H = 600
  const lagoon = "M 0 340 Q 200 320 350 350 T 650 370 Q 800 380 1000 360 L 1000 600 L 0 600 Z"

  const maxEntreprises = Math.max(...communeDistribution.map((c) => c.entreprises))

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Carte de chaleur — Abidjan</CardTitle>
              <CardDescription className="text-xs">
                {communeDistribution.reduce((s, c) => s + c.entreprises, 0).toLocaleString("fr-FR")} entreprises · 10 communes
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Calques
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative w-full bg-gradient-to-b from-primary/5 to-accent/5">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ aspectRatio: `${W}/${H}` }}>
            <defs>
              <pattern id="grid3" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="var(--border)" strokeWidth="0.5" opacity="0.5" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#grid3)" />

            {/* Lagune */}
            <path d={lagoon} fill="var(--chart-4)" opacity="0.18" />
            <path d={lagoon} fill="none" stroke="var(--chart-4)" strokeWidth="1.5" opacity="0.5" strokeDasharray="6 3" />
            <text x={520} y={510} fontSize="13" fill="var(--chart-4)" opacity="0.8" fontStyle="italic">Lagune Ébrié</text>

            {/* Cercles de chaleur par commune */}
            {communeDistribution.map((c) => {
              const { x, y } = project(c.lat, c.lng, W, H)
              const intensity = c.entreprises / maxEntreprises
              const radius = 30 + intensity * 60
              const isActive = activeCommune === c.commune
              const isHovered = hovered === c.commune
              return (
                <g
                  key={c.commune}
                  className="cursor-pointer"
                  onClick={() => setActiveCommune(isActive ? null : c.commune)}
                  onMouseEnter={() => setHovered(c.commune)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {/* Halo de chaleur */}
                  <circle
                    cx={x}
                    cy={y}
                    r={radius}
                    fill="var(--chart-1)"
                    opacity={isActive ? 0.35 : isHovered ? 0.28 : 0.12 + intensity * 0.1}
                    className="transition-all"
                  />
                  {/* Cercle principal */}
                  <circle
                    cx={x}
                    cy={y}
                    r={isActive ? 14 : isHovered ? 12 : 10}
                    fill="var(--chart-1)"
                    stroke="white"
                    strokeWidth="2"
                    className="transition-all"
                  />
                  {/* Nom */}
                  <text
                    x={x}
                    y={y - radius / 2 - 5}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight={isActive ? 700 : 500}
                    fill="var(--foreground)"
                    className="select-none"
                  >
                    {c.commune}
                  </text>
                  {/* Count */}
                  <text
                    x={x}
                    y={y - radius / 2 + 10}
                    textAnchor="middle"
                    fontSize="11"
                    fill="var(--chart-1)"
                    fontWeight="600"
                    className="select-none"
                  >
                    {c.entreprises.toLocaleString("fr-FR")}
                  </text>
                  {/* Growth badge */}
                  {c.growth > 0 && (
                    <g>
                      <rect
                        x={x + 15}
                        y={y - 8}
                        width={42}
                        height={16}
                        rx={3}
                        fill={c.growth >= 20 ? "var(--chart-5)" : "var(--chart-2)"}
                        opacity="0.9"
                      />
                      <text
                        x={x + 36}
                        y={y + 3}
                        textAnchor="middle"
                        fontSize="9"
                        fill="white"
                        fontWeight="600"
                        className="select-none"
                      >
                        +{c.growth}%
                      </text>
                    </g>
                  )}
                </g>
              )
            })}

            {/* Boussole */}
            <g transform={`translate(${W - 60}, 50)`}>
              <circle r="22" fill="var(--background)" stroke="var(--border)" strokeWidth="1" />
              <path d="M 0 -14 L 5 0 L 0 14 L -5 0 Z" fill="var(--chart-3)" />
              <text y="-24" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">N</text>
            </g>
          </svg>

          {/* Légende */}
          <div className="absolute bottom-3 left-3 rounded-lg border bg-background/90 backdrop-blur p-2.5 shadow-sm">
            <p className="text-[10px] font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">
              Densité d'entreprises
            </p>
            <div className="flex items-center gap-2">
              <div className="h-2 w-32 rounded-full bg-gradient-to-r from-primary/30 to-primary" />
              <span className="text-[10px] text-muted-foreground">Faible → Forte</span>
            </div>
          </div>

          {/* Stats overlay */}
          <div className="absolute top-3 right-3 rounded-lg border bg-background/90 backdrop-blur p-2.5 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <Navigation className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Zone active
              </span>
            </div>
            <p className="text-sm font-semibold">{activeCommune ?? "Abidjan"}</p>
            <p className="text-[10px] text-muted-foreground">
              {activeCommune
                ? `${communeDistribution.find((c) => c.commune === activeCommune)?.entreprises.toLocaleString("fr-FR")} entreprises`
                : `${communeDistribution.reduce((s, c) => s + c.entreprises, 0).toLocaleString("fr-FR")} entreprises`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
