"use client"

import { Building2, MapPin, Phone, Mail, Globe, Star, Filter, ArrowUpDown, Download, Eye } from "lucide-react"
import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { LayoutGrid, List, Map as MapIcon } from "lucide-react"
import { companies, communes, sectors, type Company } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface CompaniesViewProps {
  onSelectCompany: (c: Company) => void
  onExport: () => void
}

type ViewMode = "grid" | "list" | "map"
type SortKey = "name" | "confidence" | "commune"

export function CompaniesView({ onSelectCompany, onExport }: CompaniesViewProps) {
  const [view, setView] = useState<ViewMode>("grid")
  const [search, setSearch] = useState("")
  const [sectorFilter, setSectorFilter] = useState("all")
  const [communeFilter, setCommuneFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("confidence")

  const filtered = useMemo(() => {
    let r = companies.filter((c) => {
      const ms = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.sector.toLowerCase().includes(search.toLowerCase())
      const mf = sectorFilter === "all" || c.sector === sectorFilter
      const mc = communeFilter === "all" || c.commune === communeFilter
      return ms && mf && mc
    })
    r = [...r].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name)
      if (sortKey === "confidence") return b.confidence - a.confidence
      return a.commune.localeCompare(b.commune)
    })
    return r
  }, [search, sectorFilter, communeFilter, sortKey])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Entreprises
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} entreprise(s) · {companies.length} au total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as ViewMode)}>
            <ToggleGroupItem value="grid" aria-label="Vue grille">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="Vue liste">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="map" aria-label="Vue carte">
              <MapIcon className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Button onClick={onExport} className="gap-2">
            <Download className="h-4 w-4" />
            Exporter
          </Button>
        </div>
      </div>

      {/* Filtres */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher une entreprise…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <Select value={sectorFilter} onValueChange={setSectorFilter}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Secteur" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous secteurs</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={communeFilter} onValueChange={setCommuneFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Commune" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes communes</SelectItem>
                {communes.map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-[140px] h-9">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confidence">Confiance</SelectItem>
                <SelectItem value="name">Nom A-Z</SelectItem>
                <SelectItem value="commune">Commune</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vue grille */}
      {view === "grid" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((c) => (
            <CompanyCard key={c.id} company={c} onClick={() => onSelectCompany(c)} />
          ))}
        </div>
      )}

      {/* Vue liste */}
      {view === "list" && (
        <Card>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Entreprise</TableHead>
                    <TableHead>Secteur</TableHead>
                    <TableHead>Commune</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Confiance</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => onSelectCompany(c)}>
                      <TableCell>
                        <p className="font-medium text-sm">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground">{c.rccm}</p>
                      </TableCell>
                      <TableCell className="text-xs">{c.sector}</TableCell>
                      <TableCell className="text-xs">{c.commune}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-[11px]">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {c.phone.slice(-8)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={cn("h-full", c.confidence >= 95 ? "bg-primary" : "bg-accent-foreground")}
                              style={{ width: `${c.confidence}%` }}
                            />
                          </div>
                          <span className="text-[11px] tabular-nums">{c.confidence}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vue carte (simple liste avec coordonnées) */}
      {view === "map" && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground mb-3">
              🗺️ {filtered.length} entreprises géolocalisées. Carte interactive pleine page disponible dans l'onglet "Cartographie".
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => onSelectCompany(c)}
                  className="flex items-center gap-3 rounded-lg border p-2.5 hover:bg-accent/40 text-left transition-colors"
                >
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.commune} · {c.lat.toFixed(4)}, {c.lng.toFixed(4)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Aucune entreprise ne correspond à vos critères.
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function CompanyCard({ company, onClick }: { company: Company; onClick: () => void }) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" >
      <CardContent className="p-4" onClick={onClick}>
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-sm shrink-0">
            {company.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm leading-tight truncate">{company.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{company.sector}</p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] shrink-0",
              company.status === "verified" && "bg-primary/10 text-primary border-primary/20",
              company.status === "enriched" && "bg-accent/20 text-accent-foreground border-accent/30",
              company.status === "partial" && "bg-muted text-muted-foreground"
            )}
          >
            {company.status === "verified" ? "Vérifié" : company.status === "enriched" ? "Enrichi" : "Partiel"}
          </Badge>
        </div>

        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {company.commune}, {company.city}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-3 w-3" />
            {company.phone}
          </div>
          {company.email && (
            <div className="flex items-center gap-2 text-muted-foreground truncate">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{company.email}</span>
            </div>
          )}
          {company.website && (
            <div className="flex items-center gap-2 text-muted-foreground truncate">
              <Globe className="h-3 w-3 shrink-0" />
              <span className="truncate">{company.website}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-primary text-primary" />
            <span className="text-[11px] font-medium">{company.confidence}%</span>
          </div>
          <span className="text-[10px] text-muted-foreground">{company.sources.length} sources</span>
        </div>
      </CardContent>
    </Card>
  )
}
