"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Bell,
  AlertTriangle,
  FileText,
  Mail,
  MessageSquare,
  Smartphone,
  Globe,
  Webhook,
  Inbox,
  Send,
  CheckCheck,
  RefreshCw,
  Loader2,
  Plus,
  Trash2,
  Play,
  ChevronDown,
  ChevronRight,
  Activity,
  Clock,
  Zap,
  TrendingUp,
  Building2,
  GitMerge,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  FileSpreadsheet,
  FileType,
  FileJson,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Channel = "email" | "sms" | "whatsapp" | "push" | "webhook" | "in_app"
type NotifStatus = "pending" | "sent" | "delivered" | "failed" | "read"
type Priority = "low" | "normal" | "high" | "critical"

interface Notification {
  id: string
  userId: string | null
  channel: string
  title: string
  body: string
  payload: Record<string, unknown>
  status: string
  priority: string
  recipient: string | null
  senderId: string | null
  attempts: number
  maxAttempts: number
  error: string | null
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  createdAt: string
}

interface NotificationStats {
  total: number
  byChannel: Record<string, number>
  byStatus: Record<string, number>
  byPriority: Record<string, number>
  unreadInApp: number
  failed24h: number
  sent24h: number
}

interface AlertRule {
  id: string
  name: string
  description: string | null
  metric: string
  condition: string
  threshold: number
  channels: string[]
  isActive: boolean
  lastTriggeredAt: string | null
  triggerCount: number
  cooldownMin: number
  createdAt: string
  updatedAt: string
}

interface ScheduledReport {
  id: string
  name: string
  description: string | null
  type: string
  schedule: string
  channels: string[]
  recipients: string[]
  filters: Record<string, unknown>
  format: string
  isActive: boolean
  lastRunAt: string | null
  nextRunAt: string | null
  runCount: number
  executionsCount?: number
  createdAt: string
}

interface Execution {
  id: string
  status: string
  format: string
  fileSizeBytes: number | null
  filename: string | null
  hasData: boolean
  error: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHANNEL_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  sms: MessageSquare,
  whatsapp: Smartphone,
  push: Bell,
  webhook: Webhook,
  in_app: Inbox,
}

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  push: "Push",
  webhook: "Webhook",
  in_app: "In-app",
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  sent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  delivered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  read: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
}

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  normal: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
}

const METRIC_LABELS: Record<string, string> = {
  quota_usage: "Quota API",
  scrape_failures: "Échecs scraping",
  source_degraded: "Source dégradée",
  companies_added: "Entreprises ajoutées",
  dedup_rate: "Taux déduplication",
}

const METRIC_ICONS: Record<string, React.ElementType> = {
  quota_usage: Zap,
  scrape_failures: AlertCircle,
  source_degraded: TrendingUp,
  companies_added: Building2,
  dedup_rate: GitMerge,
}

const CONDITION_LABELS: Record<string, string> = {
  gt: ">",
  lt: "<",
  gte: "≥",
  lte: "≤",
  eq: "=",
  contains: "contient",
}

const FORMAT_ICONS: Record<string, React.ElementType> = {
  pdf: FileType,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  json: FileJson,
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const isFuture = diff < 0
  const absSec = Math.abs(Math.floor(diff / 1000))
  let str: string
  if (absSec < 60) str = `${absSec}s`
  else if (absSec < 3600) str = `${Math.floor(absSec / 60)}min`
  else if (absSec < 86400) str = `${Math.floor(absSec / 3600)}h`
  else str = `${Math.floor(absSec / 86400)}j`
  return isFuture ? `dans ${str}` : str
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "-"
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function NotificationsView() {
  const [tab, setTab] = useState<"notifications" | "alerts" | "reports">(
    "notifications"
  )

  return (
    <div className="space-y-5">
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4 lg:p-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Centre de notifications</h1>
                <p className="text-sm text-muted-foreground">
                  Notifications multi-canal · Alertes automatiques · Rapports planifiés
                </p>
              </div>
            </div>
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList>
                <TabsTrigger value="notifications" className="gap-1.5">
                  <Bell className="h-3.5 w-3.5" />
                  Notifications
                </TabsTrigger>
                <TabsTrigger value="alerts" className="gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Alertes
                </TabsTrigger>
                <TabsTrigger value="reports" className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Rapports auto
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsContent value="notifications" className="mt-0">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="alerts" className="mt-0">
          <AlertsTab />
        </TabsContent>
        <TabsContent value="reports" className="mt-0">
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 1 : Notifications
// ---------------------------------------------------------------------------

function NotificationsTab() {
  const [items, setItems] = useState<Notification[]>([])
  const [stats, setStats] = useState<NotificationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [filters, setFilters] = useState({
    channel: "all",
    status: "all",
    priority: "all",
  })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: "50" })
      if (filters.channel !== "all") params.set("channel", filters.channel)
      if (filters.status !== "all") params.set("status", filters.status)
      if (filters.priority !== "all") params.set("priority", filters.priority)

      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/v1/notifications?${params}`, { credentials: "include" }),
        fetch("/api/v1/notifications/stats", { credentials: "include" }),
      ])
      const listJson = await listRes.json()
      const statsJson = await statsRes.json()
      if (listJson.success) setItems(listJson.data)
      if (statsJson.success) setStats(statsJson.data)
    } catch (e) {
      console.error(e)
      toast.error("Erreur lors du chargement")
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleSendTest = async () => {
    setSending(true)
    try {
      const res = await fetch("/api/v1/notifications/test", {
        method: "POST",
        credentials: "include",
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.message, {
          description: `${json.data.success}/${json.data.total} canaux réussis`,
        })
        fetchData()
      } else {
        toast.error(json.error || "Échec du test")
      }
    } catch (e) {
      toast.error("Erreur réseau")
    } finally {
      setSending(false)
    }
  }

  const handleMarkRead = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/notifications/${id}/read`, {
        method: "PUT",
        credentials: "include",
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Marquée comme lue")
        fetchData()
      } else {
        toast.error(json.error || "Échec")
      }
    } catch {
      toast.error("Erreur réseau")
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Total"
          value={stats?.total ?? 0}
          icon={Bell}
          color="emerald"
        />
        <StatCard
          label="Envoyées 24h"
          value={stats?.sent24h ?? 0}
          icon={Send}
          color="emerald"
        />
        <StatCard
          label="Non lues (in-app)"
          value={stats?.unreadInApp ?? 0}
          icon={Inbox}
          color="orange"
        />
        <StatCard
          label="Échecs 24h"
          value={stats?.failed24h ?? 0}
          icon={XCircle}
          color="red"
        />
      </div>

      {/* Filters + actions */}
      <Card>
        <CardContent className="p-4 flex flex-col lg:flex-row gap-3 lg:items-end">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            <div>
              <Label className="text-xs text-muted-foreground">Canal</Label>
              <Select
                value={filters.channel}
                onValueChange={(v) => setFilters((f) => ({ ...f, channel: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les canaux</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                  <SelectItem value="in_app">In-app</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Statut</Label>
              <Select
                value={filters.status}
                onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="sent">Envoyée</SelectItem>
                  <SelectItem value="delivered">Délivrée</SelectItem>
                  <SelectItem value="failed">Échouée</SelectItem>
                  <SelectItem value="read">Lue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Priorité</Label>
              <Select
                value={filters.priority}
                onValueChange={(v) => setFilters((f) => ({ ...f, priority: v }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes priorités</SelectItem>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="normal">Normale</SelectItem>
                  <SelectItem value="high">Haute</SelectItem>
                  <SelectItem value="critical">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Actualiser
            </Button>
            <Button size="sm" onClick={handleSendTest} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Envoyer test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            Notifications
            {stats?.total !== undefined && (
              <Badge variant="secondary" className="text-xs">
                {stats.total}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">
            50 dernières notifications — cliquez sur &quot;Marquer comme lue&quot; pour les in-app
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Chargement…
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Aucune notification — cliquez sur &quot;Envoyer test&quot;
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto divide-y">
              {items.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onMarkRead={handleMarkRead}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function NotificationRow({
  notification,
  onMarkRead,
}: {
  notification: Notification
  onMarkRead: (id: string) => void
}) {
  const Icon = CHANNEL_ICONS[notification.channel] || Bell
  const isUnreadInApp =
    notification.channel === "in_app" && notification.status !== "read"

  return (
    <div className="p-4 flex items-start gap-3 hover:bg-muted/30 transition-colors">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          notification.status === "failed"
            ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
            : notification.channel === "in_app"
              ? "bg-primary/10 text-primary"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
        )}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium truncate">{notification.title}</p>
          <Badge className={cn("text-[10px]", PRIORITY_COLORS[notification.priority])}>
            {notification.priority}
          </Badge>
          <Badge className={cn("text-[10px]", STATUS_COLORS[notification.status])}>
            {notification.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">
          {notification.body}
        </p>
        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(notification.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <Icon className="h-3 w-3" />
            {CHANNEL_LABELS[notification.channel] || notification.channel}
          </span>
          {notification.recipient && (
            <span className="truncate max-w-[200px]">→ {notification.recipient}</span>
          )}
          {notification.error && (
            <span className="text-red-600 dark:text-red-400 truncate">
              ⚠ {notification.error}
            </span>
          )}
        </div>
      </div>
      {isUnreadInApp && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 h-8"
          onClick={() => onMarkRead(notification.id)}
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Marquer lue
        </Button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab 2 : Alertes
// ---------------------------------------------------------------------------

const METRICS = [
  { value: "quota_usage", label: "Quota API (% utilisé)" },
  { value: "scrape_failures", label: "Échecs de scraping (nombre)" },
  { value: "source_degraded", label: "Source dégradée (1 = oui)" },
  { value: "companies_added", label: "Entreprises ajoutées (nombre)" },
  { value: "dedup_rate", label: "Taux de déduplication (%)" },
]

const CONDITIONS = [
  { value: "gt", label: "> supérieur à" },
  { value: "lt", label: "< inférieur à" },
  { value: "gte", label: "≥ supérieur ou égal" },
  { value: "lte", label: "≤ inférieur ou égal" },
  { value: "eq", label: "= égal à" },
  { value: "contains", label: "contient" },
]

const ALL_CHANNELS = ["email", "sms", "whatsapp", "push", "webhook", "in_app"]

function AlertsTab() {
  const [rules, setRules] = useState<AlertRule[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/v1/alerts", { credentials: "include" })
      const json = await res.json()
      if (json.success) setRules(json.data)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/v1/alerts/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Règle ${!isActive ? "activée" : "désactivée"}`)
        fetchData()
      }
    } catch {
      toast.error("Erreur réseau")
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer la règle "${name}" ?`)) return
    try {
      const res = await fetch(`/api/v1/alerts/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Règle supprimée")
        fetchData()
      }
    } catch {
      toast.error("Erreur réseau")
    }
  }

  const handleCheckAll = async () => {
    setChecking(true)
    try {
      const res = await fetch("/api/v1/alerts/check", {
        method: "POST",
        credentials: "include",
      })
      const json = await res.json()
      if (json.success) {
        toast.success(json.message, {
          description: `${json.data.triggered} déclenchée(s), ${json.data.skipped} en cooldown`,
        })
        fetchData()
      }
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              {rules.length} règle(s) d&apos;alerte
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Surveille les métriques en temps réel et déclenche des notifications
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Actualiser
            </Button>
            <Button variant="outline" size="sm" onClick={handleCheckAll} disabled={checking}>
              {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              Vérifier maintenant
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Nouvelle règle
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Chargement…
            </CardContent>
          </Card>
        ) : rules.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Aucune règle — créez-en une pour commencer
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => {
            const Icon = METRIC_ICONS[rule.metric] || AlertCircle
            return (
              <Card key={rule.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{rule.name}</p>
                        <Badge variant="outline" className="text-xs">
                          {METRIC_LABELS[rule.metric] || rule.metric}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {CONDITION_LABELS[rule.condition]} {rule.threshold}
                        </Badge>
                        <Badge
                          className={cn(
                            "text-xs",
                            rule.isActive
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                          )}
                        >
                          {rule.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {rule.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          Canaux :
                          {rule.channels.map((c) => {
                            const CIcon = CHANNEL_ICONS[c] || Bell
                            return (
                              <Badge
                                key={c}
                                variant="secondary"
                                className="text-[10px] gap-1"
                              >
                                <CIcon className="h-2.5 w-2.5" />
                                {CHANNEL_LABELS[c]}
                              </Badge>
                            )
                          })}
                        </span>
                        <span>Cooldown : {rule.cooldownMin} min</span>
                        <span>Déclenchements : {rule.triggerCount}</span>
                        {rule.lastTriggeredAt && (
                          <span>Dernier : {timeAgo(rule.lastTriggeredAt)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={(checked) => handleToggle(rule.id, checked)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => handleDelete(rule.id, rule.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <CreateAlertDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchData} />
    </div>
  )
}

function CreateAlertDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [metric, setMetric] = useState("quota_usage")
  const [condition, setCondition] = useState("gt")
  const [threshold, setThreshold] = useState("80")
  const [cooldownMin, setCooldownMin] = useState("30")
  const [channels, setChannels] = useState<string[]>(["in_app", "email"])
  const [saving, setSaving] = useState(false)

  const toggleChannel = (c: string) => {
    setChannels((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    )
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Le nom est requis")
      return
    }
    if (channels.length === 0) {
      toast.error("Sélectionnez au moins un canal")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/v1/alerts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          metric,
          condition,
          threshold: parseFloat(threshold),
          cooldownMin: parseInt(cooldownMin, 10),
          channels,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Règle créée avec succès")
        setName("")
        setDescription("")
        onOpenChange(false)
        onCreated()
      } else {
        toast.error(json.error || "Échec de la création")
      }
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle règle d&apos;alerte</DialogTitle>
          <DialogDescription>
            Définissez une métrique à surveiller et les canaux de notification
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <div>
            <Label htmlFor="alert-name">Nom</Label>
            <Input
              id="alert-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Quota API &gt; 90%"
            />
          </div>
          <div>
            <Label htmlFor="alert-desc">Description</Label>
            <Textarea
              id="alert-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez la condition et l'action attendue"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Métrique</Label>
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METRICS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Condition</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="alert-threshold">Seuil</Label>
              <Input
                id="alert-threshold"
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="alert-cooldown">Cooldown (min)</Label>
              <Input
                id="alert-cooldown"
                type="number"
                value={cooldownMin}
                onChange={(e) => setCooldownMin(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Canaux de notification</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5">
              {ALL_CHANNELS.map((c) => {
                const Icon = CHANNEL_ICONS[c]
                const selected = channels.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleChannel(c)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md border text-xs transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {CHANNEL_LABELS[c]}
                    {selected && <CheckCircle2 className="h-3 w-3 ml-auto" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Créer la règle
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Tab 3 : Rapports planifiés
// ---------------------------------------------------------------------------

const REPORT_TYPES = [
  { value: "daily", label: "Quotidien" },
  { value: "weekly", label: "Hebdomadaire" },
  { value: "monthly", label: "Mensuel" },
  { value: "custom", label: "Personnalisé" },
]

const REPORT_FORMATS = [
  { value: "pdf", label: "PDF" },
  { value: "xlsx", label: "Excel (.xlsx)" },
  { value: "csv", label: "CSV" },
  { value: "json", label: "JSON" },
]

const SCHEDULE_PRESETS: Record<string, string> = {
  daily: "daily:08:00",
  weekly: "weekly:mon:08:00",
  monthly: "monthly:01:08:00",
  custom: "daily:08:00",
}

function ReportsTab() {
  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [executions, setExecutions] = useState<Record<string, Execution[]>>({})
  const [running, setRunning] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/v1/reports", { credentials: "include" })
      const json = await res.json()
      if (json.success) setReports(json.data)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRun = async (id: string, name: string) => {
    setRunning(id)
    try {
      const res = await fetch(`/api/v1/reports/${id}/run`, {
        method: "POST",
        credentials: "include",
      })
      const json = await res.json()
      if (json.success) {
        toast.success(`Rapport généré : ${name}`, {
          description: `${json.data.execution.filename} · ${formatBytes(json.data.execution.fileSizeBytes)}`,
        })
        fetchData()
        // Refresh executions
        if (expandedId === id) {
          fetchExecutions(id)
        }
      } else {
        toast.error(json.error || "Échec de la génération")
      }
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setRunning(null)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer le rapport "${name}" ?`)) return
    try {
      const res = await fetch(`/api/v1/reports/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Rapport supprimé")
        fetchData()
      }
    } catch {
      toast.error("Erreur réseau")
    }
  }

  const fetchExecutions = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/reports/${id}/executions?limit=10`, {
        credentials: "include",
      })
      const json = await res.json()
      if (json.success) {
        setExecutions((prev) => ({ ...prev, [id]: json.data }))
      }
    } catch {
      /* ignore */
    }
  }

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
    } else {
      setExpandedId(id)
      fetchExecutions(id)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              {reports.length} rapport(s) planifié(s)
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Génération automatique (Excel, CSV, PDF, JSON) — envoyé par email/webhook
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Actualiser
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Nouveau rapport
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {loading ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              Chargement…
            </CardContent>
          </Card>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
              Aucun rapport planifié
            </CardContent>
          </Card>
        ) : (
          reports.map((report) => {
            const FIcon = FORMAT_ICONS[report.format] || FileText
            const isExpanded = expandedId === report.id
            const execs = executions[report.id] || []
            return (
              <Card key={report.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{report.name}</p>
                        <Badge variant="outline" className="text-xs uppercase">
                          {report.type}
                        </Badge>
                        <Badge variant="outline" className="text-xs uppercase">
                          {report.format}
                        </Badge>
                        <Badge
                          className={cn(
                            "text-xs",
                            report.isActive
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                          )}
                        >
                          {report.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </div>
                      {report.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {report.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {report.schedule}
                        </span>
                        {report.nextRunAt && (
                          <span>Prochain : {timeAgo(report.nextRunAt)}</span>
                        )}
                        {report.lastRunAt && (
                          <span>Dernier : {timeAgo(report.lastRunAt)}</span>
                        )}
                        <span>Exécutions : {report.runCount}</span>
                        <span className="flex items-center gap-1">
                          Canaux :
                          {report.channels.map((c) => (
                            <Badge
                              key={c}
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {CHANNEL_LABELS[c] || c}
                            </Badge>
                          ))}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRun(report.id, report.name)}
                        disabled={running === report.id}
                      >
                        {running === report.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        Exécuter
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => toggleExpand(report.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => handleDelete(report.id, report.name)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5 text-primary" />
                        Historique des exécutions
                      </p>
                      {execs.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Aucune exécution</p>
                      ) : (
                        <div className="space-y-1.5 max-h-60 overflow-y-auto">
                          {execs.map((e) => (
                            <div
                              key={e.id}
                              className="flex items-center gap-2 text-xs p-2 rounded-md bg-muted/40"
                            >
                              {e.status === "completed" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              ) : e.status === "failed" ? (
                                <XCircle className="h-3.5 w-3.5 text-red-600" />
                              ) : (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              )}
                              <span className="font-mono text-[11px] truncate">
                                {e.filename || "—"}
                              </span>
                              <Badge variant="outline" className="text-[10px]">
                                {e.format}
                              </Badge>
                              <span>{formatBytes(e.fileSizeBytes)}</span>
                              <span className="text-muted-foreground">
                                {timeAgo(e.createdAt)}
                              </span>
                              {e.error && (
                                <span className="text-red-600 dark:text-red-400 truncate">
                                  ⚠ {e.error}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <CreateReportDialog open={dialogOpen} onOpenChange={setDialogOpen} onCreated={fetchData} />
    </div>
  )
}

function CreateReportDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  onCreated: () => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState("daily")
  const [schedule, setSchedule] = useState("daily:08:00")
  const [format, setFormat] = useState("pdf")
  const [channels, setChannels] = useState<string[]>(["email"])
  const [recipients, setRecipients] = useState("demo@scraapiq.ci")
  const [saving, setSaving] = useState(false)

  const toggleChannel = (c: string) => {
    setChannels((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    )
  }

  const handleTypeChange = (v: string) => {
    setType(v)
    setSchedule(SCHEDULE_PRESETS[v] || "daily:08:00")
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Le nom est requis")
      return
    }
    if (channels.length === 0) {
      toast.error("Sélectionnez au moins un canal")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/v1/reports", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          type,
          schedule,
          format,
          channels,
          recipients: recipients
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean),
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast.success("Rapport planifié créé")
        setName("")
        setDescription("")
        onOpenChange(false)
        onCreated()
      } else {
        toast.error(json.error || "Échec")
      }
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau rapport planifié</DialogTitle>
          <DialogDescription>
            Génération automatique de fichier d&apos;export à intervalle régulier
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          <div>
            <Label htmlFor="rpt-name">Nom</Label>
            <Input
              id="rpt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Rapport mensuel entreprises"
            />
          </div>
          <div>
            <Label htmlFor="rpt-desc">Description</Label>
            <Textarea
              id="rpt-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="À quoi sert ce rapport ?"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="rpt-schedule">
              Planning{" "}
              <span className="text-[10px] text-muted-foreground">
                (daily:08:00, weekly:mon:08:00, monthly:01:08:00)
              </span>
            </Label>
            <Input
              id="rpt-schedule"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="daily:08:00"
            />
          </div>
          <div>
            <Label htmlFor="rpt-recipients">Destinataires (emails, séparés par virgule)</Label>
            <Input
              id="rpt-recipients"
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="alice@ex.ci, bob@ex.ci"
            />
          </div>
          <div>
            <Label>Canaux</Label>
            <div className="grid grid-cols-3 gap-2 mt-1.5">
              {ALL_CHANNELS.map((c) => {
                const Icon = CHANNEL_ICONS[c]
                const selected = channels.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleChannel(c)}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs transition-colors",
                      selected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:bg-muted"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {CHANNEL_LABELS[c]}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Créer le rapport
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Shared StatCard
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: React.ElementType
  color: "emerald" | "orange" | "red"
}) {
  const colorClasses = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  }
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            colorClasses[color]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="text-lg font-bold leading-none">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
