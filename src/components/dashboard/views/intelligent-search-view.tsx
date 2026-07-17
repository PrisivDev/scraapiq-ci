"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import {
  Search as SearchIcon, Sparkles, MapPin, Building2, Phone, Star,
  Loader2, Filter, X, Clock, Zap, Brain,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface SearchHit {
  id: string
  score: number
  source: Record<string, unknown>
  highlight?: Record<string, string[]>
}

interface SearchIntent {
  sector?: string
  sectorCode?: string
  city?: string
  commune?: string
  neighborhood?: string
  keywords?: string[]
  intent: string
  confidence: number
  searchQuery: string
  method: string
  filters?: Record<string, string>
}

interface SearchResponse {
  query: string
  intent: SearchIntent
  results: SearchHit[]
  aggregations: Record<string, Array<{ key: string; count: number }>>
  suggestions: string[]
  total: number
  took: number
  stats: { docCount: number; fieldCount: number; termCount: number }
}

const exampleQueries = [
  "Restaurant Cocody",
  "Pharmacie Yopougon",
  "BTP Bouaké",
  "Hôtel Grand Bassam",
  "Clinique Abidjan",
  "Banque Plateau",
  "École Marcory",
  "Garage Abobo",
]

const sectorColors: Record<string, string> = {
  "Restauration": "#f97316",
  "Santé & Pharmacie": "#ef4444",
  "Banque & Finance": "#10b981",
  "Télécommunications": "#3b82f6",
  "BTP & Construction": "#a16207",
  "Commerce": "#8b5cf6",
  "Agro-alimentaire": "#84cc16",
  "Technologie & IT": "#06b6d4",
  "Transport & Logistique": "#f59e0b",
  "Tourisme & Hôtellerie": "#ec4899",
  "Éducation & Formation": "#6366f1",
  "Beauté & Bien-être": "#d946ef",
}

export function IntelligentSearchView() {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SearchResponse | null>(null)
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Recherche automatique avec debounce
  const performSearch = useCallback(async (q: string, filters: Record<string, string> = {}) => {
    if (!q.trim()) {
      setResult(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: q, useLLM: true, size: 30, filters }),
      })
      if (!res.ok) throw new Error("Search failed")
      const data: SearchResponse = await res.json()
      setResult(data)
    } catch (err) {
      toast.error("Erreur de recherche", { description: (err as Error).message })
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce sur la saisie
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) return
    debounceRef.current = setTimeout(() => {
      performSearch(query, activeFilters)
    }, 500)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, activeFilters, performSearch])

  // Focus initial
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleExampleClick = (example: string) => {
    setQuery(example)
    performSearch(example)
  }

  const toggleFilter = (field: string, value: string) => {
    setActiveFilters((prev) => {
      if (prev[field] === value) {
        const next = { ...prev }
        delete next[field]
        return next
      }
      return { ...prev, [field]: value }
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SearchIcon className="h-6 w-6 text-primary" />
          Recherche intelligente
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          IA + Elasticsearch · Comprend le langage naturel · 100 entreprises indexées
        </p>
      </div>

      {/* Barre de recherche */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Restaurant Cocody, Pharmacie Yopougon, BTP Bouaké…"
              className="w-full h-12 pl-11 pr-12 rounded-lg border bg-background text-base focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {loading && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />
            )}
            {query && !loading && (
              <button
                onClick={() => { setQuery(""); setResult(null) }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Exemples */}
          {!result && (
            <div className="mt-4">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Essayez ces exemples :
              </p>
              <div className="flex flex-wrap gap-2">
                {exampleQueries.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => handleExampleClick(ex)}
                    className="rounded-full border bg-muted/30 px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Intention IA détectée */}
      {result?.intent && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                <Brain className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold flex items-center gap-2">
                  Intention détectée
                  <Badge variant="outline" className="text-[10px] gap-1">
                    {result.intent.method === "llm" ? "LLM z-ai" : result.intent.method === "hybrid" ? "Hybride" : "Règles"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {Math.round(result.intent.confidence * 100)}% confiance
                  </Badge>
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {result.intent.sector && (
                    <Badge className="gap-1" style={{
                      backgroundColor: `${sectorColors[result.intent.sector] || "#64748b"}20`,
                      color: sectorColors[result.intent.sector] || "#64748b",
                    }}>
                      <Building2 className="h-3 w-3" />
                      {result.intent.sector}
                    </Badge>
                  )}
                  {result.intent.commune && (
                    <Badge variant="outline" className="gap-1">
                      <MapPin className="h-3 w-3" />
                      {result.intent.commune}
                    </Badge>
                  )}
                  {result.intent.city && (
                    <Badge variant="outline" className="gap-1">
                      <MapPin className="h-3 w-3" />
                      {result.intent.city}
                    </Badge>
                  )}
                  {result.intent.neighborhood && (
                    <Badge variant="outline" className="gap-1">
                      <MapPin className="h-3 w-3" />
                      {result.intent.neighborhood}
                    </Badge>
                  )}
                  {result.intent.intent && (
                    <Badge variant="outline" className="text-[10px]">
                      {result.intent.intent.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">
                  Requête Elasticsearch : <code className="bg-muted px-1.5 py-0.5 rounded">{result.intent.searchQuery}</code>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Résultats + Aggregations */}
      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Facets / Aggregations */}
          <div className="space-y-3">
            {Object.entries(result.aggregations).map(([field, buckets]) => (
              <Card key={field}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm capitalize flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5" />
                    {field === "sector" ? "Secteurs" : field === "city" ? "Villes" : "Communes"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {buckets.slice(0, 8).map((bucket) => (
                      <button
                        key={bucket.key}
                        onClick={() => toggleFilter(field, bucket.key)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-accent/40 transition-colors",
                          activeFilters[field] === bucket.key && "bg-primary/10"
                        )}
                      >
                        <span className="flex items-center gap-2 truncate">
                          {field === "sector" && (
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: sectorColors[bucket.key] || "#64748b" }}
                            />
                          )}
                          <span className="truncate">{bucket.key}</span>
                        </span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {bucket.count}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Liste des résultats */}
          <div className="lg:col-span-3 space-y-3">
            {/* Stats bar */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <Clock className="h-3 w-3" />
                {result.total} résultat(s) en {result.took}ms
              </span>
              <span className="flex items-center gap-2">
                <Zap className="h-3 w-3 text-primary" />
                {result.stats.docCount} docs · {result.stats.termCount} termes indexés
              </span>
            </div>

            {/* Résultats */}
            {result.results.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <SearchIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Aucun résultat pour "{result.query}"</p>
                  {result.suggestions.length > 0 && (
                    <div className="mt-3">
                      <p className="text-xs">Suggestions :</p>
                      <div className="flex flex-wrap gap-2 justify-center mt-2">
                        {result.suggestions.map((s) => (
                          <button
                            key={s}
                            onClick={() => setQuery(s)}
                            className="rounded-full border px-2 py-1 text-xs hover:bg-accent"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              result.results.map((hit) => (
                <ResultCard key={hit.id} hit={hit} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultCard({ hit }: { hit: SearchHit }) {
  const source = hit.source
  const sector = source.sector as string
  const sectorColor = sectorColors[sector] || "#64748b"
  const commune = source.commune as string | undefined
  const city = source.city as string | undefined
  const address = source.address as string | undefined
  const phone = source.phone as string | undefined
  const rating = source.rating as number | undefined
  const reviewCount = source.reviewCount as number | undefined

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Avatar coloré par secteur */}
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-white font-bold text-sm"
            style={{ backgroundColor: sectorColor }}
          >
            {(source.name as string)?.charAt(0) || "?"}
          </div>

          <div className="flex-1 min-w-0">
            {/* Nom + score */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-sm">
                  {hit.highlight?.name ? (
                    <span dangerouslySetInnerHTML={{ __html: hit.highlight.name[0] }} />
                  ) : (
                    source.name as string
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {hit.highlight?.sector ? (
                    <span dangerouslySetInnerHTML={{ __html: hit.highlight.sector[0] }} />
                  ) : (
                    sector
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
                  {hit.score.toFixed(2)}
                </Badge>
              </div>
            </div>

            {/* Localisation */}
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              {commune && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {commune}
                </span>
              )}
              {city && (
                <span>{city}</span>
              )}
              {address && (
                <span className="truncate">· {address}</span>
              )}
            </div>

            {/* Contact */}
            <div className="flex items-center gap-3 mt-2">
              {phone && (
                <span className="flex items-center gap-1 text-xs">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  {phone}
                </span>
              )}
              {rating && (
                <span className="flex items-center gap-1 text-xs">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {rating} ({reviewCount})
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
