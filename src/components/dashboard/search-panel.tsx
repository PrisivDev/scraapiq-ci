"use client"

import { useState } from "react"
import { Search, MapPin, Tag, Building, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { communes, sectors, cities } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

interface SearchPanelProps {
  onSearch: (filters: SearchFilters) => void
}

export interface SearchFilters {
  keyword: string
  communes: string[]
  city: string
  sectors: string[]
  minConfidence: number
  sources: string[]
}

const allSources = ["Google Maps", "Annuaire.ci", "Pages Jaunes", "Facebook", "RCCM", "Site Web"]

export function SearchPanel({ onSearch }: SearchPanelProps) {
  const [keyword, setKeyword] = useState("")
  const [selectedCommunes, setSelectedCommunes] = useState<string[]>(["Cocody", "Plateau"])
  const [city, setCity] = useState("Abidjan")
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])
  const [minConfidence, setMinConfidence] = useState(75)
  const [selectedSources, setSelectedSources] = useState<string[]>(["Google Maps", "Annuaire.ci"])

  const toggle = (value: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  const handleSearch = () => {
    onSearch({
      keyword,
      communes: selectedCommunes,
      city,
      sectors: selectedSectors,
      minConfidence,
      sources: selectedSources,
    })
  }

  const reset = () => {
    setKeyword("")
    setSelectedCommunes([])
    setCity("Abidjan")
    setSelectedSectors([])
    setMinConfidence(75)
    setSelectedSources(["Google Maps"])
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Search className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-semibold text-base leading-none">Recherche multicritère</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Découvrez des entreprises ivoiriennes par mots-clés, zones et secteurs
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
        {/* Keyword */}
        <div className="md:col-span-4 space-y-1.5">
          <Label htmlFor="keyword" className="text-xs flex items-center gap-1.5">
            <Tag className="h-3 w-3" /> Mots-clés
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="keyword"
              placeholder="ex: restaurant, pharmacie, banque…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* City */}
        <div className="md:col-span-2 space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <Building className="h-3 w-3" /> Ville
          </Label>
          <Select value={city} onValueChange={setCity}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {cities.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Communes popover */}
        <div className="md:col-span-3 space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <MapPin className="h-3 w-3" /> Communes ({selectedCommunes.length})
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal">
                <span className="truncate">
                  {selectedCommunes.length === 0
                    ? "Toutes les communes"
                    : selectedCommunes.join(", ")}
                </span>
                <SlidersHorizontal className="h-3.5 w-3.5 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b">
                <span className="text-xs font-semibold">Sélectionner</span>
                {selectedCommunes.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setSelectedCommunes([])}
                  >
                    Effacer
                  </Button>
                )}
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1">
                {communes.map((c) => (
                  <label
                    key={c.name}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
                      selectedCommunes.includes(c.name) && "bg-accent/50"
                    )}
                  >
                    <Checkbox
                      checked={selectedCommunes.includes(c.name)}
                      onCheckedChange={() => toggle(c.name, selectedCommunes, setSelectedCommunes)}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Sectors popover */}
        <div className="md:col-span-3 space-y-1.5">
          <Label className="text-xs flex items-center gap-1.5">
            <Tag className="h-3 w-3" /> Secteurs ({selectedSectors.length})
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal">
                <span className="truncate">
                  {selectedSectors.length === 0
                    ? "Tous les secteurs"
                    : selectedSectors.join(", ")}
                </span>
                <SlidersHorizontal className="h-3.5 w-3.5 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b">
                <span className="text-xs font-semibold">Sélectionner</span>
                {selectedSectors.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setSelectedSectors([])}
                  >
                    Effacer
                  </Button>
                )}
              </div>
              <div className="max-h-56 overflow-y-auto space-y-1">
                {sectors.map((s) => (
                  <label
                    key={s}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent",
                      selectedSectors.includes(s) && "bg-accent/50"
                    )}
                  >
                    <Checkbox
                      checked={selectedSectors.includes(s)}
                      onCheckedChange={() => toggle(s, selectedSectors, setSelectedSectors)}
                    />
                    {s}
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Advanced row */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-8">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filtres avancés
              {(selectedSources.length !== 2 || minConfidence !== 75) && (
                <Badge className="ml-1 h-4 px-1 text-[10px]">●</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="start">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label className="text-xs">Confiance min. (IA)</Label>
                  <Badge variant="secondary" className="text-xs">{minConfidence}%</Badge>
                </div>
                <Slider
                  value={[minConfidence]}
                  onValueChange={([v]) => setMinConfidence(v)}
                  min={0}
                  max={100}
                  step={5}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Sources à interroger</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {allSources.map((s) => (
                    <label
                      key={s}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs cursor-pointer hover:bg-accent",
                        selectedSources.includes(s) && "bg-accent/50"
                      )}
                    >
                      <Checkbox
                        checked={selectedSources.includes(s)}
                        onCheckedChange={() => toggle(s, selectedSources, setSelectedSources)}
                      />
                      {s}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Active filter chips */}
        {selectedCommunes.map((c) => (
          <Badge key={`com-${c}`} variant="secondary" className="gap-1 h-7">
            <MapPin className="h-3 w-3" /> {c}
            <button onClick={() => toggle(c, selectedCommunes, setSelectedCommunes)}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {selectedSectors.map((s) => (
          <Badge key={`sec-${s}`} variant="secondary" className="gap-1 h-7">
            <Tag className="h-3 w-3" /> {s}
            <button onClick={() => toggle(s, selectedSectors, setSelectedSectors)}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={reset} className="h-8">
            Réinitialiser
          </Button>
          <Button size="sm" onClick={handleSearch} className="gap-2 h-8">
            <Search className="h-4 w-4" />
            Lancer la recherche
          </Button>
        </div>
      </div>
    </div>
  )
}
