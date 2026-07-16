"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe2,
  MapPin,
  Clock,
  Loader2,
  Trash2,
  RefreshCw,
  MonitorSmartphone,
  ShieldAlert,
} from "lucide-react"

import { Button } from "@/components/ui/button"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { AccountLayout } from "@/components/auth/auth-layout"

interface Session {
  id: string
  device: string
  ip: string
  location: string
  userAgent: string
  lastSeenAt: string
  createdAt: string
  expiresAt: string
  current: boolean
}

function detectDeviceType(ua: string): "mobile" | "tablet" | "desktop" {
  if (!ua) return "desktop"
  const lower = ua.toLowerCase()
  if (/ipad|tablet|playbook|silk/.test(lower)) return "tablet"
  if (/mobile|iphone|ipod|android.*mobile|windows phone/.test(lower)) return "mobile"
  return "desktop"
}

function DeviceIcon({ ua, className }: { ua: string; className?: string }) {
  const type = detectDeviceType(ua)
  const Icon = type === "mobile" ? Smartphone : type === "tablet" ? Tablet : Monitor
  return <Icon className={className} />
}

function formatDate(iso?: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    })
  } catch {
    return iso
  }
}

function relativeTime(iso?: string | null) {
  if (!iso) return "—"
  const d = new Date(iso).getTime()
  const now = Date.now()
  const sec = Math.floor((now - d) / 1000)
  if (sec < 60) return "à l'instant"
  const min = Math.floor(sec / 60)
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const days = Math.floor(h / 24)
  return `il y a ${days} j`
}

export default function SessionsPage() {
  const router = useRouter()
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [loading, setLoading] = React.useState(true)
  const [revokingId, setRevokingId] = React.useState<string | null>(null)
  const [revokingAll, setRevokingAll] = React.useState(false)
  const [revokeAllOpen, setRevokeAllOpen] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/sessions", { credentials: "include" })
      if (res.status === 401) {
        router.replace("/auth/login?redirect=/account/sessions")
        return
      }
      if (!res.ok) {
        toast.error("Impossible de charger les sessions")
        return
      }
      const data = await res.json()
      setSessions(data.sessions || [])
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false)
    }
  }, [router])

  React.useEffect(() => {
    // Auth guard first
    fetch("/api/me", { credentials: "include" }).then((r) => {
      if (r.status === 401) {
        router.replace("/auth/login?redirect=/account/sessions")
        return
      }
      load()
    })
  }, [load, router])

  const handleRevoke = async (id: string) => {
    setRevokingId(id)
    try {
      const res = await fetch(`/api/sessions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success("Session révoquée")
        setSessions((prev) => prev.filter((s) => s.id !== id))
      } else {
        toast.error(data.error || "Échec de la révocation")
      }
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setRevokingId(null)
    }
  }

  const handleRevokeAll = async () => {
    setRevokingAll(true)
    try {
      const res = await fetch("/api/sessions?all=true", {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast.success("Toutes les sessions ont été révoquées", {
          description: "Vous allez être redirigé vers la page de connexion.",
        })
        setTimeout(() => router.push("/auth/login"), 1200)
      } else {
        toast.error(data.error || "Échec de la révocation globale")
      }
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setRevokingAll(false)
      setRevokeAllOpen(false)
    }
  }

  const currentSession = sessions.find((s) => s.current)
  const otherSessions = sessions.filter((s) => !s.current)

  return (
    <AccountLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MonitorSmartphone className="h-6 w-6 text-primary" />
              Sessions actives
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Appareils et navigateurs connectés à votre compte ScrapIQ CI.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={load}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevokeAllOpen(true)}
              disabled={loading || sessions.length === 0}
              className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              Tout révoquer
            </Button>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="space-y-3 py-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              ))}
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 flex flex-col items-center text-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MonitorSmartphone className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Aucune session active</p>
                <p className="text-sm text-muted-foreground">
                  Aucune session enregistrée pour le moment.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/account/security">← Retour à la sécurité</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Desktop: table */}
            <Card className="hidden md:block">
              <CardHeader>
                <CardTitle className="text-base">
                  {sessions.length} session{sessions.length > 1 ? "s" : ""} active{sessions.length > 1 ? "s" : ""}
                </CardTitle>
                <CardDescription>
                  Les sessions expirent automatiquement après 30 jours d'inactivité.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6 w-[40px]"></TableHead>
                      <TableHead>Appareil</TableHead>
                      <TableHead>Adresse IP</TableHead>
                      <TableHead>Localisation</TableHead>
                      <TableHead>Dernière activité</TableHead>
                      <TableHead className="text-right pr-6">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((s) => (
                      <TableRow key={s.id} className={s.current ? "bg-primary/5" : ""}>
                        <TableCell className="pl-6">
                          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                            <DeviceIcon ua={s.userAgent} className="h-4 w-4" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{s.device || "Appareil inconnu"}</span>
                            <span className="text-xs text-muted-foreground line-clamp-1 max-w-[280px]">
                              {s.userAgent}
                            </span>
                          </div>
                          {s.current && (
                            <Badge variant="default" className="mt-1 text-[10px] py-0">
                              Session actuelle
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{s.ip || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {s.location ? (
                            <span className="inline-flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {s.location}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {relativeTime(s.lastSeenAt)}
                          </div>
                          <div className="text-[10px] mt-0.5">
                            Expire le {formatDate(s.expiresAt)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          {s.current ? (
                            <Badge variant="outline" className="text-xs">Actuelle</Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRevoke(s.id)}
                              disabled={revokingId === s.id}
                              className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                            >
                              {revokingId === s.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              Révoquer
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-3">
              <p className="text-xs text-muted-foreground px-1">
                {sessions.length} session{sessions.length > 1 ? "s" : ""} active{sessions.length > 1 ? "s" : ""}
              </p>
              {sessions.map((s) => (
                <Card key={s.id}>
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                          <DeviceIcon ua={s.userAgent} className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{s.device || "Appareil inconnu"}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{s.userAgent}</p>
                        </div>
                      </div>
                      {s.current && (
                        <Badge variant="default" className="text-[10px]">Actuelle</Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Adresse IP</p>
                        <p className="font-mono">{s.ip || "—"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Localisation</p>
                        <p className="inline-flex items-center gap-1">
                          <Globe2 className="h-3 w-3" />
                          {s.location || "—"}
                        </p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Dernière activité</p>
                        <p className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {relativeTime(s.lastSeenAt)}
                        </p>
                      </div>
                    </div>
                    {!s.current && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRevoke(s.id)}
                        disabled={revokingId === s.id}
                        className="w-full gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        {revokingId === s.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Révoquer cette session
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {currentSession && otherSessions.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Vous êtes actuellement connecté sur la session <span className="font-medium text-foreground">« {currentSession.device || "cet appareil"} »</span>.
              </p>
            )}
          </>
        )}
      </div>

      {/* Revoke-all confirmation dialog */}
      <Dialog open={revokeAllOpen} onOpenChange={setRevokeAllOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Révoquer toutes les sessions ?
            </DialogTitle>
            <DialogDescription>
              Vous serez déconnecté de <strong>tous</strong> vos appareils, y compris celui-ci.
              Vous devrez vous reconnecter pour continuer à utiliser ScrapIQ CI.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeAllOpen(false)} disabled={revokingAll}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevokeAll}
              disabled={revokingAll}
              className="gap-2"
            >
              {revokingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Tout révoquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccountLayout>
  )
}
