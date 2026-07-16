"use client"

import { Search as SearchIcon, MapPin, Tag, Building, SlidersHorizontal, X, Sparkles, Zap, Database, TrendingUp } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
import { toast } from "sonner"
import type { SearchFilters } from "@/components/dashboard/search-panel"

interface SearchViewProps {
  onSearch: (filters: SearchFilters) => void
}

export function SearchView({ onSearch }: SearchViewProps) {
  const [keyword, setKeyword] = useState("")
  const [selectedCommunes, setSelectedCommunes] = useState<string[]>(["Cocody", "Plateau"])
  const [city, setCity] = useState("Abidjan")
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])
  const [minConfidence, setMinConfidence] = useState(75)
  const [selectedSources, setSelectedSources] = useState<string[]>(["Google Maps", "Annuaire.ci"])

  const toggle = (value: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value])
  }

  const allSources = ["Google Maps", "Annuaire.ci", "Pages Jaunes", "Facebook", "RCCM", "Site Web"]

  const handleSearch = () => {
    onSearch({
      keyword,
      communes: selectedCommunes,
      city,
      sectors: selectedSectors,
      minConfidence,
      sources: selectedSources,
    })
    toast.success("Recherche lancée", {
      description: `${keyword || "Tous mots-clés"} · ${selectedCommunes.length} commune(s) · ${selectedSources.length} source(s)`,
    })
  }

  const reset = () => {
    setKeyword("")
    setSelectedCommunes([])
    setCity("Abidjan")
    setSelectedSectors([])
    setMinConfidence(75)
    setSelectedSources(["Google Maps"])
    toast.info("Filtres réinitialisés")
  }

  // Templates récents
  const templates = [
    { name: "Pharma Cocody", keyword: "pharmacie", communes: ["Cocody"], icon: "💊" },
    { name: "Banques Abidjan", keyword: "banque", communes: ["Plateau", "Cocody"], icon: "🏦" },
    { name: "Restaurants Plateau", keyword: "restaurant", communes: ["Plateau"], icon: "🍽️" },
    { name: "BTP Yopougon", keyword: "construction BTP", communes: ["Yopougon"], icon: "🏗️" },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SearchIcon className="h-6 w-6 text-primary" />
          Recherche multicritère
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Découvrez des entreprises ivoiriennes par mots-clés, zones et secteurs
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Formulaire principal */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              {/* Mot-clé */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> Mots-clés de recherche *
                </Label>
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ex: restaurant, pharmacie, agence immobilière…"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Le moteur IA va étendre automatiquement ces mots-clés (synonymes, traductions).
                </p>
              </div>

              {/* Zone */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <Building className="h-3 w-3" /> Ville
                  </Label>
                  <Select value={city} onValueChange={setCity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {cities.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" /> Communes ({selectedCommunes.length})
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        <span className="truncate">
                          {selectedCommunes.length === 0 ? "Toutes les communes" : selectedCommunes.join(", ")}
                        </span>
                        <SlidersHorizontal className="h-3.5 w-3.5 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="start">
                      <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b">
                        <span className="text-xs font-semibold">Sélectionner</span>
                        {selectedCommunes.length > 0 && (
                          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedCommunes([])}>
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
              </div>

              {/* Secteurs */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Tag className="h-3 w-3" /> Secteurs ({selectedSectors.length})
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-between font-normal">
                      <span className="truncate">
                        {selectedSectors.length === 0 ? "Tous les secteurs" : selectedSectors.join(", ")}
                      </span>
                      <SlidersHorizontal className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="flex items-center justify-between px-1 pb-2 mb-1 border-b">
                      <span className="text-xs font-semibold">Sélectionner</span>
                      {selectedSectors.length > 0 && (
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setSelectedSectors([])}>
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

              {/* Filtres avancés */}
              <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Confiance min. (IA)</Label>
                    <Badge variant="secondary" className="text-xs">{minConfidence}%</Badge>
                  </div>
                  <Slider value={[minConfidence]} onValueChange={([v]) => setMinConfidence(v)} min={0} max={100} step={5} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Sources à interroger ({selectedSources.length})</Label>
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

              {/* Estimation */}
              <div className="rounded-lg border bg-primary/5 p-3 flex items-center gap-3">
                <Zap className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 text-xs">
                  <p className="font-semibold">Estimation</p>
                  <p className="text-muted-foreground">≈ 320 entreprises · ~4 min · {selectedSources.length} sources · 0.4k API calls</p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={reset}>Réinitialiser</Button>
                <Button onClick={handleSearch} className="gap-2">
                  <SearchIcon className="h-4 w-4" />
                  Lancer la recherche
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar : templates + IA */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Templates récents</p>
              </div>
              <div className="space-y-1.5">
                {templates.map((t) => (
                  <button
                    key={t.name}
                    onClick={() => {
                      setKeyword(t.keyword)
                      setSelectedCommunes(t.communes)
                      toast.info(`Template "${t.name}" chargé`)
                    }}
                    className="w-full flex items-center gap-2 rounded-lg border p-2.5 hover:bg-accent/40 text-left transition-colors"
                  >
                    <span className="text-lg">{t.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground">{t.communes.length} commune(s)</p>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Database className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Sources disponibles</p>
              </div>
              <div className="space-y-2">
                {[
                  { name: "Google Maps", count: "48 213 enr.", color: "bg-primary" },
                  { name: "RCCM CI", count: "24 156 enr.", color: "bg-accent-foreground" },
                  { name: "Annuaire.ci", count: "18 902 enr.", color: "bg-primary" },
                  { name: "Facebook", count: "31 078 enr.", color: "bg-accent-foreground" },
                ].map((s) => (
                  <div key={s.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", s.color)} />
                      {s.name}
                    </span>
                    <span className="text-muted-foreground">{s.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Conseils IA</p>
              </div>
              <ul className="space-y-2 text-[11px] text-muted-foreground">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  Combinez 2-3 sources pour maximiser la couverture
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  Utilisez des mots-clés spécifiques (ex: "pharmacie" plutôt que "santé")
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  La déduplication IA fusionne automatiquement les doublons
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
