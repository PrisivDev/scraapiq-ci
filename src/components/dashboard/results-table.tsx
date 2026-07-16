"use client"

import { useState, useMemo } from "react"
import {
  Download,
  ExternalLink,
  Eye,
  Phone,
  Mail,
  Globe,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Copy,
  Filter,
  ArrowUpDown,
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { companies, type Company, type CompanyStatus } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface ResultsTableProps {
  onSelectCompany: (c: Company) => void
  highlightedId?: string
  onExport: () => void
}

const statusMeta: Record<
  CompanyStatus,
  { label: string; icon: React.ElementType; className: string }
> = {
  verified: {
    label: "Vérifié",
    icon: CheckCircle2,
    className: "bg-primary/10 text-primary border-primary/20",
  },
  enriched: {
    label: "Enrichi",
    icon: Sparkles,
    className: "bg-accent/20 text-accent-foreground border-accent/30",
  },
  partial: {
    label: "Partiel",
    icon: AlertCircle,
    className: "bg-muted text-muted-foreground border-border",
  },
  duplicate: {
    label: "Doublon",
    icon: Copy,
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
}

type SortKey = "name" | "confidence" | "commune" | "sector"

export function ResultsTable({ onSelectCompany, highlightedId, onExport }: ResultsTableProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [sortKey, setSortKey] = useState<SortKey>("confidence")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const filtered = useMemo(() => {
    let result = companies.filter((c) => {
      const matchSearch =
        !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.sector.toLowerCase().includes(search.toLowerCase()) ||
        c.commune.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === "all" || c.status === statusFilter
      return matchSearch && matchStatus
    })

    result = [...result].sort((a, b) => {
      let cmp = 0
      if (sortKey === "name") cmp = a.name.localeCompare(b.name)
      else if (sortKey === "confidence") cmp = a.confidence - b.confidence
      else if (sortKey === "commune") cmp = a.commune.localeCompare(b.commune)
      else if (sortKey === "sector") cmp = a.sector.localeCompare(b.sector)
      return sortDir === "asc" ? cmp : -cmp
    })

    return result
  }, [search, statusFilter, sortKey, sortDir])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const copyContact = (value: string, label: string) => {
    navigator.clipboard.writeText(value)
    toast.success(`${label} copié`)
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 p-4 border-b">
          <div className="flex items-center gap-2 mr-2">
            <h3 className="font-semibold text-base">Résultats</h3>
            <Badge variant="secondary" className="text-xs">
              {filtered.length} / {companies.length}
            </Badge>
          </div>

          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filtrer dans les résultats…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="verified">Vérifié</SelectItem>
              <SelectItem value="enriched">Enrichi</SelectItem>
              <SelectItem value="partial">Partiel</SelectItem>
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9 gap-2" onClick={onExport}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exporter Excel</span>
              <span className="sm:hidden">Excel</span>
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="max-h-[440px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-[26%]">
                  <button
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("name")}
                  >
                    Entreprise
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </TableHead>
                <TableHead className="w-[14%]">
                  <button
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("sector")}
                  >
                    Secteur
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("commune")}
                  >
                    Commune
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </TableHead>
                <TableHead>Coordonnées</TableHead>
                <TableHead>Sources</TableHead>
                <TableHead>
                  <button
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => toggleSort("confidence")}
                  >
                    Confiance
                    <ArrowUpDown className="h-3 w-3 opacity-50" />
                  </button>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const meta = statusMeta[c.status]
                const StatusIcon = meta.icon
                const isHighlighted = highlightedId === c.id
                return (
                  <TableRow
                    key={c.id}
                    className={cn(
                      "cursor-pointer transition-colors",
                      isHighlighted && "bg-primary/5"
                    )}
                    onClick={() => onSelectCompany(c)}
                  >
                    <TableCell>
                      <div className="flex items-start gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{c.name}</p>
                          <p className="text-[11px] text-muted-foreground">{c.rccm}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{c.sector}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium">{c.commune}</span>
                        <span className="text-[11px] text-muted-foreground">{c.city}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            copyContact(c.phone, "Téléphone")
                          }}
                          className="flex items-center gap-1.5 text-[11px] hover:text-primary"
                        >
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          {c.phone}
                        </button>
                        {c.email && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              copyContact(c.email, "Email")
                            }}
                            className="flex items-center gap-1.5 text-[11px] hover:text-primary truncate"
                          >
                            <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{c.email}</span>
                          </button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[120px]">
                        {c.sources.slice(0, 2).map((s) => (
                          <Badge key={s} variant="outline" className="text-[9px] px-1 py-0 h-4">
                            {s}
                          </Badge>
                        ))}
                        {c.sources.length > 2 && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                            +{c.sources.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full",
                              c.confidence >= 95
                                ? "bg-primary"
                                : c.confidence >= 85
                                ? "bg-accent-foreground"
                                : "bg-muted-foreground"
                            )}
                            style={{ width: `${c.confidence}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-medium tabular-nums">
                          {c.confidence}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] gap-1 h-5", meta.className)}
                        >
                          <StatusIcon className="h-2.5 w-2.5" />
                          {meta.label}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectCompany(c)
                          }}
                          aria-label="Voir détails"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    Aucune entreprise ne correspond à vos critères.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
