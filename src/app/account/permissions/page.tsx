"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  KeyRound,
  Loader2,
  Check,
  X,
  Shield,
  Crown,
  Users,
  Eye,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { AccountLayout } from "@/components/auth/auth-layout"

interface PermissionItem {
  key: string
  value: string
  granted: boolean
}

interface PermissionsResponse {
  permissions: PermissionItem[]
  role: string
  rolePermissions: Record<string, string[]>
  roleHierarchy: Record<string, number>
  userPermissions: string[]
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  MANAGER: "Manager",
  AGENT: "Agent",
  VIEWER: "Lecteur",
}

const ROLE_ICONS: Record<string, React.ElementType> = {
  OWNER: Crown,
  ADMIN: Shield,
  MANAGER: Users,
  AGENT: KeyRound,
  VIEWER: Eye,
}

const CATEGORY_LABELS: Record<string, string> = {
  COMPANY: "Entreprises",
  JOB: "Jobs de scraping",
  SOURCE: "Sources",
  MEMBER: "Membres & équipe",
  ORG: "Organisation",
  API_KEY: "Clés API",
  EXPORT: "Exports",
  AUDIT: "Audit",
  SESSION: "Sessions",
}

function permissionCategory(value: string): string {
  const prefix = value.split(":")[0]?.toUpperCase() || "OTHER"
  return CATEGORY_LABELS[prefix] || "Autres"
}

function permissionAction(value: string): string {
  const action = value.split(":")[1]
  if (!action) return value
  const map: Record<string, string> = {
    read: "Lire",
    create: "Créer",
    update: "Modifier",
    delete: "Supprimer",
    export: "Exporter",
    cancel: "Annuler",
    manage: "Gérer",
    invite: "Inviter",
    remove: "Retirer",
    update_role: "Changer le rôle",
    settings: "Paramètres",
    billing: "Facturation",
    revoke: "Révoquer",
  }
  return map[action] || action
}

export default function PermissionsPage() {
  const router = useRouter()
  const [data, setData] = React.useState<PermissionsResponse | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const me = await fetch("/api/me", { credentials: "include" })
        if (me.status === 401) {
          router.replace("/auth/login?redirect=/account/permissions")
          return
        }
        const res = await fetch("/api/permissions", { credentials: "include" })
        if (!active) return
        if (res.status === 401) {
          router.replace("/auth/login?redirect=/account/permissions")
          return
        }
        if (!res.ok) {
          toast.error("Impossible de charger les permissions")
          return
        }
        const json = await res.json()
        setData(json)
      } catch {
        toast.error("Erreur réseau")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [router])

  // Group permissions by category
  const grouped = React.useMemo(() => {
    if (!data) return []
    const map = new Map<string, PermissionItem[]>()
    for (const p of data.permissions) {
      const cat = permissionCategory(p.value)
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(p)
    }
    return Array.from(map.entries())
  }, [data])

  const grantedCount = data?.permissions.filter((p) => p.granted).length ?? 0
  const totalCount = data?.permissions.length ?? 0

  return (
    <AccountLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-primary" />
            Permissions & rôles
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue d'ensemble de vos droits d'accès sur la plateforme (lecture seule).
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : !data ? (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              Impossible de charger vos permissions.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Current role summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rôle actuel</CardTitle>
                <CardDescription>
                  Votre rôle détermine l'ensemble des permissions qui vous sont accordées.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {(() => {
                        const Icon = ROLE_ICONS[data.role] || KeyRound
                        return <Icon className="h-6 w-6" />
                      })()}
                    </div>
                    <div>
                      <p className="font-semibold text-lg">
                        {ROLE_LABELS[data.role] || data.role}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Niveau hiérarchique : {data.roleHierarchy[data.role] ?? "—"} / 100
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-6 text-center">
                    <div>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                        {grantedCount}
                      </p>
                      <p className="text-xs text-muted-foreground">Accordées</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-muted-foreground">
                        {totalCount - grantedCount}
                      </p>
                      <p className="text-xs text-muted-foreground">Refusées</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{totalCount}</p>
                      <p className="text-xs text-muted-foreground">Total</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Role hierarchy */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Crown className="h-4 w-4 text-primary" />
                  Hiérarchie des rôles
                </CardTitle>
                <CardDescription>
                  Les rôles supérieurs héritent des permissions des rôles inférieurs.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2">
                  {Object.entries(data.roleHierarchy)
                    .sort((a, b) => b[1] - a[1])
                    .map(([role, level]) => {
                      const Icon = ROLE_ICONS[role] || KeyRound
                      const isCurrent = role === data.role
                      return (
                        <div key={role} className="flex items-center gap-2">
                          <div
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                              isCurrent
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-muted/30"
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {ROLE_LABELS[role] || role}
                                {isCurrent && (
                                  <Badge variant="default" className="ml-2 text-[9px] py-0 px-1">
                                    Vous
                                  </Badge>
                                )}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                Niveau {level}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Permission matrix */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Permissions détaillées</CardTitle>
                <CardDescription>
                  Liste complète des permissions disponibles et leur statut pour votre compte.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {grouped.map(([category, perms]) => (
                  <div key={category} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        {category}
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        {perms.filter((p) => p.granted).length} / {perms.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {perms.map((p) => (
                        <div
                          key={p.key}
                          className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                            p.granted
                              ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                              : "border-border bg-muted/20"
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-mono text-muted-foreground truncate">
                              {p.value}
                            </span>
                            <span className="text-sm font-medium truncate">
                              {permissionAction(p.value)}
                            </span>
                          </div>
                          {p.granted ? (
                            <Badge
                              variant="outline"
                              className="text-emerald-700 border-emerald-300 bg-emerald-100/50 dark:text-emerald-400 dark:border-emerald-800 dark:bg-emerald-950/40"
                            >
                              <Check className="h-3 w-3 mr-0.5" />
                              Accordée
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <X className="h-3 w-3 mr-0.5" />
                              Refusée
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Read-only table (compact reference) */}
                <div className="pt-4 border-t">
                  <details className="group">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors select-none">
                      Voir la matrice rôle × permission (référence)
                    </summary>
                    <div className="mt-3 overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Permission</TableHead>
                            {Object.keys(data.roleHierarchy).map((role) => (
                              <TableHead key={role} className="text-center">
                                {role}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.permissions.map((p) => (
                            <TableRow key={p.key}>
                              <TableCell className="font-mono text-xs">{p.value}</TableCell>
                              {Object.keys(data.roleHierarchy).map((role) => {
                                const granted =
                                  data.rolePermissions[role]?.includes(p.value) ?? false
                                return (
                                  <TableCell key={role} className="text-center">
                                    {granted ? (
                                      <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                                    ) : (
                                      <X className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                                    )}
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </details>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AccountLayout>
  )
}
