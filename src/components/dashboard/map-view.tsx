"use client"

import { useState } from "react"
import { MapPin, Layers, Maximize2, Navigation } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { companies, communes, type Company } from "@/lib/mock-data"

interface MapViewProps {
  onSelectCompany: (c: Company) => void
  highlightedId?: string
}

// Coordonnées de la zone d'Abidjan pour le mapping lat/lng → x/y
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

const statusColor: Record<Company["status"], string> = {
  verified: "var(--chart-1)",
  enriched: "var(--chart-2)",
  partial: "var(--chart-5)",
  duplicate: "var(--muted-foreground)",
}

export function MapView({ onSelectCompany, highlightedId }: MapViewProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [activeCommune, setActiveCommune] = useState<string | null>(null)

  const W = 800
  const H = 500

  // Lagune Ébrié stylisée (chemin approximatif)
  const lagoon = "M 0 280 Q 150 260 280 290 T 520 310 Q 650 320 800 300 L 800 500 L 0 500 Z"

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Cartographie — Abidjan</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {companies.length} entreprises géolocalisées sur 13 communes
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5">
              <Layers className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Calques</span>
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative w-full bg-gradient-to-b from-primary/5 to-accent/5">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            style={{ aspectRatio: `${W}/${H}` }}
          >
            {/* Grille de fond */}
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="0.5"
                  opacity="0.5"
                />
              </pattern>
              <filter id="markerShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.3" />
              </filter>
            </defs>
            <rect width={W} height={H} fill="url(#grid)" />

            {/* Lagune Ébrié */}
            <path d={lagoon} fill="var(--chart-4)" opacity="0.18" />
            <path
              d={lagoon}
              fill="none"
              stroke="var(--chart-4)"
              strokeWidth="1.5"
              opacity="0.5"
              strokeDasharray="6 3"
            />
            <text x={420} y={420} fontSize="11" fill="var(--chart-4)" opacity="0.8" fontStyle="italic">
              Lagune Ébrié
            </text>

            {/* Communes (labels et zones) */}
            {communes.map((c) => {
              const { x, y } = project(c.lat, c.lng, W, H)
              const count = companies.filter(
                (comp) => comp.commune === c.name
              ).length
              const isActive = activeCommune === c.name
              return (
                <g
                  key={c.name}
                  className="cursor-pointer"
                  onClick={() => setActiveCommune(isActive ? null : c.name)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={isActive ? 38 : 30}
                    fill="var(--primary)"
                    opacity={isActive ? 0.15 : 0.06}
                    className="transition-all"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={3}
                    fill="var(--muted-foreground)"
                    opacity={0.5}
                  />
                  <text
                    x={x}
                    y={y - 12}
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight={isActive ? 700 : 500}
                    fill="var(--foreground)"
                    opacity={isActive ? 1 : 0.7}
                    className="select-none"
                  >
                    {c.name}
                  </text>
                  {count > 0 && (
                    <text
                      x={x}
                      y={y + 18}
                      textAnchor="middle"
                      fontSize="9"
                      fill="var(--muted-foreground)"
                      className="select-none"
                    >
                      {count} entr.
                    </text>
                  )}
                </g>
              )
            })}

            {/* Marqueurs d'entreprises */}
            {companies.map((comp) => {
              const { x, y } = project(comp.lat, comp.lng, W, H)
              const isHovered = hovered === comp.id
              const isHighlighted = highlightedId === comp.id
              const r = isHovered || isHighlighted ? 9 : 6
              return (
                <g
                  key={comp.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHovered(comp.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => onSelectCompany(comp)}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={r + 6}
                    fill={statusColor[comp.status]}
                    opacity={isHovered || isHighlighted ? 0.25 : 0}
                    className="transition-all"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={r}
                    fill={statusColor[comp.status]}
                    stroke="white"
                    strokeWidth="1.5"
                    filter="url(#markerShadow)"
                    className="transition-all"
                  />
                  {isHovered && (
                    <g>
                      <rect
                        x={x + 12}
                        y={y - 28}
                        width={Math.max(comp.name.length * 5.8 + 16, 120)}
                        height={36}
                        rx={4}
                        fill="var(--popover)"
                        stroke="var(--border)"
                        strokeWidth="1"
                      />
                      <text x={x + 20} y={y - 14} fontSize="10" fontWeight="600" fill="var(--popover-foreground)">
                        {comp.name.length > 22 ? comp.name.slice(0, 22) + "…" : comp.name}
                      </text>
                      <text x={x + 20} y={y - 2} fontSize="9" fill="var(--muted-foreground)">
                        {comp.commune} · {comp.sector}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}

            {/* Boussole */}
            <g transform={`translate(${W - 50}, 40)`}>
              <circle r="18" fill="var(--background)" stroke="var(--border)" strokeWidth="1" />
              <path d="M 0 -12 L 4 0 L 0 12 L -4 0 Z" fill="var(--chart-3)" />
              <text y="-20" textAnchor="middle" fontSize="9" fill="var(--muted-foreground)">N</text>
            </g>
          </svg>

          {/* Légende */}
          <div className="absolute bottom-3 left-3 rounded-lg border bg-background/90 backdrop-blur p-2.5 shadow-sm">
            <p className="text-[10px] font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">
              Statut des données
            </p>
            <div className="space-y-1">
              {[
                { label: "Vérifié", color: statusColor.verified },
                { label: "Enrichi", color: statusColor.enriched },
                { label: "Partiel", color: statusColor.partial },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  <span className="text-[11px]">{l.label}</span>
                </div>
              ))}
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
                ? `${companies.filter((c) => c.commune === activeCommune).length} entreprises`
                : `${companies.length} entreprises affichées`}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
