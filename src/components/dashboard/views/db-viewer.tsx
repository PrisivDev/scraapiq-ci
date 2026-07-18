"use client"

import { useEffect, useState } from "react"
import { Database, RefreshCw, Table2, AlertCircle, Search, Eye, EyeOff } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

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

export function DbViewerView() {
  const [data, setData] = useState<DbData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showHidden, setShowHidden] = useState(false)

  const fetchData = async () => {
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
      // Sélectionne automatiquement la première table avec des données
      const firstWithData = json.data.tables.find((t: TableInfo) => t.count > 0)
      setSelectedTable(firstWithData?.name || json.data.tables[0]?.name || null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de chargement")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredTables = data?.tables.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  ) || []

  const selectedTableData = data?.tables.find((t) => t.name === selectedTable)

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
                  Si vous venez de nettoyer la DB, reconnectez-vous avec un compte OWNER.
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
            {data.summary.totalTables} tables · {data.summary.totalRows} lignes au total ·{" "}
            {data.summary.tablesWithData} table(s) avec données
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
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
              {selectedTableData && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {selectedTableData.count} ligne(s) · 5 affichées
                  </span>
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
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {selectedTableData?.error ? (
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
              </div>
            ) : selectedTableData && selectedTableData.sampleRows.length > 0 ? (
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      {Object.keys(selectedTableData.sampleRows[0]).map((col) => (
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
                                <span className="text-muted-foreground italic">null</span>
                              ) : isHidden && !shouldShow ? (
                                <span className="text-muted-foreground">•••••</span>
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
                <p className="text-sm">Sélectionnez une table pour voir son contenu</p>
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
                <strong className="text-foreground">DB Viewer</strong> — Affiche les 5 premières
                lignes de chaque table. Les champs sensibles (passwordHash, twoFactorSecret,
                backupCodes, etc.) sont masqués par défaut (cliquez sur &quot;Afficher&quot;).
              </p>
              <p>
                Accès réservé au rôle <Badge variant="outline" className="text-[10px]">OWNER</Badge>.
                Pour une édition complète, utilisez <code className="bg-muted px-1 rounded">bunx prisma studio</code>{" "}
                (port 5555, accessible en local uniquement).
              </p>
              {data.summary.totalRows === 0 && (
                <p className="text-primary font-medium pt-1">
                  ✓ Base de données vide — prête pour la production. Aucune donnée mock.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
