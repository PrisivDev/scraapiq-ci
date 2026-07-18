"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Database,
  RefreshCw,
  Table2,
  AlertCircle,
  Search,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Plus,
  Loader2,
  Lock,
  Save,
  X,
} from "lucide-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface TableInfo {
  name: string
  count: number
  sampleRows: Record<string, unknown>[]
  error?: string
}

interface DbData {
  database: { provider: string; url: string }
  summary: {
    totalTables: number
    totalRows: number
    tablesWithData: number
  }
  tables: TableInfo[]
}

interface PaginatedRows {
  table: string
  columns: string[]
  rows: Record<string, unknown>[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Fields that are NEVER editable via the generic endpoint (matched on client side as preview)
const SENSITIVE_FIELDS = new Set([
  "passwordHash",
  "twoFactorSecret",
  "twoFactorBackupCodes",
  "refreshTokenHash",
  "tokenHash",
  "secret",
  "hashedKey",
  "keyHash",
  "accessToken",
  "refreshToken",
])

const BOOL_FIELDS = new Set([
  "twoFactorEnabled",
  "isActive",
  "cancelAtPeriodEnd",
  "emailVerified",
])

const DATE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "lastSeenAt",
  "usedAt",
  "revokedAt",
  "expiresAt",
  "lastLoginAt",
  "lastUsedAt",
  "invitedAt",
  "acceptedAt",
  "lastTriggeredAt",
  "lastRunAt",
  "nextRunAt",
  "startedAt",
  "completedAt",
  "sentAt",
  "deliveredAt",
  "readAt",
  "paidAt",
  "dueDate",
  "activatedAt",
  "currentPeriodStart",
  "currentPeriodEnd",
  "trialEndsAt",
  "emailVerified",
  "lockedUntil",
  "twoFactorEnabledAt",
])

function isDateField(key: string, value: unknown): boolean {
  if (DATE_FIELDS.has(key)) return true
  if (typeof value === "string") {
    // ISO date pattern
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
  }
  return false
}

export function DbViewerView() {
  const [data, setData] = useState<DbData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showHidden, setShowHidden] = useState(false)

  // Edit mode + paginated table view
  const [editMode, setEditMode] = useState(false)
  const [pageData, setPageData] = useState<PaginatedRows | null>(null)
  const [loadingRows, setLoadingRows] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 20

  // Edit/Create dialog
  const [editOpen, setEditOpen] = useState(false)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [editRowId, setEditRowId] = useState<string | null>(null) // null = creating
  const [editTable, setEditTable] = useState<string | null>(null) // captured when dialog opens (avoids races with selectedTable)
  const [savingRow, setSavingRow] = useState(false)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ id: string } | null>(null)
  const [deletingRow, setDeletingRow] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/db", { credentials: "include" })
      if (res.status === 401) {
        setError("Authentification requise. Connectez-vous en tant que OWNER.")
        return
      }
      if (res.status === 403) {
        setError("Accès refusé. Seul le rôle OWNER peut consulter la base de données.")
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json.data)
      // Only auto-select a table on the first load (when no table is selected yet).
      // On refreshes after mutations, keep the user's current selection.
      setSelectedTable((prev) => {
        if (prev) return prev
        const firstWithData = json.data.tables.find(
          (t: TableInfo) => t.count > 0
        )
        return firstWithData?.name || json.data.tables[0]?.name || null
      })
      setPage(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchRows = useCallback(
    async (table: string, p: number) => {
      setLoadingRows(true)
      try {
        const url = `/api/admin/db/${table}?page=${p}&limit=${limit}`
        const res = await fetch(url, { credentials: "include" })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || `HTTP ${res.status}`)
        }
        const json = await res.json()
        setPageData(json.data)
      } catch (e) {
        toast.error(
          `Erreur chargement lignes : ${e instanceof Error ? e.message : e}`
        )
        setPageData(null)
      } finally {
        setLoadingRows(false)
      }
    },
    []
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (selectedTable && editMode) {
      setPage(1)
      fetchRows(selectedTable, 1)
    } else {
      setPageData(null)
    }
  }, [selectedTable, editMode, fetchRows])

  const filteredTables =
    data?.tables.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase())
    ) || []

  const selectedTableData = data?.tables.find((t) => t.name === selectedTable)

  // Compute the row "id" from a record (every Prisma model has an id)
  function getRowId(row: Record<string, unknown>): string | null {
    const id = row.id
    return typeof id === "string" ? id : null
  }

  function openCreateDialog() {
    if (!selectedTable) return
    const table = selectedTable
    setEditTable(table)
    // Build empty values from pageData columns (works for non-empty tables).
    // For empty tables, we trigger a fetch of /api/admin/db/[table] to get the
    // column list from Prisma DMMF.
    const buildEmpty = (cols: string[]): Record<string, string> => {
      const empty: Record<string, string> = {}
      for (const c of cols) empty[c] = ""
      return empty
    }

    const cols = pageData?.columns || []
    if (cols.length > 0) {
      setEditValues(buildEmpty(cols))
      setEditRowId(null)
      setEditOpen(true)
      return
    }

    // Empty table — fetch columns first
    ;(async () => {
      try {
        const res = await fetch(
          `/api/admin/db/${table}?page=1&limit=1`,
          { credentials: "include" }
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        const fetchedCols: string[] = json.data?.columns || []
        if (fetchedCols.length === 0) {
          toast.error("Aucune colonne détectée pour cette table")
          return
        }
        setEditValues(buildEmpty(fetchedCols))
        setEditRowId(null)
        setEditOpen(true)
      } catch (e) {
        toast.error(
          `Impossible de charger les colonnes : ${e instanceof Error ? e.message : e}`
        )
      }
    })()
  }

  function openEditDialog(row: Record<string, unknown>) {
    const id = getRowId(row)
    if (!id) {
      toast.error("Ligne sans id — édition impossible")
      return
    }
    if (!selectedTable) return
    const values: Record<string, string> = {}
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined) values[k] = ""
      else if (typeof v === "object") values[k] = JSON.stringify(v)
      else values[k] = String(v)
    }
    setEditValues(values)
    setEditRowId(id)
    setEditTable(selectedTable)
    setEditOpen(true)
  }

  async function handleSaveRow() {
    const table = editTable || selectedTable
    if (!table) return
    setSavingRow(true)
    try {
      const body: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(editValues)) {
        // Skip id, dates, and sensitive fields on write
        if (k === "id") continue
        if (SENSITIVE_FIELDS.has(k)) continue
        if (DATE_FIELDS.has(k)) continue
        // Skip empty strings — let Prisma apply DB defaults (avoids null-violation errors on required fields)
        if (v === "") continue
        // Parse booleans
        if (BOOL_FIELDS.has(k)) {
          body[k] = v === "true" || v === "1"
          continue
        }
        // Parse numbers (best-effort)
        if (/^-?\d+$/.test(v)) body[k] = parseInt(v, 10)
        else if (/^-?\d+\.\d+$/.test(v)) body[k] = parseFloat(v)
        else body[k] = v
      }

      const url = editRowId
        ? `/api/admin/db/${table}/${editRowId}`
        : `/api/admin/db/${table}`
      const method = editRowId ? "PUT" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || json.detail || `HTTP ${res.status}`)
      }
      toast.success(
        editRowId ? "Enregistrement mis à jour" : "Enregistrement créé"
      )
      setEditOpen(false)
      // Refresh rows + summary (use the table we just saved, not the possibly-stale selectedTable)
      await fetchRows(table, page)
      await fetchData()
    } catch (e) {
      toast.error(
        `Erreur : ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setSavingRow(false)
    }
  }

  async function handleDeleteRow() {
    const table = editTable || selectedTable
    if (!table || !deleteTarget) return
    setDeletingRow(true)
    try {
      const res = await fetch(
        `/api/admin/db/${table}/${deleteTarget.id}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(json.error || json.detail || `HTTP ${res.status}`)
      }
      toast.success("Enregistrement supprimé")
      setDeleteTarget(null)
      await fetchRows(table, page)
      await fetchData()
    } catch (e) {
      toast.error(
        `Erreur : ${e instanceof Error ? e.message : String(e)}`
      )
    } finally {
      setDeletingRow(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 md:p-6">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div>
                <p className="font-semibold">{error}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Si vous venez de nettoyer la DB, reconnectez-vous avec un
                  compte OWNER.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Base de données
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Provider: <Badge variant="secondary">{data.database.provider}</Badge>
            {" · "}
            {data.summary.totalTables} tables · {data.summary.totalRows} lignes
            au total · {data.summary.tablesWithData} table(s) avec données
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
            <Switch checked={editMode} onCheckedChange={setEditMode} />
            <span className="text-xs font-medium">Mode édition</span>
          </div>
          <Button onClick={fetchData} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Liste des tables */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Table2 className="h-4 w-4" />
              Tables ({data.tables.length})
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[600px] overflow-y-auto">
              {filteredTables.map((t) => (
                <button
                  key={t.name}
                  onClick={() => setSelectedTable(t.name)}
                  className={`w-full text-left px-4 py-2.5 border-b flex items-center justify-between hover:bg-accent transition-colors ${
                    selectedTable === t.name ? "bg-accent" : ""
                  }`}
                >
                  <span className="font-mono text-sm">{t.name}</span>
                  <Badge
                    variant={t.count > 0 ? "default" : "outline"}
                    className={t.count > 0 ? "bg-primary" : ""}
                  >
                    {t.count}
                  </Badge>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Détail de la table sélectionnée */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-mono">
                {selectedTableData?.name || "Sélectionnez une table"}
              </CardTitle>
              <div className="flex items-center gap-2">
                {editMode && selectedTableData ? (
                  <>
                    <Button
                      size="sm"
                      onClick={openCreateDialog}
                      className="h-7"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Nouveau
                    </Button>
                    {pageData && pageData.pagination.totalPages > 1 && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          disabled={page <= 1 || loadingRows}
                          onClick={() => {
                            const p = Math.max(1, page - 1)
                            setPage(p)
                            fetchRows(selectedTable!, p)
                          }}
                        >
                          ←
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {page} / {pageData.pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7"
                          disabled={
                            page >= pageData.pagination.totalPages ||
                            loadingRows
                          }
                          onClick={() => {
                            const p = Math.min(
                              pageData.pagination.totalPages,
                              page + 1
                            )
                            setPage(p)
                            fetchRows(selectedTable!, p)
                          }}
                        >
                          →
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  selectedTableData && (
                    <span className="text-xs text-muted-foreground">
                      {selectedTableData.count} ligne(s) · 5 affichées
                    </span>
                  )
                )}
                {!editMode && selectedTableData && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHidden(!showHidden)}
                    className="h-7"
                  >
                    {showHidden ? (
                      <EyeOff className="h-3.5 w-3.5 mr-1" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 mr-1" />
                    )}
                    {showHidden ? "Masquer" : "Afficher"}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {editMode && selectedTableData ? (
              // Edit-mode view: paginated full rows from /api/admin/db/[table]
              loadingRows ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : pageData && pageData.rows.length > 0 ? (
                <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted z-10">
                      <tr>
                        <th className="text-left px-2 py-2 font-mono font-semibold border-b w-12">
                          Act.
                        </th>
                        {pageData.columns.map((col) => (
                          <th
                            key={col}
                            className="text-left px-3 py-2 font-mono font-semibold border-b"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageData.rows.map((row, i) => {
                        const rowId = getRowId(row)
                        return (
                          <tr
                            key={rowId || i}
                            className="border-b hover:bg-accent/50 cursor-pointer"
                            onClick={() => openEditDialog(row)}
                          >
                            <td
                              className="px-2 py-2 align-top"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => openEditDialog(row)}
                                  title="Modifier"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-destructive"
                                  onClick={() => {
                                    if (!rowId) return
                                    if (!selectedTable) return
                                    setEditTable(selectedTable)
                                    setDeleteTarget({ id: rowId })
                                  }}
                                  disabled={!rowId}
                                  title="Supprimer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                            {pageData.columns.map((col) => {
                              const val = row[col]
                              const isHidden = val === "***hidden***"
                              return (
                                <td
                                  key={col}
                                  className="px-3 py-2 font-mono align-top max-w-[200px] truncate"
                                  title={String(val ?? "")}
                                >
                                  {val === null || val === undefined ? (
                                    <span className="text-muted-foreground italic">
                                      null
                                    </span>
                                  ) : isHidden ? (
                                    <span className="text-muted-foreground">
                                      •••••
                                    </span>
                                  ) : (
                                    String(val)
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : pageData && pageData.rows.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Table2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Table vide</p>
                  <Button
                    size="sm"
                    onClick={openCreateDialog}
                    className="mt-3"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Créer le premier enregistrement
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">Aucune donnée</p>
                </div>
              )
            ) : selectedTableData?.error ? (
              <div className="text-sm text-destructive flex items-center gap-2 py-8 justify-center">
                <AlertCircle className="h-4 w-4" />
                {selectedTableData.error}
              </div>
            ) : selectedTableData && selectedTableData.count === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Table2 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Table vide</p>
                <p className="text-xs mt-1">
                  Aucune donnée — prête pour la production
                </p>
                {editMode && (
                  <Button
                    size="sm"
                    onClick={openCreateDialog}
                    className="mt-3"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Créer un enregistrement
                  </Button>
                )}
              </div>
            ) : selectedTableData && selectedTableData.sampleRows.length > 0 ? (
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      {Object.keys(selectedTableData.sampleRows[0]).map(
                        (col) => (
                          <th
                            key={col}
                            className="text-left px-3 py-2 font-mono font-semibold border-b"
                          >
                            {col}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTableData.sampleRows.map((row, i) => (
                      <tr key={i} className="border-b hover:bg-accent/50">
                        {Object.entries(row).map(([col, val]) => {
                          const isHidden = val === "***hidden***"
                          const shouldShow = isHidden ? showHidden : true
                          return (
                            <td
                              key={col}
                              className="px-3 py-2 font-mono align-top max-w-[200px] truncate"
                              title={String(val)}
                            >
                              {val === null ? (
                                <span className="text-muted-foreground italic">
                                  null
                                </span>
                              ) : isHidden && !shouldShow ? (
                                <span className="text-muted-foreground">
                                  •••••
                                </span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Database className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">
                  Sélectionnez une table pour voir son contenu
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Note d'aide */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-3 text-xs text-muted-foreground">
            <Database className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p>
                <strong className="text-foreground">DB Viewer</strong> —
                Affiche les 5 premières lignes de chaque table en lecture
                seule. Activez le{" "}
                <strong className="text-foreground">Mode édition</strong> pour
                parcourir, modifier, créer et supprimer des enregistrements
                (pagination 20/page). Les champs sensibles
                (passwordHash, twoFactorSecret, etc.) ne sont jamais
                modifiables via cette interface.
              </p>
              <p>
                Accès réservé au rôle{" "}
                <Badge variant="outline" className="text-[10px]">OWNER</Badge>.
                Toutes les mutations sont journalisées dans AuditLog.
              </p>
              {data.summary.totalRows === 0 && (
                <p className="text-primary font-medium pt-1">
                  ✓ Base de données vide — prête pour la production. Aucune
                  donnée mock.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit / Create Dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => !savingRow && setEditOpen(o)}
      >
        <DialogContent className="p-0 gap-0 max-h-[100vh] sm:max-h-[90vh] h-full sm:h-auto w-full sm:max-w-2xl flex flex-col overflow-hidden rounded-none sm:rounded-lg">
          <DialogHeader className="px-4 md:px-6 py-4 border-b sticky top-0 bg-background z-10">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Pencil className="h-4 w-4" />
              {editRowId ? "Modifier l'enregistrement" : "Nouvel enregistrement"}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {selectedTable}
              {editRowId && (
                <>
                  {" · id: "}
                  <code className="bg-muted px-1 rounded">{editRowId}</code>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3">
            {Object.entries(editValues).map(([k, v]) => {
              const isSensitive = SENSITIVE_FIELDS.has(k)
              const isId = k === "id"
              const isDate = isDateField(k, v)
              const isBool = BOOL_FIELDS.has(k)
              const locked = isSensitive || isId || isDate
              // Sensitive + id + date fields take full width (read-only),
              // other fields share 2 columns on sm+ for better density
              const isFullWidth = locked
              return (
                <div
                  key={k}
                  className={cn(
                    "grid gap-1.5 sm:gap-3 sm:items-center",
                    isFullWidth
                      ? "grid-cols-1"
                      : "grid-cols-1 sm:grid-cols-[140px_1fr]"
                  )}
                >
                  <Label className="text-xs font-mono flex items-center gap-1">
                    {locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                    {k}
                  </Label>
                  <div>
                    {isBool && !locked ? (
                      <Select
                        value={v === "true" ? "true" : "false"}
                        onValueChange={(nv) =>
                          setEditValues((p) => ({ ...p, [k]: nv }))
                        }
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="false">false</SelectItem>
                          <SelectItem value="true">true</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : isSensitive ? (
                      <Input
                        value="••••••••"
                        disabled
                        className="h-8 font-mono text-xs"
                      />
                    ) : locked ? (
                      <Input
                        value={v}
                        disabled
                        className="h-8 font-mono text-xs text-muted-foreground"
                      />
                    ) : (
                      <Input
                        value={v}
                        onChange={(e) =>
                          setEditValues((p) => ({
                            ...p,
                            [k]: e.target.value,
                          }))
                        }
                        className="h-8 font-mono text-xs"
                      />
                    )}
                  </div>
                </div>
              )
            })}
            {Object.keys(editValues).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Activez le mode édition et chargez la table pour voir les
                colonnes.
              </p>
            )}
          </div>

          <DialogFooter className="border-t bg-background px-4 md:px-6 py-3 sticky bottom-0">
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={savingRow}
            >
              <X className="h-4 w-4 mr-1" />
              Annuler
            </Button>
            <Button onClick={handleSaveRow} disabled={savingRow}>
              {savingRow ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Enregistrement…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !deletingRow && !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet enregistrement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est <strong>irréversible</strong>. L&apos;enregistrement{" "}
              <code className="bg-muted px-1 rounded">
                {deleteTarget?.id}
              </code>{" "}
              de la table{" "}
              <code className="bg-muted px-1 rounded">{selectedTable}</code>{" "}
              sera définitivement supprimé. Une trace sera conservée dans
              l&apos;AuditLog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRow}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRow}
              disabled={deletingRow}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingRow ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Suppression…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Supprimer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
