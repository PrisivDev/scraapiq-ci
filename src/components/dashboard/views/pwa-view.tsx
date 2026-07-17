"use client"

import { useState, useEffect } from "react"
import {
  Download, Wifi, WifiOff, RefreshCw, Smartphone, Database,
  CheckCircle2, Loader2, CloudOff, Cloud, HardDrive, Trash2,
  Bell, BellRing, Shield, Zap,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { usePWA } from "@/lib/pwa/use-pwa"
import { getPendingActions } from "@/lib/pwa/indexeddb"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export function PWAView() {
  const pwa = usePWA()
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [pendingList, setPendingList] = useState<Array<Record<string, unknown>>>([])

  // Load pending actions
  useEffect(() => {
    getPendingActions().then((actions) => setPendingList(actions)).catch(() => {})
  }, [pwa.pendingActions])

  const handleInstall = async () => {
    const success = await pwa.install()
    if (success) {
      toast.success("Application installée !")
    } else if (!pwa.canInstall) {
      toast.info("Installation", {
        description: "Utilisez le menu de votre navigateur → 'Ajouter à l'écran d'accueil'",
      })
    }
  }

  const handleEnableNotifications = async () => {
    if (!("Notification" in window)) {
      toast.error("Notifications non supportées")
      return
    }
    const permission = await Notification.requestPermission()
    if (permission === "granted") {
      setNotificationsEnabled(true)
      toast.success("Notifications push activées")
      // Test notification
      new Notification("ScrapIQ CI", {
        body: "Notifications push activées avec succès !",
        icon: "/icon-192.png",
      })
    } else {
      toast.error("Permission refusée")
    }
  }

  const handleSync = async () => {
    toast.info("Synchronisation en cours…")
    await pwa.registerSync()
    setTimeout(() => {
      pwa.refreshStats()
      toast.success("Synchronisation terminée")
    }, 2000)
  }

  const handleClearCache = async () => {
    await pwa.clearCache()
    toast.success("Cache vidé")
    pwa.refreshStats()
  }

  const handleQueueTest = async () => {
    await pwa.queueAction({
      url: "/api/v1/companies",
      method: "POST",
      data: { name: "Test Offline Company", sector: "Technologie & IT" },
      type: "job",
    })
    toast.success("Action en file d'attente", {
      description: "Sera synchronisée quand vous serez online",
    })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Smartphone className="h-6 w-6 text-primary" />
            Progressive Web App
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Offline · Synchronisation · Notifications · Installation · IndexedDB · Cache · Background Sync
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pwa.isOnline ? (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1.5">
              <Wifi className="h-3.5 w-3.5" />
              En ligne
            </Badge>
          ) : (
            <Badge className="bg-orange-500/10 text-orange-600 border-orange-500/30 gap-1.5">
              <WifiOff className="h-3.5 w-3.5" />
              Hors ligne
            </Badge>
          )}
          {pwa.isInstalled && (
            <Badge className="bg-primary/10 text-primary border-primary/30 gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Installée
            </Badge>
          )}
        </div>
      </div>

      {/* Install banner */}
      {pwa.canInstall && !pwa.isInstalled && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
              <Download className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Installer ScrapIQ CI</p>
              <p className="text-xs text-muted-foreground">
                Accédez à l'application depuis votre écran d'accueil, même hors ligne.
              </p>
            </div>
            <Button onClick={handleInstall} className="gap-2">
              <Download className="h-4 w-4" />
              Installer
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Statut" value={pwa.isOnline ? "Online" : "Offline"} icon={pwa.isOnline ? Cloud : CloudOff} color={pwa.isOnline ? "emerald" : "orange"} />
        <StatCard label="Installation" value={pwa.isInstalled ? "Oui" : "Non"} icon={Smartphone} color={pwa.isInstalled ? "emerald" : "slate"} />
        <StatCard label="Service Worker" value={pwa.swRegistered ? "Actif" : "Inactif"} icon={Shield} color={pwa.swRegistered ? "emerald" : "slate"} />
        <StatCard label="IndexedDB" value={pwa.dbAvailable ? "OK" : "N/A"} icon={Database} color={pwa.dbAvailable ? "emerald" : "slate"} />
        <StatCard label="Actions en attente" value={String(pwa.pendingActions)} icon={RefreshCw} color={pwa.pendingActions > 0 ? "orange" : "emerald"} />
        <StatCard label="Entreprises cachées" value={String(pwa.cachedCompanies)} icon={HardDrive} color="emerald" />
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Features */}
        <div className="space-y-3">
          {/* Offline mode */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <WifiOff className="h-4 w-4 text-primary" />
                Mode hors ligne
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <FeatureRow label="Cache app shell" active={pwa.swRegistered} desc="Pages critiques mises en cache" />
              <FeatureRow label="Cache dynamique" active={pwa.swRegistered} desc="Pages visitées en cache (stale-while-revalidate)" />
              <FeatureRow label="Page offline" active={pwa.swRegistered} desc="Page dédiée quand le réseau est indisponible" />
              <FeatureRow label="Fallback API" active={pwa.swRegistered} desc="Réponses en cache pour les API" />
            </CardContent>
          </Card>

          {/* Sync */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RefreshCw className={cn("h-4 w-4 text-primary", pwa.syncStatus === "syncing" && "animate-spin")} />
                  Synchronisation
                </CardTitle>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={handleSync}>
                  <RefreshCw className="h-3 w-3" />
                  Sync maintenant
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <FeatureRow label="Background Sync" active={pwa.swRegistered} desc="Sync automatique quand le réseau revient" />
              <FeatureRow label="File d'attente" active={pwa.dbAvailable} desc={`${pwa.pendingActions} action(s) en attente`} />
              <FeatureRow label="Sync jobs" active={pwa.swRegistered} desc="Synchronisation des jobs de scraping" />
              <FeatureRow label="Sync exports" active={pwa.swRegistered} desc="Synchronisation des exports" />
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {notificationsEnabled ? <BellRing className="h-4 w-4 text-primary" /> : <Bell className="h-4 w-4 text-muted-foreground" />}
                Notifications push
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">Push notifications</p>
                  <p className="text-[10px] text-muted-foreground">
                    {notificationsEnabled ? "Activées — recevez les alertes même fermé" : "Désactivées — cliquez pour activer"}
                  </p>
                </div>
                {notificationsEnabled ? (
                  <Badge className="bg-emerald-500/10 text-emerald-600">Activé</Badge>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleEnableNotifications}>
                    Activer
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Data + Actions */}
        <div className="space-y-3">
          {/* IndexedDB */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                IndexedDB
              </CardTitle>
              <CardDescription className="text-xs">Stockage offline des données</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <DataRow label="Statut" value={pwa.dbAvailable ? "Disponible" : "Non disponible"} color={pwa.dbAvailable ? "emerald" : "slate"} />
              <DataRow label="Entreprises cachées" value={String(pwa.cachedCompanies)} />
              <DataRow label="Actions en attente" value={String(pwa.pendingActions)} color={pwa.pendingActions > 0 ? "orange" : "emerald"} />
              <DataRow label="Base" value="scraapiq-pwa v1" />
              <DataRow label="Stores" value="4 (pending-actions, cached-companies, user-preferences, pending-exports)" />
            </CardContent>
          </Card>

          {/* Cache management */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-primary" />
                  Gestion du cache
                </CardTitle>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={handleClearCache}>
                  <Trash2 className="h-3 w-3" />
                  Vider
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <DataRow label="Service Worker" value={pwa.swRegistered ? "v1 actif" : "Inactif"} color={pwa.swRegistered ? "emerald" : "slate"} />
              <DataRow label="Stratégie pages" value="Stale-while-revalidate" />
              <DataRow label="Stratégie assets" value="Cache-first" />
              <DataRow label="Stratégie API" value="Network-first (fallback cache)" />
              <DataRow label="Cache version" value="scraapiq-v1" />
            </CardContent>
          </Card>

          {/* Test actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Tests PWA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={handleQueueTest}>
                <RefreshCw className="h-3.5 w-3.5" />
                File d'attente : ajouter une action test
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={handleSync}>
                <Cloud className="h-3.5 w-3.5" />
                Déclencher la synchronisation
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={handleEnableNotifications}>
                <Bell className="h-3.5 w-3.5" />
                Envoyer une notification test
              </Button>
            </CardContent>
          </Card>

          {/* Pending actions list */}
          {pendingList.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-orange-600" />
                  Actions en attente ({pendingList.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y max-h-48 overflow-y-auto">
                  {pendingList.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 text-xs">
                      <Badge variant="outline" className="text-[9px]">{a.type as string}</Badge>
                      <span className="font-mono text-[10px] truncate">{a.method as string} {a.url as string}</span>
                      <span className="text-[9px] text-muted-foreground ml-auto">{(a.createdAt as string)?.slice(11, 19)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Responsive info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-primary" />
            Responsive & Installation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Mobile-first
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Tablet
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Desktop
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Installable (PWA)
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              manifest.json
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Service Worker
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Raccourcis (Dashboard, IA, Carte)
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Icônes 192px + 512px
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }: {
  label: string
  value: string
  icon: React.ElementType
  color: string
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/10 text-emerald-600",
    orange: "bg-orange-500/10 text-orange-600",
    slate: "bg-slate-500/10 text-slate-600",
  }
  return (
    <Card>
      <CardContent className="p-3">
        <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg mb-2", colorMap[color])}>
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-sm font-bold">{value}</p>
        <p className="text-[10px] text-muted-foreground uppercase">{label}</p>
      </CardContent>
    </Card>
  )
}

function FeatureRow({ label, active, desc }: { label: string; active: boolean; desc: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {active ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
      ) : (
        <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <span className={cn("font-medium", !active && "text-muted-foreground")}>{label}</span>
        <span className="text-[10px] text-muted-foreground ml-2">{desc}</span>
      </div>
    </div>
  )
}

function DataRow({ label, value, color }: { label: string; value: string; color?: string }) {
  const colorMap: Record<string, string> = {
    emerald: "text-emerald-600",
    orange: "text-orange-600",
    slate: "text-slate-600",
  }
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", color && colorMap[color])}>{value}</span>
    </div>
  )
}
