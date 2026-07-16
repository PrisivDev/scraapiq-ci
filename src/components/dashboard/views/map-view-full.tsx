"use client"

import { Map as MapIcon, Maximize2, Layers, Navigation, MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { companies, communes, type Company } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

interface MapViewFullProps {
  onSelectCompany: (c: Company) => void
  highlightedId?: string
}

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

export function MapViewFull({ onSelectCompany, highlightedId }: MapViewFullProps) {
  const [hovered, setHovered] = useState<string | null>(null)
  const [activeCommune, setActiveCommune] = useState<string | null>(null)
  const W = 1000
  const H = 600
  const lagoon = "M 0 340 Q 200 320 350 350 T 650 370 Q 800 380 1000 360 L 1000 600 L 0 600 Z"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapIcon className="h-6 w-6 text-primary" />
            Cartographie
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {companies.length} entreprises géolocalisées · 13 communes d'Abidjan
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Layers className="h-4 w-4" /> Calques
          </Button>
          <Button variant="outline" size="sm" className="w-9 p-0">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="relative w-full bg-gradient-to-b from-primary/5 to-accent/5">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ aspectRatio: `${W}/${H}` }}>
              <defs>
                <pattern id="grid2" width="50" height="50" patternUnits="userSpaceOnUse">
                  <path d="M 50 0 L 0 0 0 50" fill="none" stroke="var(--border)" strokeWidth="0.5" opacity="0.5" />
                </pattern>
                <filter id="markerShadow2" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.3" />
                </filter>
              </defs>
              <rect width={W} height={H} fill="url(#grid2)" />

              <path d={lagoon} fill="var(--chart-4)" opacity="0.18" />
              <path d={lagoon} fill="none" stroke="var(--chart-4)" strokeWidth="1.5" opacity="0.5" strokeDasharray="6 3" />
              <text x={520} y={510} fontSize="13" fill="var(--chart-4)" opacity="0.8" fontStyle="italic">Lagune Ébrié</text>

              {communes.map((c) => {
                const { x, y } = project(c.lat, c.lng, W, H)
                const count = companies.filter((comp) => comp.commune === c.name).length
                const isActive = activeCommune === c.name
                return (
                  <g key={c.name} className="cursor-pointer" onClick={() => setActiveCommune(isActive ? null : c.name)}>
                    <circle cx={x} cy={y} r={isActive ? 48 : 38} fill="var(--primary)" opacity={isActive ? 0.15 : 0.06} className="transition-all" />
                    <circle cx={x} cy={y} r={3} fill="var(--muted-foreground)" opacity={0.5} />
                    <text x={x} y={y - 14} textAnchor="middle" fontSize="12" fontWeight={isActive ? 700 : 500} fill="var(--foreground)" opacity={isActive ? 1 : 0.7} className="select-none">
                      {c.name}
                    </text>
                    {count > 0 && (
                      <text x={x} y={y + 20} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)" className="select-none">
                        {count} entr.
                      </text>
                    )}
                  </g>
                )
              })}

              {companies.map((comp) => {
                const { x, y } = project(comp.lat, comp.lng, W, H)
                const isHovered = hovered === comp.id
                const isHighlighted = highlightedId === comp.id
                const r = isHovered || isHighlighted ? 11 : 7
                return (
                  <g
                    key={comp.id}
                    className="cursor-pointer"
                    onMouseEnter={() => setHovered(comp.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onSelectCompany(comp)}
                  >
                    <circle cx={x} cy={y} r={r + 7} fill={statusColor[comp.status]} opacity={isHovered || isHighlighted ? 0.25 : 0} className="transition-all" />
                    <circle cx={x} cy={y} r={r} fill={statusColor[comp.status]} stroke="white" strokeWidth="1.5" filter="url(#markerShadow2)" className="transition-all" />
                    {isHovered && (
                      <g>
                        <rect x={x + 14} y={y - 32} width={Math.max(comp.name.length * 6.5 + 16, 140)} height={40} rx={4} fill="var(--popover)" stroke="var(--border)" strokeWidth="1" />
                        <text x={x + 22} y={y - 16} fontSize="11" fontWeight="600" fill="var(--popover-foreground)">
                          {comp.name.length > 22 ? comp.name.slice(0, 22) + "…" : comp.name}
                        </text>
                        <text x={x + 22} y={y - 2} fontSize="9" fill="var(--muted-foreground)">
                          {comp.commune} · {comp.sector}
                        </text>
                      </g>
                    )}
                  </g>
                )
              })}

              <g transform={`translate(${W - 60}, 50)`}>
                <circle r="22" fill="var(--background)" stroke="var(--border)" strokeWidth="1" />
                <path d="M 0 -14 L 5 0 L 0 14 L -5 0 Z" fill="var(--chart-3)" />
                <text y="-24" textAnchor="middle" fontSize="11" fill="var(--muted-foreground)">N</text>
              </g>
            </svg>

            <div className="absolute bottom-3 left-3 rounded-lg border bg-background/90 backdrop-blur p-2.5 shadow-sm">
              <p className="text-[10px] font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">Statut des données</p>
              <div className="space-y-1">
                {[
                  { label: "Vérifié", color: statusColor.verified },
                  { label: "Enrichi", color: statusColor.enriched },
                  { label: "Partiel", color: statusColor.partial },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: l.color }} />
                    <span className="text-[11px]">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute top-3 right-3 rounded-lg border bg-background/90 backdrop-blur p-2.5 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <Navigation className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Zone active</span>
              </div>
              <p className="text-sm font-semibold">{activeCommune ?? "Abidjan"}</p>
              <p className="text-[10px] text-muted-foreground">
                {activeCommune
                  ? `${companies.filter((c) => c.commune === activeCommune).length} entreprises`
                  : `${companies.length} entreprises`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
