"use client"

import { useState, useCallback, useEffect } from "react"
import {
  Download, FileSpreadsheet, FileText, FileJson, FileArchive, File,
  CheckCircle2, Loader2, XCircle, Filter, Columns, Settings, Eye,
  Building2, Clock, HardDrive, Zap, RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { DEFAULT_COLUMNS, type ExportColumn, type ExportFormat, type ExportFilters } from "@/lib/export/types"

interface ExportJobInfo {
  id: string
  format: string
  filename: string
  status: "queued" | "processing" | "completed" | "failed"
  progress: number
  totalRows: number
  fileSizeBytes?: number
  createdAt: string
  completedAt?: string
  downloadUrl?: string
}

const formatIcons: Record<ExportFormat, React.ElementType> = {
  xlsx: FileSpreadsheet,
  csv: FileText,
  pdf: File,
  json: FileJson,
  zip: FileArchive,
}

const formatColors: Record<ExportFormat, string> = {
  xlsx: "bg-emerald-500/10 text-emerald-600",
  csv: "bg-orange-500/10 text-orange-600",
  pdf: "bg-red-500/10 text-red-600",
  json: "bg-blue-500/10 text-blue-600",
  zip: "bg-violet-500/10 text-violet-600",
}

const formatLabels: Record<ExportFormat, string> = {
  xlsx: "Excel",
  csv: "CSV",
  pdf: "PDF",
  json: "JSON",
  zip: "ZIP",
}

const availableSectors = [
  "Restauration", "Banque & Finance", "Télécommunications", "BTP & Construction",
  "Commerce", "Santé & Pharmacie", "Agro-alimentaire", "Technologie & IT",
  "Transport & Logistique", "Tourisme & Hôtellerie", "Éducation & Formation", "Beauté & Bien-être",
]

const availableCities = ["Abidjan", "Bouaké", "Yamoussoukro", "San-Pédro", "Korhogo", "Daloa", "Grand-Bassam"]

const availableCommunes = ["Cocody", "Plateau", "Yopougon", "Marcory", "Treichville", "Koumassi", "Abobo", "Adjamé"]

export function ExportEngineView() {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("xlsx")
  const [columns, setColumns] = useState<ExportColumn[]>(DEFAULT_COLUMNS)
  const [filters, setFilters] = useState<ExportFilters>({})
  const [includeGps, setIncludeGps] = useState(false)
  const [includeSocials, setIncludeSocials] = useState(false)
  const [includeSources, setIncludeSources] = useState(false)
  const [filename, setFilename] = useState("")
  const [zipFormats, setZipFormats] = useState<ExportFormat[]>(["xlsx", "csv", "json"])
  const [currentJob, setCurrentJob] = useState<ExportJobInfo | null>(null)
  const [exportHistory, setExportHistory] = useState<ExportJobInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)

  // Polling du job courant
  const pollJob = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/export/${jobId}`, { credentials: "include" })
      if (!res.ok) return
      const data: ExportJobInfo = await res.json()
      setCurrentJob(data)

      if (data.status === "running" || data.status === "processing" || data.status === "queued") {
        setTimeout(() => pollJob(jobId), 800)
      } else if (data.status === "completed") {
        toast.success("Export terminé !", {
          description: `${data.filename} · ${data.totalRows} lignes · ${formatBytes(data.fileSizeBytes || 0)}`,
          action: {
            label: "Télécharger",
            onClick: () => window.open(`/api/export/${jobId}?download=true`, "_blank"),
          },
        })
      } else if (data.status === "failed") {
        toast.error("Export échoué")
      }
    } catch {
      // ignore
    }
  }, [])

  // Lancement de l'export
  const launchExport = async () => {
    setLoading(true)
    try {
      const endpoint = bulkMode ? "/api/export/bulk" : "/api/export"
      const body = bulkMode
        ? { formats: zipFormats, columns, filters, filename }
        : { format: selectedFormat, columns, filters, includeGps, includeSocials, includeSources, filename, zipFormats }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })

      if (!res.ok) throw new Error("Failed to launch export")
      const data = await res.json()

      toast.info("Export lancé", { description: data.message })
      pollJob(data.jobId)
      refreshHistory()
    } catch (err) {
      toast.error("Erreur", { description: (err as Error).message })
    } finally {
      setLoading(false)
    }
  }

  // Historique
  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/export", { credentials: "include" })
      if (!res.ok) return
      const data = await res.json()
      setExportHistory(data.jobs || [])
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  const toggleColumn = (key: string) => {
    setColumns((prev) => prev.map((c) => c.key === key ? { ...c, selected: !c.selected } : c))
  }

  const toggleArrayFilter = (field: "sectors" | "communes" | "cities", value: string) => {
    setFilters((prev) => {
      const current = prev[field] || []
      return {
        ...prev,
        [field]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      }
    })
  }

  const selectedColumnsCount = columns.filter((c) => c.selected).length
  const activeFiltersCount = [
    filters.sectors?.length, filters.communes?.length, filters.cities?.length,
    filters.minRating, filters.hasPhone, filters.hasEmail, filters.hasWebsite,
  ].filter(Boolean).length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Download className="h-6 w-6 text-primary" />
            Moteur d'export
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Excel · CSV · PDF · JSON · ZIP · Sélection personnalisée · Filtres · Export massif
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={refreshHistory}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Configuration (2 colonnes) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mode + Format */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                Format d'export
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Toggle mode bulk */}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={bulkMode}
                  onCheckedChange={(c) => setBulkMode(c === true)}
                />
                <Label className="text-sm cursor-pointer" onClick={() => setBulkMode(!bulkMode)}>
                  Export massif (multi-formats dans un ZIP)
                </Label>
              </div>

              {/* Formats */}
              {!bulkMode ? (
                <div className="grid grid-cols-5 gap-2">
                  {(["xlsx", "csv", "pdf", "json", "zip"] as ExportFormat[]).map((fmt) => {
                    const Icon = formatIcons[fmt]
                    const isSelected = selectedFormat === fmt
                    return (
                      <button
                        key={fmt}
                        onClick={() => setSelectedFormat(fmt)}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-lg border p-3 transition-all",
                          isSelected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "hover:bg-accent/40"
                        )}
                      >
                        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", formatColors[fmt])}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-xs font-medium">{formatLabels[fmt]}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs">Formats à inclure dans le ZIP</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["xlsx", "csv", "pdf", "json"] as ExportFormat[]).map((fmt) => {
                      const isSelected = zipFormats.includes(fmt)
                      const Icon = formatIcons[fmt]
                      return (
                        <button
                          key={fmt}
                          onClick={() => setZipFormats((prev) =>
                            prev.includes(fmt) ? prev.filter((f) => f !== fmt) : [...prev, fmt]
                          )}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all",
                            isSelected ? "border-primary bg-primary/5" : "hover:bg-accent/40"
                          )}
                        >
                          <Icon className={cn("h-4 w-4", isSelected && formatColors[fmt].split(" ")[1])} />
                          {formatLabels[fmt]}
                          {isSelected && <CheckCircle2 className="h-3 w-3 text-primary" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Nom du fichier */}
              <div className="space-y-1.5">
                <Label className="text-xs">Nom du fichier (optionnel)</Label>
                <Input
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  placeholder="export_entreprises_2026"
                  className="h-9"
                />
              </div>
            </CardContent>
          </Card>

          {/* Sélection des colonnes */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Columns className="h-4 w-4 text-primary" />
                  Colonnes ({selectedColumnsCount}/{columns.length})
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setColumns(columns.map((c) => ({ ...c, selected: true })))}>
                    Tout sélectionner
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setColumns(columns.map((c) => ({ ...c, selected: false })))}>
                    Tout désélectionner
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {columns.map((col) => (
                  <label
                    key={col.key}
                    className={cn(
                      "flex items-center gap-2 rounded-md border p-2 text-xs cursor-pointer hover:bg-accent/40 transition-colors",
                      col.selected && "bg-primary/5 border-primary/30"
                    )}
                  >
                    <Checkbox
                      checked={col.selected}
                      onCheckedChange={() => toggleColumn(col.key)}
                    />
                    {col.label}
                  </label>
                ))}
              </div>

              <Separator className="my-3" />

              {/* Options avancées */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={includeGps} onCheckedChange={(c) => setIncludeGps(c === true)} />
                  Inclure coordonnées GPS
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={includeSocials} onCheckedChange={(c) => setIncludeSocials(c === true)} />
                  Inclure réseaux sociaux
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={includeSources} onCheckedChange={(c) => setIncludeSources(c === true)} />
                  Inclure sources
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Filtres */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4 text-primary" />
                Filtres {activeFiltersCount > 0 && <Badge className="ml-1">{activeFiltersCount}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Secteurs */}
              <div>
                <Label className="text-xs mb-2 block">Secteurs ({filters.sectors?.length || 0})</Label>
                <div className="flex flex-wrap gap-1.5">
                  {availableSectors.map((s) => (
                    <button
                      key={s}
                      onClick={() => toggleArrayFilter("sectors", s)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                        filters.sectors?.includes(s) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Villes */}
              <div>
                <Label className="text-xs mb-2 block">Villes ({filters.cities?.length || 0})</Label>
                <div className="flex flex-wrap gap-1.5">
                  {availableCities.map((c) => (
                    <button
                      key={c}
                      onClick={() => toggleArrayFilter("cities", c)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                        filters.cities?.includes(c) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Communes */}
              <div>
                <Label className="text-xs mb-2 block">Communes ({filters.communes?.length || 0})</Label>
                <div className="flex flex-wrap gap-1.5">
                  {availableCommunes.map((c) => (
                    <button
                      key={c}
                      onClick={() => toggleArrayFilter("communes", c)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                        filters.communes?.includes(c) ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Filtres booléens */}
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={filters.hasPhone || false}
                    onCheckedChange={(c) => setFilters({ ...filters, hasPhone: c === true ? true : undefined })}
                  />
                  Avec téléphone
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={filters.hasEmail || false}
                    onCheckedChange={(c) => setFilters({ ...filters, hasEmail: c === true ? true : undefined })}
                  />
                  Avec email
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={filters.hasWebsite || false}
                    onCheckedChange={(c) => setFilters({ ...filters, hasWebsite: c === true ? true : undefined })}
                  />
                  Avec site web
                </label>
              </div>

              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setFilters({})}>
                  Réinitialiser les filtres
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar : progression + historique */}
        <div className="space-y-4">
          {/* Job courant */}
          {currentJob && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  {currentJob.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  ) : currentJob.status === "failed" ? (
                    <XCircle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  )}
                  Export en cours
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Fichier</p>
                  <p className="text-sm font-medium truncate">{currentJob.filename}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">Lignes</p>
                    <p className="font-semibold">{currentJob.totalRows}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Taille</p>
                    <p className="font-semibold">{formatBytes(currentJob.fileSizeBytes || 0)}</p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Progression</span>
                    <span className="font-medium">{currentJob.progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        currentJob.status === "failed" ? "bg-red-500" : "bg-primary"
                      )}
                      style={{ width: `${currentJob.progress}%` }}
                    />
                  </div>
                </div>
                {currentJob.status === "completed" && currentJob.downloadUrl && (
                  <Button className="w-full gap-2" onClick={() => window.open(currentJob.downloadUrl!, "_blank")}>
                    <Download className="h-4 w-4" />
                    Télécharger
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Bouton de lancement */}
          <Button
            size="lg"
            className="w-full gap-2 h-12"
            onClick={launchExport}
            disabled={loading || (bulkMode && zipFormats.length === 0) || selectedColumnsCount === 0}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
            {bulkMode ? `Exporter ${zipFormats.length} formats (ZIP)` : `Exporter en ${formatLabels[selectedFormat]}`}
          </Button>

          {/* Stats rapides */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-2xl font-bold">{selectedColumnsCount}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Colonnes</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeFiltersCount}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Filtres actifs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Historique */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Historique ({exportHistory.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[300px] overflow-y-auto divide-y">
                {exportHistory.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    Aucun export pour le moment
                  </div>
                ) : (
                  exportHistory.map((job) => {
                    const Icon = formatIcons[job.format as ExportFormat] || File
                    return (
                      <div key={job.id} className="flex items-center gap-2 p-2.5 hover:bg-accent/40 transition-colors">
                        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", formatColors[job.format as ExportFormat] || "bg-muted")}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{job.filename}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{job.totalRows} lignes</span>
                            <span>·</span>
                            <span>{formatBytes(job.fileSizeBytes || 0)}</span>
                          </div>
                        </div>
                        {job.status === "completed" && job.downloadUrl ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => window.open(job.downloadUrl!, "_blank")}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        ) : job.status === "processing" ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                        ) : job.status === "failed" ? (
                          <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
                        ) : null}
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "—"
  const k = 1024
  const sizes = ["o", "Ko", "Mo", "Go"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}
