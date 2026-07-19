"use client"

import * as React from "react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"
import {
  Building2,
  Users,
  Calendar,
  CreditCard,
  KeyRound,
  FileText,
  ScrollText,
  Activity,
  Boxes,
  ShieldCheck,
  Loader2,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Crown,
  Shield,
  UserCog,
  User as UserIcon,
  Eye,
  Mail,
  AlertCircle,
  Hash,
  Layers,
  Gauge,
  Receipt,
  MapPin,
  UserPlus,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog as SubDialog,
  DialogContent as SubDialogContent,
  DialogHeader as SubDialogHeader,
  DialogTitle as SubDialogTitle,
  DialogDescription as SubDialogDescription,
  DialogFooter as SubDialogFooter,
} from "@/components/ui/dialog"
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
import { cn } from "@/lib/utils"

// ============================================================================
// Types — mirror the API response shape
// ============================================================================

interface OrgUser {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  status?: string
  lastLoginAt?: string | null
  createdAt?: string
  role?: string
}

interface MemberRow {
  id: string
  userId: string
  role: string
  status: string
  permissions: string[]
  invitedBy: string | null
  invitedAt: string
  acceptedAt: string | null
  user: OrgUser | null
}

interface WorkspaceRow {
  id: string
  name: string
  slug: string
  organizationId: string
  createdAt: string
  updatedAt: string
}

interface SubscriptionRow {
  id: string
  organizationId: string
  licenseId: string | null
  plan: string
  status: string
  billingCycle: string
  amountXOF: number
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  paymentMethod: string | null
  trialEndsAt: string | null
  createdAt: string
  updatedAt: string
}

interface LicenseRow {
  id: string
  key: string
  keyMasked: string
  plan: string
  name: string
  maxUsers: number
  maxCompanies: number
  maxApiCalls: number
  maxExports: number
  maxSources: number
  maxWorkspaces: number
  features: string[]
  status: string
  activatedAt: string | null
  expiresAt: string | null
  organizationId: string | null
  createdAt: string
  updatedAt: string
}

interface QuotaRow {
  id: string
  organizationId: string
  periodYear: number
  periodMonth: number
  apiCalls: number
  companiesStored: number
  exportsCount: number
  scrapeJobs: number
  usersCount: number
  updatedAt: string
}

interface InvoiceRow {
  id: string
  organizationId: string
  subscriptionId: string | null
  number: string
  amountXOF: number
  taxXOF: number
  totalXOF: number
  status: string
  dueDate: string
  paidAt: string | null
  items: unknown[]
  pdfUrl: string | null
  createdAt: string
}

interface ApiKeyRow {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
  ownerName: string | null
  ownerEmail: string | null
}

interface AuditLogRow {
  id: string
  action: string
  category: string
  severity: string
  ip: string | null
  createdAt: string
  metadata: Record<string, unknown>
  userId: string | null
  userEmail: string | null
  userName: string | null
}

interface OrganizationRow {
  id: string
  name: string
  slug: string
  plan: string
  ownerId: string
  settings: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

interface OrgStats {
  totalMembers: number
  totalMembersPending: number
  totalWorkspaces: number
  totalInvoices: number
  totalApiKeys: number
  totalCompanies: number
  memberSince: string
  daysActive: number
}

interface OrgDetailsResponse {
  organization: OrganizationRow
  owner: (OrgUser & { role?: string }) | null
  workspaces: WorkspaceRow[]
  members: MemberRow[]
  subscription: SubscriptionRow | null
  license: LicenseRow | null
  quota: QuotaRow | null
  invoices: InvoiceRow[]
  apiKeys: ApiKeyRow[]
  stats: OrgStats
  auditLogs: AuditLogRow[] | null
  currentRole: string
  canSeeAudit: boolean
}

// ============================================================================
// Helpers
// ============================================================================

function formatDate(date: string | Date | null | undefined, pattern = "d MMM yyyy"): string {
  if (!date) return "—"
  try {
    const d = typeof date === "string" ? new Date(date) : date
    if (isNaN(d.getTime())) return "—"
    return format(d, pattern, { locale: fr })
  } catch {
    return "—"
  }
}

function formatDateTime(date: string | Date | null | undefined): string {
  return formatDate(date, "d MMM yyyy 'à' HH:mm")
}

function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "—"
  return new Intl.NumberFormat("fr-FR").format(amount) + " FCFA"
}

function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return "0"
  return new Intl.NumberFormat("fr-FR").format(n)
}

function getInitials(name: string | null | undefined, email?: string | null): string {
  const src = name || email || "?"
  const parts = src.split(/[\s@._-]+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return src.slice(0, 2).toUpperCase()
}

// ============================================================================
// Badge color helpers
// ============================================================================

const PLAN_BADGE: Record<string, string> = {
  starter: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  pro: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  enterprise: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  custom: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
}

const ROLE_BADGE: Record<string, { className: string; icon: React.ComponentType<{ className?: string }> }> = {
  OWNER: { className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Crown },
  ADMIN: { className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: Shield },
  MANAGER: { className: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400", icon: UserCog },
  AGENT: { className: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400", icon: UserIcon },
  VIEWER: { className: "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200", icon: Eye },
}

function statusBadgeClass(status: string): string {
  const s = status.toLowerCase()
  if (["active", "paid", "success", "delivered", "ready"].includes(s)) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
  }
  if (["pending", "trialing", "warning", "warn", "past_due"].includes(s)) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  }
  if (["revoked", "cancelled", "expired", "failed", "void", "suspended", "error"].includes(s)) {
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
  }
  return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
}

function severityBadgeClass(severity: string): string {
  const s = severity.toLowerCase()
  if (s === "critical" || s === "error") return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
  if (s === "warn") return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
  if (s === "info") return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
  return "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
}

function progressColorClass(pct: number): string {
  if (pct >= 90) return "bg-red-500"
  if (pct >= 60) return "bg-amber-500"
  return "bg-emerald-500"
}

// ============================================================================
// Sub-components
// ============================================================================

function EmptyState({
  icon: Icon,
  title,
  message,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  message: string
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
        <Icon className="h-6 w-6" />
      </div>
      <h4 className="text-sm font-semibold mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground max-w-md">{message}</p>
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-lg border bg-card p-3 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</p>
        <p className="text-base font-semibold leading-tight truncate">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground truncate">{sub}</p>}
      </div>
    </div>
  )
}

function InfoRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground sm:text-right break-all">{children}</span>
    </div>
  )
}

function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  action,
}: {
  title: string
  description?: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div>
              <CardTitle className="text-sm">{title}</CardTitle>
              {description && <CardDescription className="text-[11px]">{description}</CardDescription>}
            </div>
          </div>
          {action}
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  )
}

// ============================================================================
// Main component
// ============================================================================

interface OrgDetailsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OrganizationDetailsDialog({ open, onOpenChange }: OrgDetailsDialogProps) {
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [data, setData] = React.useState<OrgDetailsResponse | null>(null)
  const [activeTab, setActiveTab] = React.useState("identity")

  // Inline edit state (org name)
  const [editingName, setEditingName] = React.useState(false)
  const [nameValue, setNameValue] = React.useState("")
  const [savingName, setSavingName] = React.useState(false)

  // Invite member sub-dialog state
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [inviteEmail, setInviteEmail] = React.useState("")
  const [inviteRole, setInviteRole] = React.useState<string>("AGENT")
  const [inviting, setInviting] = React.useState(false)

  // Member action state (role change / removal)
  const [memberMenuId, setMemberMenuId] = React.useState<string | null>(null)
  const [removingMember, setRemovingMember] = React.useState<{ id: string; name: string } | null>(null)
  const [removing, setRemoving] = React.useState(false)
  const [roleChangingId, setRoleChangingId] = React.useState<string | null>(null)

  const fetchData = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/organization/details", { credentials: "include" })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || `HTTP ${res.status}`)
      }
      const json: OrgDetailsResponse = await res.json()
      setData(json)
      setNameValue(json.organization.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      void fetchData()
    }
  }, [open, fetchData])

  const handleSaveName = async () => {
    if (!data) return
    const trimmed = nameValue.trim()
    if (!trimmed || trimmed.length > 100) {
      toast.error("Nom invalide (1 à 100 caractères)")
      return
    }
    if (trimmed === data.organization.name) {
      setEditingName(false)
      return
    }
    setSavingName(true)
    try {
      const res = await fetch("/api/organization", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || `HTTP ${res.status}`)
      }
      toast.success("Organisation renommée", { description: `« ${trimmed} »` })
      setEditingName(false)
      await fetchData()
    } catch (e) {
      toast.error("Erreur", { description: e instanceof Error ? e.message : "Inconnue" })
    } finally {
      setSavingName(false)
    }
  }

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Email invalide")
      return
    }
    setInviting(true)
    try {
      const res = await fetch("/api/organization/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, role: inviteRole }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || `HTTP ${res.status}`)
      }
      toast.success("Invitation envoyée", {
        description: `${email} a été invité(e) en tant que ${inviteRole}`,
      })
      setInviteOpen(false)
      setInviteEmail("")
      setInviteRole("AGENT")
      await fetchData()
    } catch (e) {
      toast.error("Erreur", { description: e instanceof Error ? e.message : "Inconnue" })
    } finally {
      setInviting(false)
    }
  }

  const handleChangeRole = async (memberId: string, newRole: string) => {
    setRoleChangingId(memberId)
    try {
      const res = await fetch(`/api/organization/members/${memberId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || `HTTP ${res.status}`)
      }
      toast.success("Rôle mis à jour", { description: `Nouveau rôle : ${newRole}` })
      setMemberMenuId(null)
      await fetchData()
    } catch (e) {
      toast.error("Erreur", { description: e instanceof Error ? e.message : "Inconnue" })
    } finally {
      setRoleChangingId(null)
    }
  }

  const handleRemoveMember = async () => {
    if (!removingMember) return
    setRemoving(true)
    try {
      const res = await fetch(`/api/organization/members/${removingMember.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error || `HTTP ${res.status}`)
      }
      toast.success("Membre retiré", { description: removingMember.name })
      setRemovingMember(null)
      await fetchData()
    } catch (e) {
      toast.error("Erreur", { description: e instanceof Error ? e.message : "Inconnue" })
    } finally {
      setRemoving(false)
    }
  }

  const canEdit = data?.currentRole === "OWNER" || data?.currentRole === "ADMIN"

  // Rôles invitable selon le currentRole
  const invitableRoles =
    data?.currentRole === "OWNER"
      ? [
          { value: "ADMIN", label: "Admin" },
          { value: "MANAGER", label: "Manager" },
          { value: "AGENT", label: "Agent" },
          { value: "VIEWER", label: "Viewer" },
        ]
      : [
          { value: "MANAGER", label: "Manager" },
          { value: "AGENT", label: "Agent" },
          { value: "VIEWER", label: "Viewer" },
        ]

  // Rôles assignable via le menu (selon currentRole) — pour ne pas afficher des options invalides
  const assignableRoles = React.useMemo(() => {
    if (!data) return []
    return data.currentRole === "OWNER"
      ? [
          { value: "ADMIN", label: "Admin" },
          { value: "MANAGER", label: "Manager" },
          { value: "AGENT", label: "Agent" },
          { value: "VIEWER", label: "Viewer" },
        ]
      : [
          { value: "MANAGER", label: "Manager" },
          { value: "AGENT", label: "Agent" },
          { value: "VIEWER", label: "Viewer" },
        ]
  }, [data])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-h-[100vh] sm:max-h-[90vh] h-full sm:h-auto w-full sm:max-w-5xl flex flex-col overflow-hidden rounded-none sm:rounded-lg">
        <DialogHeader className="px-4 md:px-6 py-4 border-b sticky top-0 bg-background z-10">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="flex items-start gap-3 min-w-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0">
                <Building2 className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-xl truncate">
                  {loading ? "Chargement…" : data?.organization.name || "Organisation"}
                </DialogTitle>
                <DialogDescription className="text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {data && (
                    <>
                      <Badge variant="outline" className={cn("text-[10px] capitalize", PLAN_BADGE[data.organization.plan] || statusBadgeClass(data.organization.plan))}>
                        {data.organization.plan}
                      </Badge>
                      <span className="inline-flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {data.organization.slug}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Membre depuis {formatDate(data.stats.memberSince)} ({data.stats.daysActive} jour{data.stats.daysActive > 1 ? "s" : ""})
                      </span>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {loading && <LoadingState />}
          {error && !loading && (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 mb-3">
                <AlertCircle className="h-6 w-6" />
              </div>
              <h4 className="text-base font-semibold mb-1">Impossible de charger les détails</h4>
              <p className="text-sm text-muted-foreground mb-3">{error}</p>
              <Button onClick={() => void fetchData()} variant="outline" size="sm">
                <Loader2 className="h-3.5 w-3.5 mr-2" />
                Réessayer
              </Button>
            </div>
          )}

          {data && !loading && !error && (
            <>
              {/* KPI grid — 2 cols mobile, 3 sm, 6 lg */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <KpiCard
                  label="Membres actifs"
                  value={formatNumber(data.stats.totalMembers)}
                  sub={`${data.stats.totalMembersPending} en attente`}
                  icon={Users}
                />
                <KpiCard
                  label="Workspaces"
                  value={formatNumber(data.stats.totalWorkspaces)}
                  icon={Boxes}
                />
                <KpiCard
                  label="Plan"
                  value={data.organization.plan}
                  sub={data.license ? "Licence active" : "Sans licence"}
                  icon={ShieldCheck}
                />
                <KpiCard
                  label="Quota API"
                  value={data.quota ? `${formatNumber(data.quota.apiCalls)} / ${formatNumber(data.license?.maxApiCalls ?? 100000)}` : "0"}
                  sub={data.quota ? `${data.quota.periodMonth}/${data.quota.periodYear}` : "Aucun quota"}
                  icon={Gauge}
                />
                <KpiCard
                  label="Entreprises"
                  value={formatNumber(data.stats.totalCompanies)}
                  sub={data.license ? `/ ${formatNumber(data.license.maxCompanies)}` : "global"}
                  icon={Layers}
                />
                <KpiCard
                  label="Jours actifs"
                  value={formatNumber(data.stats.daysActive)}
                  icon={Activity}
                />
              </div>

              {/* Tabs — horizontal scrollable on mobile, wraps on desktop */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex overflow-x-auto border-b -mx-4 md:-mx-6 px-4 md:px-6">
                  <TabsList className="h-auto flex-nowrap sm:flex-wrap bg-transparent p-0 rounded-none">
                    <TabsTrigger value="identity" className="gap-1">
                      <Building2 className="h-3.5 w-3.5" /> Identité
                    </TabsTrigger>
                    <TabsTrigger value="members" className="gap-1">
                      <Users className="h-3.5 w-3.5" /> Membres
                    </TabsTrigger>
                    <TabsTrigger value="workspaces" className="gap-1">
                      <Boxes className="h-3.5 w-3.5" /> Workspaces
                    </TabsTrigger>
                    <TabsTrigger value="subscription" className="gap-1">
                      <CreditCard className="h-3.5 w-3.5" /> Abonnement
                    </TabsTrigger>
                    <TabsTrigger value="license" className="gap-1">
                      <KeyRound className="h-3.5 w-3.5" /> Licence
                    </TabsTrigger>
                    <TabsTrigger value="quota" className="gap-1">
                      <Gauge className="h-3.5 w-3.5" /> Quota
                    </TabsTrigger>
                    <TabsTrigger value="invoices" className="gap-1">
                      <FileText className="h-3.5 w-3.5" /> Factures
                    </TabsTrigger>
                    <TabsTrigger value="apikeys" className="gap-1">
                      <KeyRound className="h-3.5 w-3.5" /> API Keys
                    </TabsTrigger>
                    {data.canSeeAudit && (
                      <TabsTrigger value="audit" className="gap-1">
                        <ScrollText className="h-3.5 w-3.5" /> Audit
                      </TabsTrigger>
                    )}
                  </TabsList>
                </div>

                {/* Identity tab */}
                <TabsContent value="identity" className="mt-4">
                  <SectionCard title="Identité" description="Informations générales de l'organisation" icon={Building2}>
                    <div className="space-y-1">
                      <InfoRow label="Nom">
                        {editingName ? (
                          <div className="flex items-center gap-2 max-w-xs">
                            <Input
                              value={nameValue}
                              onChange={(e) => setNameValue(e.target.value)}
                              className="h-8 text-sm"
                              disabled={savingName}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void handleSaveName()
                                if (e.key === "Escape") {
                                  setEditingName(false)
                                  setNameValue(data.organization.name)
                                }
                              }}
                            />
                            <Button size="icon" className="h-8 w-8" onClick={() => void handleSaveName()} disabled={savingName}>
                              {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingName(false); setNameValue(data.organization.name) }} disabled={savingName}>
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            {data.organization.name}
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[11px]"
                                onClick={() => setEditingName(true)}
                              >
                                Modifier
                              </Button>
                            )}
                          </span>
                        )}
                      </InfoRow>
                      <InfoRow label="Slug">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{data.organization.slug}</code>
                      </InfoRow>
                      <InfoRow label="Plan">
                        <Badge variant="outline" className={cn("text-[10px] capitalize", PLAN_BADGE[data.organization.plan] || statusBadgeClass(data.organization.plan))}>
                          {data.organization.plan}
                        </Badge>
                      </InfoRow>
                      <Separator className="my-2" />
                      {data.owner && (
                        <>
                          <InfoRow label="Owner">
                            <span className="inline-flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                {data.owner.avatarUrl && <AvatarImage src={data.owner.avatarUrl} alt={data.owner.name || data.owner.email} />}
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                  {getInitials(data.owner.name, data.owner.email)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="font-medium">{data.owner.name || "—"}</span>
                              <span className="text-muted-foreground text-xs">&lt;{data.owner.email}&gt;</span>
                              {data.owner.role && (
                                <Badge variant="outline" className={cn("text-[10px]", (ROLE_BADGE[data.owner.role] || { className: "" }).className)}>
                                  {data.owner.role}
                                </Badge>
                              )}
                            </span>
                          </InfoRow>
                        </>
                      )}
                      <InfoRow label="Créé le">{formatDate(data.organization.createdAt)}</InfoRow>
                      <InfoRow label="Modifié le">{formatDate(data.organization.updatedAt)}</InfoRow>
                      <Separator className="my-2" />
                      <div className="py-1.5">
                        <span className="text-xs text-muted-foreground">Settings (JSON)</span>
                        <pre className="mt-1 text-[11px] bg-muted/60 rounded-md p-2 overflow-x-auto max-h-40">
                          {JSON.stringify(data.organization.settings, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </SectionCard>
                </TabsContent>

                {/* Members tab */}
                <TabsContent value="members" className="mt-4">
                  <SectionCard
                    title="Membres"
                    description={`${data.stats.totalMembers} actif(s) · ${data.stats.totalMembersPending} en attente`}
                    icon={Users}
                    action={
                      canEdit ? (
                        <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setInviteOpen(true)}>
                          <UserPlus className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Inviter un membre</span>
                          <span className="sm:hidden">Inviter</span>
                        </Button>
                      ) : undefined
                    }
                  >
                    {/* Pending invitations section */}
                    {data.members.filter((m) => m.status === "pending").length > 0 && (
                      <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Mail className="h-3.5 w-3.5 text-amber-600" />
                          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                            Invitations en attente ({data.members.filter((m) => m.status === "pending").length})
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          {data.members
                            .filter((m) => m.status === "pending")
                            .map((m) => {
                              const roleMeta = ROLE_BADGE[m.role] || { className: "", icon: UserIcon }
                              const RoleIcon = roleMeta.icon
                              return (
                                <div
                                  key={m.id}
                                  className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10 p-2"
                                >
                                  <Avatar className="h-7 w-7 shrink-0">
                                    {m.user?.avatarUrl && <AvatarImage src={m.user.avatarUrl} alt={m.user?.name || m.user?.email || ""} />}
                                    <AvatarFallback className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                      {getInitials(m.user?.name, m.user?.email)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-xs font-medium truncate">{m.user?.name || m.user?.email}</p>
                                    <p className="text-[10px] text-muted-foreground truncate">{m.user?.email}</p>
                                  </div>
                                  <Badge variant="outline" className={cn("text-[10px] gap-1 shrink-0", roleMeta.className)}>
                                    <RoleIcon className="h-2.5 w-2.5" />
                                    {m.role}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] shrink-0 bg-amber-100 text-amber-700 border-amber-500/30 dark:bg-amber-900/30 dark:text-amber-400">
                                    En attente
                                  </Badge>
                                  {canEdit && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 shrink-0"
                                      disabled={removing}
                                      onClick={() =>
                                        setRemovingMember({
                                          id: m.id,
                                          name: m.user?.name || m.user?.email || "ce membre",
                                        })
                                      }
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  )}
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )}

                    {/* Active members table */}
                    {data.members.filter((m) => m.status !== "pending").length === 0 &&
                    data.members.filter((m) => m.status === "pending").length === 0 ? (
                      <EmptyState icon={Users} title="Aucun membre" message="Les membres de votre organisation apparaîtront ici. Cliquez sur « Inviter un membre » pour commencer." />
                    ) : (
                      <div className="overflow-x-auto -mx-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="h-8">Membre</TableHead>
                              <TableHead className="h-8">Rôle</TableHead>
                              <TableHead className="h-8">Statut</TableHead>
                              <TableHead className="h-8 hidden md:table-cell">Invité le</TableHead>
                              <TableHead className="h-8 hidden lg:table-cell">Accepté le</TableHead>
                              <TableHead className="h-8 hidden lg:table-cell">Dernier login</TableHead>
                              {canEdit && <TableHead className="h-8 w-10" />}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.members
                              .filter((m) => m.status !== "pending")
                              .map((m) => {
                                const roleMeta = ROLE_BADGE[m.role] || { className: "", icon: UserIcon }
                                const RoleIcon = roleMeta.icon
                                const canManageThisMember =
                                  canEdit &&
                                  m.role !== "OWNER" &&
                                  m.userId !== data.organization.ownerId &&
                                  (data.currentRole === "OWNER" || (m.role !== "OWNER" && m.role !== "ADMIN"))
                                return (
                                  <TableRow key={m.id}>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Avatar className="h-7 w-7">
                                          {m.user?.avatarUrl && <AvatarImage src={m.user.avatarUrl} alt={m.user?.name || m.user?.email || ""} />}
                                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                            {getInitials(m.user?.name, m.user?.email)}
                                          </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0">
                                          <p className="text-xs font-medium truncate">{m.user?.name || "—"}</p>
                                          <p className="text-[10px] text-muted-foreground truncate">{m.user?.email || "—"}</p>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {memberMenuId === m.id ? (
                                        <Select
                                          value={m.role}
                                          onValueChange={(nv) => void handleChangeRole(m.id, nv)}
                                          disabled={roleChangingId === m.id}
                                        >
                                          <SelectTrigger className="h-7 text-[11px] w-[110px]">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {assignableRoles.map((r) => (
                                              <SelectItem key={r.value} value={r.value} className="text-xs">
                                                {r.label}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <Badge variant="outline" className={cn("text-[10px] gap-1", roleMeta.className)}>
                                          <RoleIcon className="h-2.5 w-2.5" />
                                          {m.role}
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="outline" className={cn("text-[10px]", statusBadgeClass(m.status))}>
                                        {m.status}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{formatDate(m.invitedAt)}</TableCell>
                                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{formatDate(m.acceptedAt)}</TableCell>
                                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{formatDate(m.user?.lastLoginAt)}</TableCell>
                                    {canEdit && (
                                      <TableCell>
                                        <div className="flex items-center gap-1">
                                          {canManageThisMember && (
                                            <>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 px-2 text-[11px]"
                                                onClick={() => setMemberMenuId(memberMenuId === m.id ? null : m.id)}
                                                disabled={roleChangingId === m.id}
                                              >
                                                {roleChangingId === m.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Rôle"}
                                              </Button>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                disabled={removing}
                                                onClick={() =>
                                                  setRemovingMember({
                                                    id: m.id,
                                                    name: m.user?.name || m.user?.email || "ce membre",
                                                  })
                                                }
                                              >
                                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                              </Button>
                                            </>
                                          )}
                                        </div>
                                      </TableCell>
                                    )}
                                  </TableRow>
                                )
                              })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </SectionCard>
                </TabsContent>

                {/* Workspaces tab */}
                <TabsContent value="workspaces" className="mt-4">
                  <SectionCard title="Workspaces" description={`${data.stats.totalWorkspaces} workspace(s)`} icon={Boxes}>
                    {data.workspaces.length === 0 ? (
                      <EmptyState icon={Boxes} title="Aucun workspace" message="Les workspaces de votre organisation apparaîtront ici." />
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {data.workspaces.map((w) => (
                          <div key={w.id} className="rounded-md border p-3 bg-card">
                            <div className="flex items-start gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded bg-primary/10 text-primary shrink-0">
                                <Layers className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{w.name}</p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  <code className="bg-muted px-1 rounded">{w.slug}</code>
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  Créé le {formatDate(w.createdAt)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </SectionCard>
                </TabsContent>

                {/* Subscription tab */}
                <TabsContent value="subscription" className="mt-4">
                  <SectionCard title="Abonnement" description="Statut et cycle de facturation" icon={CreditCard}>
                    {!data.subscription ? (
                      <EmptyState icon={CreditCard} title="Aucun abonnement" message="Aucun abonnement actif. Souscrivez un plan pour activer la facturation." />
                    ) : (
                      <div className="space-y-1">
                        <InfoRow label="Statut">
                          <Badge variant="outline" className={cn("text-[10px] capitalize", statusBadgeClass(data.subscription.status))}>
                            {data.subscription.status}
                          </Badge>
                        </InfoRow>
                        <InfoRow label="Plan">{data.subscription.plan}</InfoRow>
                        <InfoRow label="Cycle">{data.subscription.billingCycle === "monthly" ? "Mensuel" : "Annuel"}</InfoRow>
                        <InfoRow label="Montant">
                          {formatCurrency(data.subscription.amountXOF)} / {data.subscription.billingCycle === "monthly" ? "mois" : "an"}
                        </InfoRow>
                        <Separator className="my-2" />
                        <InfoRow label="Période début">{formatDate(data.subscription.currentPeriodStart)}</InfoRow>
                        <InfoRow label="Période fin">{formatDate(data.subscription.currentPeriodEnd)}</InfoRow>
                        <InfoRow label="Méthode de paiement">{data.subscription.paymentMethod || "—"}</InfoRow>
                        <InfoRow label="Annulation fin de période">
                          {data.subscription.cancelAtPeriodEnd ? "Oui" : "Non"}
                        </InfoRow>
                        <InfoRow label="Fin d'essai">{formatDate(data.subscription.trialEndsAt)}</InfoRow>
                      </div>
                    )}
                  </SectionCard>
                </TabsContent>

                {/* License tab */}
                <TabsContent value="license" className="mt-4">
                  <SectionCard title="Licence" description="Limites et fonctionnalités du plan" icon={KeyRound}>
                    {!data.license ? (
                      <EmptyState icon={KeyRound} title="Aucune licence" message="Aucune licence active. Activez une clé pour débloquer les fonctionnalités." />
                    ) : (
                      <div className="space-y-2">
                        <InfoRow label="Clé">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{data.license.keyMasked}</code>
                        </InfoRow>
                        <InfoRow label="Plan">
                          <Badge variant="outline" className={cn("text-[10px] capitalize", PLAN_BADGE[data.license.plan] || statusBadgeClass(data.license.plan))}>
                            {data.license.plan}
                          </Badge>
                        </InfoRow>
                        <InfoRow label="Nom">{data.license.name}</InfoRow>
                        <InfoRow label="Statut">
                          <Badge variant="outline" className={cn("text-[10px] capitalize", statusBadgeClass(data.license.status))}>
                            {data.license.status}
                          </Badge>
                        </InfoRow>
                        <Separator className="my-2" />
                        <p className="text-xs text-muted-foreground">Limites</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          <LimitTile label="Utilisateurs" value={data.license.maxUsers} icon={Users} />
                          <LimitTile label="Entreprises" value={data.license.maxCompanies} icon={Layers} />
                          <LimitTile label="Appels API" value={data.license.maxApiCalls} icon={Gauge} />
                          <LimitTile label="Exports" value={data.license.maxExports} icon={FileText} />
                          <LimitTile label="Sources" value={data.license.maxSources} icon={MapPin} />
                          <LimitTile label="Workspaces" value={data.license.maxWorkspaces} icon={Boxes} />
                        </div>
                        <Separator className="my-2" />
                        <p className="text-xs text-muted-foreground">Fonctionnalités</p>
                        <div className="flex flex-wrap gap-1">
                          {data.license.features.length === 0 ? (
                            <span className="text-xs text-muted-foreground">Aucune fonctionnalité.</span>
                          ) : (
                            data.license.features.map((f) => (
                              <Badge key={f} variant="secondary" className="text-[10px]">
                                {f}
                              </Badge>
                            ))
                          )}
                        </div>
                        <Separator className="my-2" />
                        <InfoRow label="Activée le">{formatDate(data.license.activatedAt)}</InfoRow>
                        <InfoRow label="Expire le">{formatDate(data.license.expiresAt)}</InfoRow>
                      </div>
                    )}
                  </SectionCard>
                </TabsContent>

                {/* Quota tab */}
                <TabsContent value="quota" className="mt-4">
                  <SectionCard
                    title="Quota"
                    description={data.quota ? `Période ${data.quota.periodMonth}/${data.quota.periodYear}` : "Aucune donnée de quota"}
                    icon={Gauge}
                  >
                    {!data.quota ? (
                      <EmptyState icon={Gauge} title="Aucun quota enregistré" message="Le quota du mois courant apparaîtra ici une fois les compteurs initialisés." />
                    ) : (
                      <div className="space-y-3">
                        <QuotaBar
                          label="Appels API"
                          current={data.quota.apiCalls}
                          max={data.license?.maxApiCalls}
                        />
                        <QuotaBar
                          label="Entreprises stockées"
                          current={data.quota.companiesStored}
                          max={data.license?.maxCompanies}
                        />
                        <QuotaBar
                          label="Exports"
                          current={data.quota.exportsCount}
                          max={data.license?.maxExports}
                        />
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">Scrape jobs</span>
                            <span className="text-xs font-medium">{formatNumber(data.quota.scrapeJobs)}</span>
                          </div>
                          <Progress value={0} className="h-2 bg-muted" />
                          <p className="text-[10px] text-muted-foreground mt-0.5">Aucune limite configurée</p>
                        </div>
                        <QuotaBar
                          label="Utilisateurs"
                          current={data.quota.usersCount}
                          max={data.license?.maxUsers}
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Mis à jour le {formatDateTime(data.quota.updatedAt)}
                        </p>
                      </div>
                    )}
                  </SectionCard>
                </TabsContent>

                {/* Invoices tab */}
                <TabsContent value="invoices" className="mt-4">
                  <SectionCard
                    title="Factures"
                    description={`${data.stats.totalInvoices} facture(s)`}
                    icon={Receipt}
                  >
                    {data.invoices.length === 0 ? (
                      <EmptyState icon={Receipt} title="Aucune facture" message="Vos factures apparaîtront ici une fois le premier paiement traité." />
                    ) : (
                      <div className="overflow-x-auto -mx-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="h-8">Numéro</TableHead>
                              <TableHead className="h-8">Montant HT</TableHead>
                              <TableHead className="h-8 hidden md:table-cell">TVA</TableHead>
                              <TableHead className="h-8">Total TTC</TableHead>
                              <TableHead className="h-8">Statut</TableHead>
                              <TableHead className="h-8 hidden lg:table-cell">Échéance</TableHead>
                              <TableHead className="h-8 hidden lg:table-cell">Payée le</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.invoices.map((inv) => (
                              <TableRow key={inv.id}>
                                <TableCell className="text-xs font-mono">{inv.number}</TableCell>
                                <TableCell className="text-xs">{formatCurrency(inv.amountXOF)}</TableCell>
                                <TableCell className="text-xs hidden md:table-cell">{formatCurrency(inv.taxXOF)}</TableCell>
                                <TableCell className="text-xs font-medium">{formatCurrency(inv.totalXOF)}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className={cn("text-[10px]", statusBadgeClass(inv.status))}>
                                    {inv.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">{formatDate(inv.dueDate)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground hidden lg:table-cell">{formatDate(inv.paidAt)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </SectionCard>
                </TabsContent>

                {/* API Keys tab */}
                <TabsContent value="apikeys" className="mt-4">
                  <SectionCard title="Clés API" description={`${data.stats.totalApiKeys} active(s)`} icon={KeyRound}>
                    {data.apiKeys.length === 0 ? (
                      <EmptyState icon={KeyRound} title="Aucune clé API" message="Aucune clé API n'a été générée par les membres de l'organisation." />
                    ) : (
                      <div className="overflow-x-auto -mx-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="h-8">Nom</TableHead>
                              <TableHead className="h-8">Préfixe</TableHead>
                              <TableHead className="h-8 hidden md:table-cell">Scopes</TableHead>
                              <TableHead className="h-8 hidden lg:table-cell">Dernier usage</TableHead>
                              <TableHead className="h-8 hidden lg:table-cell">Expire le</TableHead>
                              <TableHead className="h-8">Statut</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.apiKeys.map((k) => {
                              const isRevoked = !!k.revokedAt
                              const isExpired = k.expiresAt ? new Date(k.expiresAt) < new Date() : false
                              const status = isRevoked ? "revoked" : isExpired ? "expired" : "active"
                              return (
                                <TableRow key={k.id}>
                                  <TableCell>
                                    <p className="text-xs font-medium truncate">{k.name}</p>
                                    {k.ownerEmail && (
                                      <p className="text-[10px] text-muted-foreground truncate">{k.ownerEmail}</p>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded font-mono">
                                      {k.keyPrefix}…
                                    </code>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell">
                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                      {k.scopes.length === 0 ? (
                                        <span className="text-[10px] text-muted-foreground">—</span>
                                      ) : (
                                        k.scopes.slice(0, 3).map((s) => (
                                          <Badge key={s} variant="secondary" className="text-[9px]">{s}</Badge>
                                        ))
                                      )}
                                      {k.scopes.length > 3 && (
                                        <Badge variant="outline" className="text-[9px]">+{k.scopes.length - 3}</Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                                    {formatDate(k.lastUsedAt)}
                                  </TableCell>
                                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                                    {formatDate(k.expiresAt)}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={cn("text-[10px]", statusBadgeClass(status))}>
                                      {status}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </SectionCard>
                </TabsContent>

                {/* Audit tab (OWNER/ADMIN only) */}
                {data.canSeeAudit && (
                  <TabsContent value="audit" className="mt-4">
                    <SectionCard
                      title="Journal d'audit"
                      description="20 derniers événements"
                      icon={ScrollText}
                    >
                      {!data.auditLogs || data.auditLogs.length === 0 ? (
                        <EmptyState icon={ScrollText} title="Aucun événement" message="Les actions des membres apparaîtront ici." />
                      ) : (
                        <div className="space-y-2">
                          {data.auditLogs.map((log) => (
                            <AuditLogItem key={log.id} log={log} />
                          ))}
                        </div>
                      )}
                    </SectionCard>
                  </TabsContent>
                )}
              </Tabs>
            </>
          )}
        </div>

        {/* Sticky footer */}
        <div className="border-t bg-background px-4 md:px-6 py-3 flex items-center justify-end gap-2 sticky bottom-0 z-10">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </div>
      </DialogContent>

      {/* Sub-dialog: Invite member */}
      <SubDialog open={inviteOpen} onOpenChange={(o) => !inviting && setInviteOpen(o)}>
        <SubDialogContent className="w-full sm:max-w-md p-0 gap-0 max-h-[100vh] sm:max-h-[90vh] h-full sm:h-auto flex flex-col overflow-hidden rounded-none sm:rounded-lg">
          <SubDialogHeader className="px-4 md:px-6 py-4 border-b sticky top-0 bg-background z-10">
            <SubDialogTitle className="flex items-center gap-2 text-base">
              <UserPlus className="h-4 w-4" />
              Inviter un membre
            </SubDialogTitle>
            <SubDialogDescription className="text-xs">
              L&apos;utilisateur recevra une invitation à rejoindre votre organisation.
            </SubDialogDescription>
          </SubDialogHeader>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                Email du membre à inviter
              </label>
              <Input
                type="email"
                placeholder="exemple@entreprise.ci"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={inviting}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleInvite()
                }}
              />
              <p className="text-[11px] text-muted-foreground">
                Si l&apos;utilisateur n&apos;a pas encore de compte, un compte en attente sera créé.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                Rôle à attribuer
              </label>
              <Select value={inviteRole} onValueChange={setInviteRole} disabled={inviting}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {invitableRoles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                {data?.currentRole === "OWNER"
                  ? "OWNER peut inviter tous les rôles sauf un autre OWNER."
                  : "ADMIN peut inviter uniquement des Manager / Agent / Viewer (pas d'ADMIN ou OWNER)."}
              </p>
            </div>

            {/* Plan limit hint */}
            {data?.license && (
              <div className="rounded-md border bg-muted/40 p-2.5 text-xs text-muted-foreground">
                Limite du plan :{" "}
                <span className="font-medium text-foreground">
                  {data.stats.totalMembers + data.stats.totalMembersPending} / {data.license.maxUsers} membres
                </span>
              </div>
            )}
          </div>

          <SubDialogFooter className="border-t bg-background px-4 md:px-6 py-3 sticky bottom-0">
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>
              Annuler
            </Button>
            <Button onClick={() => void handleInvite()} disabled={inviting || !inviteEmail.trim()} className="gap-1.5">
              {inviting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Invitation en cours…
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" />
                  Inviter
                </>
              )}
            </Button>
          </SubDialogFooter>
        </SubDialogContent>
      </SubDialog>

      {/* Confirm member removal */}
      <AlertDialog
        open={!!removingMember}
        onOpenChange={(o) => !removing && !o && setRemovingMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retirer ce membre ?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{removingMember?.name}</strong> sera retiré de l&apos;organisation.
              Cette action est réversible (le membre pourra être réinvité). Une trace sera
              conservée dans l&apos;AuditLog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleRemoveMember()}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Suppression…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Retirer
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

// ============================================================================
// Sub-components used inside tabs
// ============================================================================

function LimitTile({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-md border bg-card p-2 flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground truncate">{label}</p>
        <p className="text-xs font-semibold truncate">{formatNumber(value)}</p>
      </div>
    </div>
  )
}

function QuotaBar({
  label,
  current,
  max,
}: {
  label: string
  current: number
  max?: number | null
}) {
  const effectiveMax = max && max > 0 ? max : null
  const pct = effectiveMax ? Math.min(100, Math.round((current / effectiveMax) * 100)) : 0
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-medium">
          {formatNumber(current)}
          {effectiveMax ? ` / ${formatNumber(effectiveMax)}` : ""}
          {effectiveMax && <span className="text-[10px] text-muted-foreground ml-1">({pct}%)</span>}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full transition-all", progressColorClass(pct))}
          style={{ width: `${Math.max(pct, current > 0 ? 4 : 0)}%` }}
        />
      </div>
    </div>
  )
}

function AuditLogItem({ log }: { log: AuditLogRow }) {
  const [open, setOpen] = React.useState(false)
  const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0
  return (
    <div className="rounded-md border bg-card p-2.5">
      <div className="flex items-start gap-2">
        <div className="flex flex-col items-center pt-0.5">
          <div className={cn("h-2 w-2 rounded-full", progressColorClass(50))} />
          <div className="w-px h-full bg-border mt-1" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("text-[10px]", severityBadgeClass(log.severity))}>
              {log.severity}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">{log.action}</Badge>
            <Badge variant="outline" className="text-[10px]">{log.category}</Badge>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {formatDateTime(log.createdAt)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            {log.userEmail && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {log.userName ? `${log.userName} <${log.userEmail}>` : log.userEmail}
              </span>
            )}
            {log.ip && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {log.ip}
              </span>
            )}
          </div>
          {hasMetadata && (
            <Collapsible open={open} onOpenChange={setOpen}>
              <CollapsibleTrigger asChild>
                <button className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary hover:underline">
                  {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {open ? "Masquer" : "Voir"} les détails
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <pre className="mt-1 text-[10px] bg-muted/60 rounded p-2 overflow-x-auto max-h-32">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-3 h-[68px] animate-pulse" />
        ))}
      </div>
      <div className="h-9 w-full rounded-lg bg-muted animate-pulse" />
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-md border bg-card animate-pulse" />
        ))}
      </div>
    </div>
  )
}
