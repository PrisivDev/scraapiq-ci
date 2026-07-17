"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import {
  MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents,
} from "react-leaflet"
import L from "leaflet"
import "leaflet.heat"
import {
  MapPin, Filter, Layers, Crosshair, Navigation, Maximize2,
  Building2, Phone, Star, Users, Map as MapIcon, Flame, Circle as CircleIcon,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  geoCompanies, abidjanCommunes, ciCities, mapSectors, sectorColors,
  haversineDistance, type GeoCompany,
} from "@/lib/geo-data"

// Fix Leaflet default icon issue with bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
})

// Crée un icône coloré custom par secteur
function createSectorIcon(sector: string, isHighlighted = false): L.DivIcon {
  const color = sectorColors[sector] || "#64748b"
  const size = isHighlighted ? 36 : 28
  return L.divIcon({
    html: `<div style="
      background: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    "><div style="
      transform: rotate(45deg);
      width: ${size * 0.4}px;
      height: ${size * 0.4}px;
      border-radius: 50%;
      background: white;
    "></div></div>`,
    className: "custom-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  })
}

// Composant pour la couche heatmap
function HeatmapLayer({ points, radius }: { points: Array<[number, number, number]>; radius: number }) {
  const map = useMap()

  useEffect(() => {
    if (!map || points.length === 0) return

    // leaflet.heat étend L avec .heatLayer (types fournis par @types/leaflet.heat)
    const heatLayer = L.heatLayer(points, {
      radius,
      blur: 25,
      maxZoom: 17,
      max: 1.0,
      gradient: { 0.0: "blue", 0.3: "lime", 0.5: "yellow", 0.7: "orange", 1.0: "red" },
    })

    heatLayer.addTo(map)

    return () => {
      map.removeLayer(heatLayer)
    }
  }, [map, points, radius])

  return null
}

// Composant pour recentrer la carte
function RecenterButton({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap()
  return (
    <button
      onClick={() => map.setView(center, zoom)}
      className="absolute top-3 right-3 z-[1000] flex h-9 w-9 items-center justify-center rounded-lg border bg-background shadow-md hover:bg-accent transition-colors"
      title="Recentrer"
    >
      <Crosshair className="h-4 w-4" />
    </button>
  )
}

// Composant pour capturer le clic sur la carte (rayon de recherche)
function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

// Status meta
const statusMeta = {
  verified: { label: "Vérifié", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  enriched: { label: "Enrichi", className: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  partial: { label: "Partiel", className: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
}

export function OSMMapView() {
  const [map] = useState<[number, number]>([5.36, -4.0083]) // Abidjan center
  const [zoom] = useState(12)
  const mapRef = useRef<L.Map | null>(null)

  // Filtres
  const [selectedSectors, setSelectedSectors] = useState<string[]>(mapSectors.slice(0, 6))
  const [selectedCommune, setSelectedCommune] = useState<string>("all")
  const [selectedCity, setSelectedCity] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  // Vue (markers / heatmap)
  const [viewMode, setViewMode] = useState<"markers" | "heatmap">("markers")

  // Rayon de recherche
  const [radiusEnabled, setRadiusEnabled] = useState(false)
  const [radiusCenter, setRadiusCenter] = useState<[number, number] | null>(null)
  const [radiusKm, setRadiusKm] = useState(5)

  // Company sélectionnée pour calcul distance
  const [selectedCompany, setSelectedCompany] = useState<GeoCompany | null>(null)

  // Filtrage des entreprises
  const filteredCompanies = useMemo(() => {
    return geoCompanies.filter((c) => {
      // Filtre secteur
      if (!selectedSectors.includes(c.sector)) return false
      // Filtre commune
      if (selectedCommune !== "all" && c.commune !== selectedCommune) return false
      // Filtre ville
      if (selectedCity !== "all" && c.city !== selectedCity) return false
      // Filtre statut
      if (statusFilter !== "all" && c.status !== statusFilter) return false
      // Recherche texte
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false
      // Filtre rayon
      if (radiusEnabled && radiusCenter) {
        const dist = haversineDistance(radiusCenter[0], radiusCenter[1], c.lat, c.lng)
        if (dist > radiusKm) return false
      }
      return true
    })
  }, [selectedSectors, selectedCommune, selectedCity, statusFilter, searchQuery, radiusEnabled, radiusCenter, radiusKm])

  // Points pour heatmap
  const heatPoints = useMemo(() => {
    return filteredCompanies.map((c) => [c.lat, c.lng, 0.8] as [number, number, number])
  }, [filteredCompanies])

  // Stats
  const stats = useMemo(() => {
    const bySector: Record<string, number> = {}
    for (const c of filteredCompanies) {
      bySector[c.sector] = (bySector[c.sector] || 0) + 1
    }
    return {
      total: filteredCompanies.length,
      sectors: Object.keys(bySector).length,
      verified: filteredCompanies.filter((c) => c.status === "verified").length,
      avgRating: filteredCompanies.length > 0
        ? (filteredCompanies.reduce((s, c) => s + (c.rating || 0), 0) / filteredCompanies.length).toFixed(1)
        : "—",
    }
  }, [filteredCompanies])

  // Distances depuis le rayon (si activé)
  const nearestCompanies = useMemo(() => {
    if (!radiusEnabled || !radiusCenter) return []
    return [...filteredCompanies]
      .map((c) => ({
        ...c,
        distance: haversineDistance(radiusCenter[0], radiusCenter[1], c.lat, c.lng),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
  }, [filteredCompanies, radiusEnabled, radiusCenter])

  // Toggle secteur
  const toggleSector = (sector: string) => {
    setSelectedSectors((prev) =>
      prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]
    )
  }

  // Clic carte → rayon
  const handleMapClick = (lat: number, lng: number) => {
    if (radiusEnabled) {
      setRadiusCenter([lat, lng])
      toast.success(`Rayon de recherche défini: ${radiusKm} km`, {
        description: `${filteredCompanies.length} entreprises dans le rayon`,
      })
    }
  }

  // Sélection commune → fly to
  useEffect(() => {
    if (selectedCommune !== "all" && mapRef.current) {
      const commune = abidjanCommunes.find((c) => c.name === selectedCommune)
      if (commune) {
        mapRef.current.flyTo([commune.lat, commune.lng], 14, { duration: 1 })
      }
    }
  }, [selectedCommune])

  // Sélection ville → fly to
  useEffect(() => {
    if (selectedCity !== "all" && mapRef.current) {
      const city = ciCities.find((c) => c.name === selectedCity)
      if (city) {
        mapRef.current.flyTo([city.lat, city.lng], city.name === "Abidjan" ? 12 : 10, { duration: 1 })
      }
    }
  }, [selectedCity])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapIcon className="h-6 w-6 text-primary" />
            Cartographie OpenStreetMap
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {stats.total} entreprises · {stats.sectors} secteurs · {stats.verified} vérifiées · Note moy {stats.avgRating}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle Markers / Heatmap */}
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as "markers" | "heatmap")}
          >
            <ToggleGroupItem value="markers" aria-label="Marqueurs">
              <MapPin className="h-4 w-4" />
              <span className="ml-1 text-xs hidden sm:inline">Marqueurs</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="heatmap" aria-label="Heatmap">
              <Flame className="h-4 w-4" />
              <span className="ml-1 text-xs hidden sm:inline">Heatmap</span>
            </ToggleGroupItem>
          </ToggleGroup>

          {/* Toggle Rayon */}
          <Button
            variant={radiusEnabled ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => {
              setRadiusEnabled(!radiusEnabled)
              if (!radiusEnabled) {
                toast.info("Cliquez sur la carte pour définir le centre du rayon de recherche")
              } else {
                setRadiusCenter(null)
              }
            }}
          >
            <CircleIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Rayon</span>
          </Button>
        </div>
      </div>

      {/* Barre de filtres */}
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Recherche */}
            <div className="relative flex-1 min-w-[200px]">
              <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher une entreprise…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>

            {/* Ville */}
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Ville" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes villes</SelectItem>
                {ciCities.map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Commune (visible si Abidjan) */}
            {(selectedCity === "all" || selectedCity === "Abidjan") && (
              <Select value={selectedCommune} onValueChange={setSelectedCommune}>
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue placeholder="Commune" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes communes</SelectItem>
                  {abidjanCommunes.map((c) => (
                    <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Statut */}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="verified">Vérifié</SelectItem>
                <SelectItem value="enriched">Enrichi</SelectItem>
                <SelectItem value="partial">Partiel</SelectItem>
              </SelectContent>
            </Select>

            {/* Secteurs (popover) */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 gap-2">
                  <Layers className="h-3.5 w-3.5" />
                  Secteurs ({selectedSectors.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="end">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold">Sélectionner</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setSelectedSectors(mapSectors)}
                  >
                    Tous
                  </Button>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1">
                  {mapSectors.map((s) => (
                    <label
                      key={s}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
                        selectedSectors.includes(s) && "bg-accent/50"
                      )}
                    >
                      <Checkbox
                        checked={selectedSectors.includes(s)}
                        onCheckedChange={() => toggleSector(s)}
                      />
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: sectorColors[s] }} />
                      {s}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            {/* Rayon km (si activé) */}
            {radiusEnabled && (
              <div className="flex items-center gap-2 rounded-lg border bg-primary/5 px-3 py-1.5">
                <Navigation className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">{radiusKm} km</span>
                <Slider
                  value={[radiusKm]}
                  onValueChange={([v]) => setRadiusKm(v)}
                  min={1}
                  max={30}
                  step={1}
                  className="w-24"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Carte + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Carte */}
        <Card className="lg:col-span-3 overflow-hidden">
          <CardContent className="p-0">
            <div className="relative w-full" style={{ height: "600px" }}>
              <MapContainer
                center={map}
                zoom={zoom}
                style={{ width: "100%", height: "100%" }}
                ref={(m) => { mapRef.current = m }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <ClickHandler onClick={handleMapClick} />

                {/* Cercle de rayon */}
                {radiusEnabled && radiusCenter && (
                  <>
                    <Circle
                      center={radiusCenter}
                      radius={radiusKm * 1000}
                      pathOptions={{
                        color: "#10b981",
                        fillColor: "#10b981",
                        fillOpacity: 0.1,
                        weight: 2,
                      }}
                    />
                    <Marker position={radiusCenter}>
                      <Popup>
                        <div className="text-xs">
                          <p className="font-semibold">Centre du rayon</p>
                          <p>{radiusKm} km de rayon</p>
                          <p className="text-muted-foreground">{filteredCompanies.length} entreprises</p>
                        </div>
                      </Popup>
                    </Marker>
                  </>
                )}

                {/* Markers ou Heatmap */}
                {viewMode === "markers" ? (
                  filteredCompanies.map((company) => (
                    <Marker
                      key={company.id}
                      position={[company.lat, company.lng]}
                      icon={createSectorIcon(company.sector, selectedCompany?.id === company.id)}
                      eventHandlers={{
                        click: () => setSelectedCompany(company),
                      }}
                    >
                      <Popup>
                        <div className="text-xs min-w-[200px]">
                          <div className="font-semibold text-sm mb-1">{company.name}</div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: sectorColors[company.sector] }}
                            />
                            <span className="text-muted-foreground">{company.sector}</span>
                          </div>
                          <p className="text-muted-foreground mb-1">{company.address}</p>
                          <p className="text-muted-foreground">{company.commune}, {company.city}</p>
                          {company.phone && <p className="mt-1">{company.phone}</p>}
                          {company.rating && (
                            <p className="mt-1 flex items-center gap-1">
                              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              {company.rating} ({company.reviewCount} avis)
                            </p>
                          )}
                          {radiusEnabled && radiusCenter && (
                            <p className="mt-1 font-medium text-emerald-600">
                              📍 {haversineDistance(radiusCenter[0], radiusCenter[1], company.lat, company.lng).toFixed(2)} km
                            </p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  ))
                ) : (
                  <HeatmapLayer points={heatPoints} radius={40} />
                )}

                <RecenterButton center={map} zoom={zoom} />
              </MapContainer>

              {/* Légende des secteurs */}
              <div className="absolute bottom-3 left-3 z-[500] rounded-lg border bg-background/95 backdrop-blur p-2.5 shadow-md max-w-[220px] max-h-[280px] overflow-y-auto">
                <p className="text-[10px] font-semibold mb-1.5 text-muted-foreground uppercase tracking-wide">
                  Secteurs ({selectedSectors.length})
                </p>
                <div className="space-y-0.5">
                  {selectedSectors.map((s) => (
                    <div key={s} className="flex items-center gap-2 text-[11px]">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: sectorColors[s] }} />
                      <span className="truncate">{s}</span>
                      <span className="ml-auto text-muted-foreground tabular-nums">
                        {filteredCompanies.filter((c) => c.sector === s).length}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats overlay */}
              <div className="absolute top-3 left-3 z-[500] rounded-lg border bg-background/95 backdrop-blur p-2.5 shadow-md">
                <div className="flex items-center gap-1.5 mb-1">
                  <Navigation className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Zone active
                  </span>
                </div>
                <p className="text-sm font-semibold">
                  {selectedCommune !== "all" ? selectedCommune : selectedCity !== "all" ? selectedCity : "Abidjan"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {stats.total} entreprises · {stats.sectors} secteurs
                </p>
              </div>

              {/* Mode indicator */}
              {viewMode === "heatmap" && (
                <div className="absolute top-3 right-14 z-[500] rounded-lg border bg-background/95 backdrop-blur px-3 py-1.5 shadow-md">
                  <span className="text-xs font-medium flex items-center gap-1.5">
                    <Flame className="h-3 w-3 text-orange-500" />
                    Mode Heatmap
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar — résultats + distance */}
        <div className="space-y-3">
          {/* Stats card */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Affichées</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">{stats.verified}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Vérifiées</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.sectors}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Secteurs</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.avgRating}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Note moy</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Entreprises les plus proches (si rayon) */}
          {radiusEnabled && radiusCenter && nearestCompanies.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Navigation className="h-4 w-4 text-primary" />
                  Plus proches ({radiusKm} km)
                </p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {nearestCompanies.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCompany(c)
                        mapRef.current?.flyTo([c.lat, c.lng], 16, { duration: 0.8 })
                      }}
                      className="w-full flex items-start gap-2 rounded-lg border p-2 hover:bg-accent/40 text-left transition-colors"
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: sectorColors[c.sector] }}
                      >
                        {c.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{c.commune}, {c.city}</p>
                        <p className="text-[10px] font-medium text-emerald-600 mt-0.5">
                          📍 {c.distance.toFixed(2)} km
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Liste des entreprises (sans rayon) */}
          {(!radiusEnabled || !radiusCenter) && (
            <Card>
              <CardContent className="p-0">
                <div className="p-3 border-b">
                  <p className="text-sm font-semibold">Entreprises ({stats.total})</p>
                </div>
                <div className="max-h-[400px] overflow-y-auto divide-y">
                  {filteredCompanies.slice(0, 20).map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCompany(c)
                        mapRef.current?.flyTo([c.lat, c.lng], 16, { duration: 0.8 })
                      }}
                      className={cn(
                        "w-full flex items-start gap-2 p-2.5 hover:bg-accent/40 text-left transition-colors",
                        selectedCompany?.id === c.id && "bg-primary/5"
                      )}
                    >
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: sectorColors[c.sector] }}
                      >
                        {c.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{c.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {c.commune} · {c.sector}
                        </p>
                        {c.rating && (
                          <p className="text-[10px] flex items-center gap-0.5 mt-0.5">
                            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                            {c.rating} ({c.reviewCount})
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("text-[9px] h-4 px-1 shrink-0", statusMeta[c.status].className)}
                      >
                        {statusMeta[c.status].label}
                      </Badge>
                    </button>
                  ))}
                  {filteredCompanies.length > 20 && (
                    <div className="p-2 text-center text-[11px] text-muted-foreground">
                      + {filteredCompanies.length - 20} autres…
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info rayon */}
          {radiusEnabled && !radiusCenter && (
            <Card>
              <CardContent className="p-4 text-center">
                <Crosshair className="h-8 w-8 mx-auto mb-2 text-primary animate-pulse" />
                <p className="text-sm font-medium">Cliquez sur la carte</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Pour définir le centre du rayon de recherche de {radiusKm} km
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
