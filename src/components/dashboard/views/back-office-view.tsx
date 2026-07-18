"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import {
  Shield, Users, CreditCard, ScrollText, Code2, Gauge, Receipt,
  BarChart3, Wrench, FileSearch,
  Crown, UserCog, User as UserIcon, Eye, Mail, Search, UserPlus,
  CheckCircle2, AlertCircle, AlertTriangle, XCircle, Clock,
  Activity, RefreshCw, Download, Plus, KeyRound, Zap, Server,
  Cpu, HardDrive, Database, Power, Trash2, ExternalLink,
  TrendingUp, TrendingDown, DollarSign, Building2, Globe,
  Smartphone, CreditCard as CardIcon, Calendar, ArrowUpRight,
  MoreVertical, Lock, ShieldAlert, ShieldCheck, FileText,
  ChevronRight, Pause, Play, Settings2, Wallet,
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart,
  Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  ChartContainer, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ===========================================================================
// Types & shared helpers
// ===========================================================================

type RoleKey = "OWNER" | "ADMIN" | "MANAGER" | "AGENT" | "VIEWER"
type StatusKey = "active" | "pending" | "disabled"

const roleMeta: Record<RoleKey, { label: string; icon: React.ElementType; className: string }> = {
  OWNER: { label: "Owner", icon: Crown, className: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  ADMIN: { label: "Admin", icon: Shield, className: "bg-primary/10 text-primary" },
  MANAGER: { label: "Manager", icon: UserCog, className: "bg-accent/20 text-accent-foreground" },
  AGENT: { label: "Agent", icon: UserIcon, className: "bg-muted text-muted-foreground" },
  VIEWER: { label: "Viewer", icon: Eye, className: "bg-muted text-muted-foreground" },
}

const statusMeta: Record<StatusKey, { label: string; className: string; dot: string }> = {
  active: { label: "Actif", className: "bg-primary/10 text-primary border-primary/20", dot: "bg-primary" },
  pending: { label: "En attente", className: "bg-accent/20 text-accent-foreground border-accent/30", dot: "bg-accent" },
  disabled: { label: "Désactivé", className: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground/50" },
}

const TABS = [
  { key: "users", label: "Utilisateurs", icon: Users },
  { key: "subscriptions", label: "Abonnements", icon: CreditCard },
  { key: "logs", label: "Logs", icon: ScrollText },
  { key: "api", label: "API", icon: Code2 },
  { key: "quota", label: "Quota", icon: Gauge },
  { key: "payments", label: "Paiements", icon: Receipt },
  { key: "stats", label: "Statistiques", icon: BarChart3 },
  { key: "maintenance", label: "Maintenance", icon: Wrench },
  { key: "audit", label: "Audit", icon: FileSearch },
] as const

type TabKey = (typeof TABS)[number]["key"]

function formatFCFA(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA"
}

function compact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M"
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k"
  return String(n)
}

// ===========================================================================
// Mock data
// ===========================================================================

interface UserRow {
  id: string
  name: string
  email: string
  role: RoleKey
  status: StatusKey
  lastLogin: string
  org: string
}

// Production: données mock supprimées. Brancher /api/admin/users quand disponible.
const usersData: UserRow[] = []

interface LogEntry {
  id: string
  ts: string
  level: "info" | "warn" | "error" | "critical"
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
  endpoint: string
  status: number
  ms: number
  ip: string
}

const logsData: LogEntry[] = [
  { id: "l1", ts: "2027-01-15 14:32:18", level: "info", method: "GET", endpoint: "/api/v1/companies?limit=20", status: 200, ms: 42, ip: "154.123.45.10" },
  { id: "l2", ts: "2027-01-15 14:31:55", level: "warn", method: "POST", endpoint: "/api/v1/jobs", status: 429, ms: 12, ip: "154.123.45.10" },
  { id: "l3", ts: "2027-01-15 14:30:42", level: "error", method: "GET", endpoint: "/api/v1/companies/cmrog2", status: 500, ms: 1245, ip: "41.207.18.22" },
  { id: "l4", ts: "2027-01-15 14:29:10", level: "info", method: "GET", endpoint: "/api/v1/sources", status: 200, ms: 28, ip: "154.123.45.10" },
  { id: "l5", ts: "2027-01-15 14:28:33", level: "info", method: "PUT", endpoint: "/api/v1/companies/cmrog4", status: 200, ms: 56, ip: "154.123.45.10" },
  { id: "l6", ts: "2027-01-15 14:27:18", level: "critical", method: "DELETE", endpoint: "/api/v1/companies/cmrog7", status: 403, ms: 8, ip: "41.207.18.22" },
  { id: "l7", ts: "2027-01-15 14:26:55", level: "info", method: "GET", endpoint: "/api/v1/notifications/stats", status: 200, ms: 18, ip: "154.123.45.10" },
  { id: "l8", ts: "2027-01-15 14:25:42", level: "warn", method: "POST", endpoint: "/api/v1/exports", status: 429, ms: 14, ip: "197.234.10.5" },
  { id: "l9", ts: "2027-01-15 14:24:18", level: "info", method: "GET", endpoint: "/api/v1/alerts", status: 200, ms: 22, ip: "154.123.45.10" },
  { id: "l10", ts: "2027-01-15 14:23:55", level: "info", method: "GET", endpoint: "/api/v1/reports", status: 200, ms: 31, ip: "154.123.45.10" },
  { id: "l11", ts: "2027-01-15 14:22:30", level: "error", method: "POST", endpoint: "/api/v1/auth/login", status: 401, ms: 145, ip: "102.176.65.4" },
  { id: "l12", ts: "2027-01-15 14:21:18", level: "info", method: "PATCH", endpoint: "/api/v1/companies/cmrog9", status: 200, ms: 67, ip: "154.123.45.10" },
  { id: "l13", ts: "2027-01-15 14:20:05", level: "warn", method: "GET", endpoint: "/api/v1/companies?limit=100", status: 200, ms: 1240, ip: "154.123.45.10" },
  { id: "l14", ts: "2027-01-15 14:19:42", level: "info", method: "GET", endpoint: "/api/v1/me", status: 200, ms: 14, ip: "154.123.45.10" },
  { id: "l15", ts: "2027-01-15 14:18:30", level: "info", method: "GET", endpoint: "/api/v1/notifications?limit=50", status: 200, ms: 35, ip: "154.123.45.10" },
]

interface ApiKeyRow {
  id: string
  name: string
  prefix: string
  scopes: string[]
  lastUsed: string
  status: "active" | "revoked"
  created: string
}

const apiKeysData: ApiKeyRow[] = [
  { id: "k1", name: "Production Web App", prefix: "sk_live_4f2a", scopes: ["companies:read", "companies:write", "exports:read"], lastUsed: "Il y a 2 min", status: "active", created: "12 oct. 2026" },
  { id: "k2", name: "Mobile iOS App", prefix: "sk_live_9b3e", scopes: ["companies:read", "sources:read"], lastUsed: "Il y a 18 min", status: "active", created: "03 nov. 2026" },
  { id: "k3", name: "Webhook Ingester", prefix: "sk_live_1c8d", scopes: ["notifications:write"], lastUsed: "Il y a 1 h", status: "active", created: "21 nov. 2026" },
  { id: "k4", name: "Legacy Zapier", prefix: "sk_live_5e7f", scopes: ["companies:read"], lastUsed: "Il y a 14 j", status: "revoked", created: "08 sept. 2026" },
]

const apiUsageData = [
  { day: "Lun", calls: 14200 },
  { day: "Mar", calls: 16800 },
  { day: "Mer", calls: 15400 },
  { day: "Jeu", calls: 18900 },
  { day: "Ven", calls: 21300 },
  { day: "Sam", calls: 8900 },
  { day: "Dim", calls: 6200 },
]

interface QuotaItem {
  label: string
  used: number
  limit: number
  unit: string
}

const quotaData: QuotaItem[] = [
  { label: "Appels API", used: 124_500, limit: 100_000, unit: "appels" },
  { label: "Entreprises stockées", used: 38_862, limit: 50_000, unit: "entreprises" },
  { label: "Exports", used: 68, limit: 100, unit: "exports" },
  { label: "Jobs de scraping", used: 156, limit: 200, unit: "jobs" },
]

const quotaHistory7d = [
  { day: "Lun", v: 14200 },
  { day: "Mar", v: 16800 },
  { day: "Mer", v: 15400 },
  { day: "Jeu", v: 18900 },
  { day: "Ven", v: 21300 },
  { day: "Sam", v: 8900 },
  { day: "Dim", v: 6200 },
]

const quotaBySource = [
  { source: "Google Maps", value: 48000, color: "var(--chart-1)" },
  { source: "Facebook", value: 31000, color: "var(--chart-2)" },
  { source: "LinkedIn", value: 22000, color: "var(--chart-3)" },
  { source: "Sites web", value: 15500, color: "var(--chart-4)" },
  { source: "Annuaires", value: 8000, color: "var(--chart-5)" },
]

interface PaymentRow {
  id: string
  date: string
  invoice: string
  amount: number
  method: "Orange Money" | "MTN MoMo" | "Stripe" | "Wave"
  status: "paid" | "pending" | "failed"
  plan: string
}

const paymentsData: PaymentRow[] = [
  { id: "p1", date: "15 jan. 2027", invoice: "INV-2027-001", amount: 85000, method: "Orange Money", status: "paid", plan: "Pro" },
  { id: "p2", date: "15 déc. 2026", invoice: "INV-2026-012", amount: 85000, method: "Orange Money", status: "paid", plan: "Pro" },
  { id: "p3", date: "15 nov. 2026", invoice: "INV-2026-011", amount: 85000, method: "MTN MoMo", status: "paid", plan: "Pro" },
  { id: "p4", date: "15 oct. 2026", invoice: "INV-2026-010", amount: 85000, method: "Orange Money", status: "paid", plan: "Pro" },
  { id: "p5", date: "15 sept. 2026", invoice: "INV-2026-009", amount: 25000, method: "Stripe", status: "paid", plan: "Starter" },
  { id: "p6", date: "15 août 2026", invoice: "INV-2026-008", amount: 25000, method: "Wave", status: "pending", plan: "Starter" },
  { id: "p7", date: "15 juil. 2026", invoice: "INV-2026-007", amount: 25000, method: "Stripe", status: "failed", plan: "Starter" },
  { id: "p8", date: "15 juin 2026", invoice: "INV-2026-006", amount: 25000, method: "Orange Money", status: "paid", plan: "Starter" },
]

const revenue6m = [
  { month: "Aoû", v: 25000 },
  { month: "Sep", v: 25000 },
  { month: "Oct", v: 25000 },
  { month: "Nov", v: 85000 },
  { month: "Déc", v: 85000 },
  { month: "Jan", v: 85000 },
]

const stats30d = Array.from({ length: 30 }, (_, i) => ({
  d: `J${i + 1}`,
  calls: 8000 + Math.round(Math.sin(i / 3) * 3000 + i * 250 + Math.random() * 1500),
}))

const companiesGrowth = [
  { m: "Aoû", v: 31000 },
  { m: "Sep", v: 33000 },
  { m: "Oct", v: 34800 },
  { m: "Nov", v: 36200 },
  { m: "Déc", v: 37500 },
  { m: "Jan", v: 38862 },
]

const scrapingBySource = [
  { name: "Google Maps", value: 48000, color: "var(--chart-1)" },
  { name: "Facebook", value: 31000, color: "var(--chart-2)" },
  { name: "LinkedIn", value: 22000, color: "var(--chart-3)" },
  { name: "Sites web", value: 15500, color: "var(--chart-4)" },
  { name: "Annuaires", value: 8000, color: "var(--chart-5)" },
]

const topSectors = [
  { sector: "Agro-alimentaire", count: 8420 },
  { sector: "BTP & Construction", count: 6210 },
  { sector: "Commerce & Distribution", count: 5780 },
  { sector: "Services financiers", count: 4350 },
  { sector: "Transport & Logistique", count: 3890 },
  { sector: "Santé & Pharmacie", count: 2980 },
  { sector: "Éducation & Formation", count: 2120 },
]

interface AuditRow {
  id: string
  ts: string
  user: string
  action: string
  category: "auth" | "security" | "oauth" | "api" | "data"
  severity: "info" | "warn" | "error" | "critical"
  ip: string
  details: string
}

const auditData: AuditRow[] = [
  { id: "a1", ts: "2027-01-15 14:32:18", user: "adama@agribusiness.ci", action: "login.success", category: "auth", severity: "info", ip: "154.123.45.10", details: "Connexion réussie (password + 2FA TOTP)" },
  { id: "a2", ts: "2027-01-15 14:30:42", user: "—", action: "login.failed", category: "auth", severity: "warn", ip: "102.176.65.4", details: "Échec mot de passe (3e tentative)" },
  { id: "a3", ts: "2027-01-15 14:28:33", user: "mariam@agribusiness.ci", action: "company.update", category: "data", severity: "info", ip: "154.123.45.10", details: "Modification entreprise cmrog4 (téléphone)" },
  { id: "a4", ts: "2027-01-15 14:27:18", user: "—", action: "api.key.revoked", category: "api", severity: "warn", ip: "127.0.0.1", details: "Révocation clé sk_live_5e7f (Legacy Zapier)" },
  { id: "a5", ts: "2027-01-15 14:25:55", user: "sekou@agribusiness.ci", action: "member.invite", category: "security", severity: "info", ip: "154.123.45.10", details: "Invitation envoyée à aicha@agribusiness.ci (VIEWER)" },
  { id: "a6", ts: "2027-01-15 14:23:30", user: "—", action: "oauth.google.link", category: "oauth", severity: "info", ip: "154.123.45.10", details: "Liaison Google OAuth pour fatou@agribusiness.ci" },
  { id: "a7", ts: "2027-01-15 14:21:18", user: "—", action: "rate_limit.exceeded", category: "api", severity: "error", ip: "197.234.10.5", details: "Limite 100 req/min dépassée sur /api/v1/exports" },
  { id: "a8", ts: "2027-01-15 14:19:42", user: "adama@agribusiness.ci", action: "plan.change", category: "security", severity: "warn", ip: "154.123.45.10", details: "Changement plan Starter → Pro" },
  { id: "a9", ts: "2027-01-15 14:18:30", user: "—", action: "permission.denied", category: "security", severity: "error", ip: "41.207.18.22", details: "Tentative suppression entreprise sans droits (OWNER requis)" },
  { id: "a10", ts: "2027-01-15 14:15:18", user: "mariam@agribusiness.ci", action: "export.download", category: "data", severity: "info", ip: "154.123.45.10", details: "Téléchargement export entreprises_ci.xlsx (38 862 lignes)" },
  { id: "a11", ts: "2027-01-15 14:12:55", user: "—", action: "2fa.disabled", category: "security", severity: "critical", ip: "102.176.65.4", details: "Désactivation 2FA — Bloqué par politique de sécurité" },
  { id: "a12", ts: "2027-01-15 14:10:42", user: "fatou@agribusiness.ci", action: "api.key.created", category: "api", severity: "info", ip: "154.123.45.10", details: "Création clé « Mobile iOS App » (scopes: read)" },
  { id: "a13", ts: "2027-01-15 14:08:30", user: "—", action: "oauth.microsoft.unlink", category: "oauth", severity: "warn", ip: "154.123.45.10", details: "Déliaison Microsoft OAuth pour sekou@agribusiness.ci" },
  { id: "a14", ts: "2027-01-15 14:05:18", user: "adama@agribusiness.ci", action: "backup.completed", category: "data", severity: "info", ip: "127.0.0.1", details: "Sauvegarde automatique (1.2 GB)" },
  { id: "a15", ts: "2027-01-15 14:02:55", user: "—", action: "intrusion.blocked", category: "security", severity: "critical", ip: "45.227.10.88", details: "Blocage IP — pattern brute-force détecté" },
]

// ===========================================================================
// Small UI primitives
// ===========================================================================

function StatTile({
  label, value, icon: Icon, accent = "primary", hint,
}: {
  label: string
  value: React.ReactNode
  icon: React.ElementType
  accent?: "primary" | "accent" | "muted"
  hint?: string
}) {
  const colorMap = {
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/20 text-accent-foreground",
    muted: "bg-muted text-muted-foreground",
  }
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-bold mt-1 truncate">{value}</p>
            {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
          </div>
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", colorMap[accent])}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function LevelBadge({ level }: { level: LogEntry["level"] }) {
  const map = {
    info: { label: "INFO", className: "bg-primary/10 text-primary border-primary/20" },
    warn: { label: "WARN", className: "bg-accent/20 text-accent-foreground border-accent/30" },
    error: { label: "ERROR", className: "bg-destructive/10 text-destructive border-destructive/30" },
    critical: { label: "CRIT", className: "bg-destructive text-destructive-foreground border-destructive" },
  }
  const m = map[level]
  return <Badge variant="outline" className={cn("text-[10px] font-mono px-1.5", m.className)}>{m.label}</Badge>
}

function MethodBadge({ method }: { method: LogEntry["method"] }) {
  const map: Record<string, string> = {
    GET: "bg-primary/10 text-primary",
    POST: "bg-accent/20 text-accent-foreground",
    PUT: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
    DELETE: "bg-destructive/10 text-destructive",
    PATCH: "bg-muted text-muted-foreground",
  }
  return <span className={cn("inline-block rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold", map[method])}>{method}</span>
}

function StatusPill({ status }: { status: number }) {
  const ok = status >= 200 && status < 300
  const client = status >= 400 && status < 500
  const server = status >= 500
  const cls = ok
    ? "text-primary"
    : client
      ? "text-accent-foreground bg-accent/20 px-1.5 rounded"
      : server
        ? "text-destructive font-semibold"
        : "text-muted-foreground"
  return <span className={cn("text-[11px] font-mono", cls)}>{status}</span>
}

// ===========================================================================
// Main component
// ===========================================================================

export function BackOfficeView() {
  const [activeTab, setActiveTab] = useState<TabKey>("users")

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Back Office
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Administration · Utilisateurs · Abonnements · API · Logs · Audit · Maintenance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 border-primary/30 text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            Système opérationnel
          </Badge>
          <Badge variant="outline" className="border-accent/30 text-accent-foreground">
            Uptime 99.97%
          </Badge>
        </div>
      </div>

      {/* Tab bar */}
      <Card className="p-0 overflow-hidden">
        <div className="flex overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon
            const isActive = activeTab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors",
                  "hover:bg-muted/50",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{t.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>
      </Card>

      {/* Tab content */}
      {activeTab === "users" && <UsersTab />}
      {activeTab === "subscriptions" && <SubscriptionsTab />}
      {activeTab === "logs" && <LogsTab />}
      {activeTab === "api" && <ApiTab />}
      {activeTab === "quota" && <QuotaTab />}
      {activeTab === "payments" && <PaymentsTab />}
      {activeTab === "stats" && <StatsTab />}
      {activeTab === "maintenance" && <MaintenanceTab />}
      {activeTab === "audit" && <AuditTab />}
    </div>
  )
}

// ===========================================================================
// Tab 1: Utilisateurs
// ===========================================================================

function UsersTab() {
  const [query, setQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState<string>("all")

  const filtered = useMemo(() => {
    return usersData.filter((u) => {
      const matchesQuery = !query || u.name.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase())
      const matchesRole = roleFilter === "all" || u.role === roleFilter
      return matchesQuery && matchesRole
    })
  }, [query, roleFilter])

  const total = usersData.length
  const activeCount = usersData.filter((u) => u.status === "active").length
  const pendingCount = usersData.filter((u) => u.status === "pending").length
  const byRole = (r: RoleKey) => usersData.filter((u) => u.role === r).length

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Total utilisateurs" value={total} icon={Users} accent="primary" />
        <StatTile label="Actifs" value={activeCount} icon={CheckCircle2} accent="primary" />
        <StatTile label="En attente" value={pendingCount} icon={Clock} accent="accent" />
        <StatTile label="Rôles attribués" value={`${byRole("OWNER")}/${byRole("ADMIN")}/${byRole("MANAGER")}/${byRole("AGENT")}/${byRole("VIEWER")}`} icon={Shield} accent="muted" hint="Owner/Admin/Mgr/Agent/View" />
      </div>

      {/* Toolbar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Membres de l'organisation</CardTitle>
              <CardDescription className="text-xs">{filtered.length} membre(s) affiché(s) sur {total}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher nom ou email…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-8 h-9 w-[220px]"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-9 w-[150px]">
                  <SelectValue placeholder="Rôle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les rôles</SelectItem>
                  <SelectItem value="OWNER">Owner</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="AGENT">Agent</SelectItem>
                  <SelectItem value="VIEWER">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button className="gap-2 h-9" onClick={() => toast.success("Invitation envoyée", { description: "Un email d'invitation a été envoyé au nouveau membre." })}>
                <UserPlus className="h-4 w-4" />
                Inviter un membre
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Empty state — pas encore de membres */}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground mb-3">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="text-base font-semibold mb-1">Aucun utilisateur</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                Les membres de votre organisation apparaîtront ici. Invitez vos collaborateurs pour les ajouter.
              </p>
            </div>
          )}

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Membre</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead className="pr-4 w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => {
                  const r = roleMeta[u.role]
                  const RIcon = r.icon
                  const s = statusMeta[u.status]
                  return (
                    <TableRow key={u.id} className="hover:bg-muted/40">
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                              {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{u.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                              <Mail className="h-3 w-3" />{u.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("gap-1 text-[10px]", r.className)}>
                          <RIcon className="h-2.5 w-2.5" />
                          {r.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("gap-1.5 text-[10px]", s.className)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
                          {s.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.org}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.lastLogin}</TableCell>
                      <TableCell className="pr-4">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info(`Actions pour ${u.name}`)}>
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y">
            {filtered.map((u) => {
              const r = roleMeta[u.role]
              const RIcon = r.icon
              const s = statusMeta[u.status]
              return (
                <div key={u.id} className="flex items-center gap-3 p-4">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={cn("gap-1 text-[10px]", r.className)}>
                        <RIcon className="h-2.5 w-2.5" />{r.label}
                      </Badge>
                      <Badge variant="outline" className={cn("gap-1.5 text-[10px]", s.className)}>
                        <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />{s.label}
                      </Badge>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===========================================================================
// Tab 2: Abonnements
// ===========================================================================

const plans = [
  {
    name: "Starter",
    price: 25000,
    features: ["10 000 entreprises", "5 000 appels API / mois", "10 exports / mois", "2 utilisateurs", "Support email"],
    current: false,
  },
  {
    name: "Pro",
    price: 85000,
    features: ["50 000 entreprises", "100 000 appels API / mois", "100 exports / mois", "20 utilisateurs", "Support prioritaire", "Webhooks", "Rapports planifiés"],
    current: true,
  },
  {
    name: "Enterprise",
    price: 350000,
    features: ["Entreprises illimitées", "1M appels API / mois", "Exports illimités", "Utilisateurs illimités", "Support dédié 24/7", "SLA 99.9%", "SSO / SAML", "On-premise option"],
    current: false,
  },
]

function SubscriptionsTab() {
  const usages = [
    { label: "Entreprises stockées", used: 38862, limit: 50000, unit: "" },
    { label: "Appels API", used: 124500, limit: 100000, unit: "" },
    { label: "Exports", used: 68, limit: 100, unit: "" },
    { label: "Utilisateurs", used: 5, limit: 20, unit: "" },
  ]
  return (
    <div className="space-y-4">
      {/* Current plan + payment method */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardDescription className="text-xs">Plan actuel</CardDescription>
                <CardTitle className="text-2xl flex items-center gap-2 mt-1">
                  Plan Pro
                  <Badge className="bg-primary text-primary-foreground">Actuel</Badge>
                </CardTitle>
                <p className="text-3xl font-bold mt-2">{formatFCFA(85000)}<span className="text-sm font-normal text-muted-foreground">/mois</span></p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shrink-0">
                <Crown className="h-6 w-6" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {plans[1].features.map((f) => (
                <Badge key={f} variant="outline" className="gap-1 text-[11px] border-primary/20">
                  <CheckCircle2 className="h-3 w-3 text-primary" />
                  {f}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                Renouvellement le <span className="font-medium text-foreground">15 fév. 2027</span>
              </div>
              <Button className="gap-2" onClick={() => toast.info("Ouverture du sélecteur de plan")}>
                <RefreshCw className="h-4 w-4" />
                Changer de plan
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Moyen de paiement</CardTitle>
            <CardDescription className="text-xs">Facturation mensuelle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-accent/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground font-bold text-xs">
                OM
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Orange Money</p>
                <p className="text-[11px] text-muted-foreground">+225 07 ** ** ** 12</p>
              </div>
              <Badge className="bg-primary text-primary-foreground text-[10px]">Actif</Badge>
            </div>
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => toast.info("Mettre à jour le moyen de paiement")}>
              <CardIcon className="h-3.5 w-3.5" />
              Mettre à jour
            </Button>
            <div className="text-[11px] text-muted-foreground pt-2 border-t">
              Prochaine facturation : <span className="font-medium text-foreground">15 jan. 2027</span> · {formatFCFA(85000)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage bars */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Consommation du mois</CardTitle>
          <CardDescription className="text-xs">Période : 15 déc. 2026 → 15 jan. 2027</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {usages.map((u) => {
            const pct = Math.min(100, (u.used / u.limit) * 100)
            const over = u.used > u.limit
            const color = over ? "bg-destructive" : pct > 90 ? "bg-destructive" : pct > 70 ? "bg-accent" : "bg-primary"
            return (
              <div key={u.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{u.label}</span>
                  {over && <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">Dépassé</Badge>}
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{compact(u.used)} / {compact(u.limit)}</span>
                  <span className={over ? "text-destructive font-semibold" : ""}>{over ? `+${Math.round(pct - 100)}%` : `${Math.round(pct)}%`}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Plan comparison */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Comparer les offres</CardTitle>
          <CardDescription className="text-xs">Tarifs en FCFA · TVA incluse</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Fonctionnalité</TableHead>
                  {plans.map((p) => (
                    <TableHead key={p.name} className="text-center min-w-[140px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-semibold">{p.name}</span>
                        <span className="text-xs font-normal text-muted-foreground">{formatFCFA(p.price)}/mois</span>
                        {p.current && <Badge className="bg-primary text-primary-foreground text-[10px]">Actuel</Badge>}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  { label: "Entreprises", cells: ["10 000", "50 000", "Illimité"] },
                  { label: "Appels API", cells: ["5 000", "100 000", "1M"] },
                  { label: "Exports", cells: ["10", "100", "Illimité"] },
                  { label: "Utilisateurs", cells: ["2", "20", "Illimité"] },
                  { label: "Support", cells: ["Email", "Prioritaire", "24/7 dédié"] },
                  { label: "Webhooks", cells: [false, true, true] },
                  { label: "Rapports planifiés", cells: [false, true, true] },
                  { label: "SSO / SAML", cells: [false, false, true] },
                  { label: "SLA", cells: ["—", "—", "99.9%"] },
                ].map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="pl-4 text-sm font-medium">{row.label}</TableCell>
                    {row.cells.map((c, i) => (
                      <TableCell key={i} className="text-center text-sm">
                        {typeof c === "boolean" ? (
                          c ? <CheckCircle2 className="h-4 w-4 text-primary inline" /> : <span className="text-muted-foreground/30">—</span>
                        ) : c}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell className="pl-4"></TableCell>
                  {plans.map((p) => (
                    <TableCell key={p.name} className="text-center pb-4 pt-2">
                      <Button
                        size="sm"
                        variant={p.current ? "outline" : "default"}
                        disabled={p.current}
                        onClick={() => toast.info(`Sélection du plan ${p.name}`)}
                      >
                        {p.current ? "Plan actuel" : "Choisir"}
                      </Button>
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===========================================================================
// Tab 3: Logs
// ===========================================================================

function LogsTab() {
  const [levelFilter, setLevelFilter] = useState<string>("all")
  const [methodFilter, setMethodFilter] = useState<string>("all")
  const [endpointFilter, setEndpointFilter] = useState<string>("")
  const [autoScroll, setAutoScroll] = useState(true)

  const filtered = useMemo(() => {
    return logsData.filter((l) => {
      const matchLevel = levelFilter === "all" || l.level === levelFilter
      const matchMethod = methodFilter === "all" || l.method === methodFilter
      const matchEndpoint = !endpointFilter || l.endpoint.toLowerCase().includes(endpointFilter.toLowerCase())
      return matchLevel && matchMethod && matchEndpoint
    })
  }, [levelFilter, methodFilter, endpointFilter])

  const errorCount = logsData.filter((l) => l.level === "error" || l.level === "critical").length
  const avgMs = Math.round(logsData.reduce((a, l) => a + l.ms, 0) / logsData.length)

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Total logs (session)" value={logsData.length} icon={ScrollText} accent="primary" />
        <StatTile label="Erreurs" value={errorCount} icon={AlertCircle} accent="accent" hint="error + critical" />
        <StatTile label="Temps moyen" value={`${avgMs} ms`} icon={Zap} accent="muted" />
        <StatTile label="Taux de succès" value={`${Math.round(((logsData.length - errorCount) / logsData.length) * 100)}%`} icon={CheckCircle2} accent="primary" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Logs en temps réel
              </CardTitle>
              <CardDescription className="text-xs">{filtered.length} entrée(s) · flux live</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="h-9 w-[130px]">
                  <SelectValue placeholder="Niveau" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous niveaux</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={methodFilter} onValueChange={setMethodFilter}>
                <SelectTrigger className="h-9 w-[110px]">
                  <SelectValue placeholder="Méthode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem>
                  <SelectItem value="PATCH">PATCH</SelectItem>
                  <SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="Endpoint…"
                value={endpointFilter}
                onChange={(e) => setEndpointFilter(e.target.value)}
                className="h-9 w-[180px]"
              />
              <div className="flex items-center gap-2 px-3 h-9 rounded-md border bg-muted/30">
                <Switch checked={autoScroll} onCheckedChange={setAutoScroll} className="scale-90" />
                <span className="text-xs">Auto-scroll</span>
              </div>
              <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => toast.success("Logs exportés", { description: "Fichier logs_2027-01-15.csv généré." })}>
                <Download className="h-3.5 w-3.5" />
                Export logs
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[480px] overflow-y-auto font-mono text-xs">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Aucun log ne correspond aux filtres.</div>
            ) : (
              filtered.map((l) => (
                <div
                  key={l.id}
                  className={cn(
                    "flex flex-wrap items-center gap-2 px-4 py-2 border-b hover:bg-muted/30 transition-colors",
                    l.level === "critical" && "bg-destructive/5",
                    l.level === "error" && "bg-destructive/[0.03]"
                  )}
                >
                  <span className="text-muted-foreground whitespace-nowrap tabular-nums">{l.ts}</span>
                  <LevelBadge level={l.level} />
                  <MethodBadge method={l.method} />
                  <span className="flex-1 truncate text-foreground">{l.endpoint}</span>
                  <StatusPill status={l.status} />
                  <span className={cn("tabular-nums", l.ms > 500 ? "text-destructive" : "text-muted-foreground")}>{l.ms}ms</span>
                  <span className="text-muted-foreground hidden sm:inline">{l.ip}</span>
                </div>
              ))
            )}
          </div>
        </CardContent>
        <CardFooter className="py-2 border-t bg-muted/30">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Streaming live · {filtered.length} entrées affichées
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}

// ===========================================================================
// Tab 4: API
// ===========================================================================

function ApiTab() {
  const usageConfig = {
    calls: { label: "Appels API", color: "var(--chart-1)" },
  } satisfies ChartConfig

  return (
    <div className="space-y-4">
      {/* Base URL + docs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Globe className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">URL de base</p>
                <p className="text-sm font-mono font-medium truncate">https://api.scraapiq.ci/api/v1</p>
              </div>
              <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Ouverture Swagger UI")}>
                <ExternalLink className="h-3.5 w-3.5" />
                Swagger
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 text-accent-foreground">
              <Code2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Version API</p>
              <p className="text-sm font-medium">v1.4.2 · stable</p>
            </div>
            <Badge variant="outline" className="border-primary/30 text-primary">OK</Badge>
          </CardContent>
        </Card>
      </div>

      {/* API keys */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                Clés API
              </CardTitle>
              <CardDescription className="text-xs">{apiKeysData.length} clés · {apiKeysData.filter((k) => k.status === "active").length} actives</CardDescription>
            </div>
            <Button className="gap-2" onClick={() => {
              const fakeKey = `sk_live_${Math.random().toString(36).slice(2, 6)}_${Math.random().toString(36).slice(2, 24)}`
              toast.success("Nouvelle clé générée", {
                description: (
                  <span className="font-mono text-[11px] break-all">{fakeKey}</span>
                ),
              })
            }}>
              <Plus className="h-4 w-4" />
                Générer une clé
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Nom</TableHead>
                  <TableHead>Clé</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Dernière utilisation</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Créée</TableHead>
                  <TableHead className="pr-4"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeysData.map((k) => (
                  <TableRow key={k.id} className="hover:bg-muted/40">
                    <TableCell className="pl-4 text-sm font-medium">{k.name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{k.prefix}****</code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[260px]">
                        {k.scopes.map((s) => (
                          <Badge key={s} variant="outline" className="text-[10px] font-mono">{s}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{k.lastUsed}</TableCell>
                    <TableCell>
                      {k.status === "active" ? (
                        <Badge className="bg-primary text-primary-foreground text-[10px]">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Révoquée</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{k.created}</TableCell>
                    <TableCell className="pr-4">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toast.info(`Actions pour ${k.name}`)}>
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Rate limiting + usage chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" />
              Rate limiting
            </CardTitle>
            <CardDescription className="text-xs">Limites par clé API</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Par minute", value: 100, current: 42 },
              { label: "Par heure", value: 5000, current: 1240 },
              { label: "Par jour", value: 100000, current: 18900 },
            ].map((r) => {
              const pct = (r.current / r.value) * 100
              return (
                <div key={r.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{r.label}</span>
                    <span className="text-muted-foreground">{compact(r.current)} / {compact(r.value)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
              )
            })}
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => toast.info("Modification des limites")}>
              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
              Configurer
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Appels API · 7 derniers jours
            </CardTitle>
            <CardDescription className="text-xs">Total : {compact(apiUsageData.reduce((a, d) => a + d.calls, 0))} appels cette semaine</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={usageConfig} className="h-[220px] w-full">
              <BarChart data={apiUsageData} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => compact(Number(v))} />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar dataKey="calls" fill="var(--color-calls)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ===========================================================================
// Tab 5: Quota
// ===========================================================================

function QuotaTab() {
  const histConfig = { v: { label: "Appels", color: "var(--chart-1)" } } satisfies ChartConfig
  const pieConfig = scrapingBySource.reduce((acc, s) => {
    acc[s.name] = { label: s.name, color: s.color }
    return acc
  }, {} as ChartConfig)

  return (
    <div className="space-y-4">
      {/* Reset banner */}
      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Réinitialisation des quotas</p>
              <p className="text-xs text-muted-foreground">Les compteurs seront remis à zéro le <span className="font-medium text-foreground">1er fév. 2027</span></p>
            </div>
          </div>
          <Button className="gap-2" onClick={() => toast.info("Achat de quota supplémentaire")}>
            <Wallet className="h-4 w-4" />
            Acheter du quota
          </Button>
        </CardContent>
      </Card>

      {/* Quota bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {quotaData.map((q) => {
          const pct = (q.used / q.limit) * 100
          const over = q.used > q.limit
          const color = over || pct > 90 ? "destructive" : pct > 70 ? "accent" : "primary"
          const colorClass = color === "destructive" ? "text-destructive" : color === "accent" ? "text-accent-foreground" : "text-primary"
          const bgClass = color === "destructive" ? "bg-destructive" : color === "accent" ? "bg-accent" : "bg-primary"
          return (
            <Card key={q.label}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{q.label}</p>
                  {over ? (
                    <Badge className="bg-destructive text-destructive-foreground text-[10px] gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Limite dépassée
                    </Badge>
                  ) : pct > 90 ? (
                    <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">Critique</Badge>
                  ) : pct > 70 ? (
                    <Badge variant="outline" className="text-[10px] text-accent-foreground border-accent/30">Élevé</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/30">OK</Badge>
                  )}
                </div>
                <div className="flex items-end justify-between">
                  <p className={cn("text-2xl font-bold", colorClass)}>{compact(q.used)}</p>
                  <p className="text-xs text-muted-foreground">/ {compact(q.limit)} {q.unit}</p>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", bgClass)} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <p className={cn("text-[11px]", colorClass)}>
                  {over ? `Dépassement de ${compact(q.used - q.limit)} ${q.unit} (+${Math.round(pct - 100)}%)` : `${Math.round(pct)}% utilisé · ${compact(q.limit - q.used)} restants`}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* History + breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Historique quota · 7 jours
            </CardTitle>
            <CardDescription className="text-xs">Appels API quotidiens</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={histConfig} className="h-[200px] w-full">
              <AreaChart data={quotaHistory7d} margin={{ left: -10, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="qArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-v)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-v)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => compact(Number(v))} />
                <Tooltip content={<ChartTooltipContent />} />
                <Area dataKey="v" type="monotone" stroke="var(--color-v)" strokeWidth={2} fill="url(#qArea)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" />
              Par source
            </CardTitle>
            <CardDescription className="text-xs">Répartition des appels</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {quotaBySource.map((s) => {
              const total = quotaBySource.reduce((a, x) => a + x.value, 0)
              const pct = (s.value / total) * 100
              return (
                <div key={s.source} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                      {s.source}
                    </span>
                    <span className="text-muted-foreground">{compact(s.value)} · {Math.round(pct)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ===========================================================================
// Tab 6: Paiements
// ===========================================================================

function PaymentsTab() {
  const revConfig = { v: { label: "Revenu", color: "var(--chart-1)" } } satisfies ChartConfig
  const total12m = 1_020_000
  const methodMeta = {
    "Orange Money": { icon: Smartphone, className: "bg-accent/20 text-accent-foreground" },
    "MTN MoMo": { icon: Smartphone, className: "bg-primary/10 text-primary" },
    "Stripe": { icon: CardIcon, className: "bg-muted text-muted-foreground" },
    "Wave": { icon: Smartphone, className: "bg-primary/10 text-primary" },
  }
  const statusMetaPay = {
    paid: { label: "Payé", className: "bg-primary/10 text-primary border-primary/20" },
    pending: { label: "En attente", className: "bg-accent/20 text-accent-foreground border-accent/30" },
    failed: { label: "Échec", className: "bg-destructive/10 text-destructive border-destructive/30" },
  }

  return (
    <div className="space-y-4">
      {/* Revenue cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile label="Revenu 12 mois" value={formatFCFA(total12m)} icon={DollarSign} accent="primary" hint="Jan 2026 → Jan 2027" />
        <StatTile label="Impayés" value={formatFCFA(0)} icon={CheckCircle2} accent="primary" hint="Aucun en attente" />
        <StatTile label="Prochaine facturation" value="15 Jan 2027" icon={Calendar} accent="accent" hint={formatFCFA(85000)} />
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Revenus mensuels · 6 mois
          </CardTitle>
          <CardDescription className="text-xs">Total période : {formatFCFA(revenue6m.reduce((a, d) => a + d.v, 0))}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={revConfig} className="h-[220px] w-full">
            <BarChart data={revenue6m} margin={{ left: -10, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => compact(Number(v))} />
              <Tooltip content={<ChartTooltipContent />} />
              <Bar dataKey="v" fill="var(--color-v)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Payment history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Historique des paiements</CardTitle>
          <CardDescription className="text-xs">{paymentsData.length} transactions</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Date</TableHead>
                  <TableHead>Facture</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="pr-4 text-right">Facture PDF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paymentsData.map((p) => {
                  const m = methodMeta[p.method]
                  const MIcon = m.icon
                  const s = statusMetaPay[p.status]
                  return (
                    <TableRow key={p.id} className="hover:bg-muted/40">
                      <TableCell className="pl-4 text-sm">{p.date}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{p.invoice}</code>
                      </TableCell>
                      <TableCell className="text-sm font-semibold">{formatFCFA(p.amount)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={cn("flex h-6 w-6 items-center justify-center rounded", m.className)}>
                            <MIcon className="h-3 w-3" />
                          </span>
                          <span className="text-xs">{p.method}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{p.plan}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px]", s.className)}>{s.label}</Badge>
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 h-7"
                          onClick={() => toast.success(`Facture ${p.invoice} téléchargée`, { description: `${formatFCFA(p.amount)} · ${p.method}` })}
                          disabled={p.status !== "paid"}
                        >
                          <Download className="h-3.5 w-3.5" />
                          PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===========================================================================
// Tab 7: Statistiques
// ===========================================================================

function StatsTab() {
  const callsConfig = { calls: { label: "Appels API", color: "var(--chart-1)" } } satisfies ChartConfig
  const growthConfig = { v: { label: "Entreprises", color: "var(--chart-2)" } } satisfies ChartConfig
  const sourceConfig = scrapingBySource.reduce((acc, s) => {
    acc[s.name] = { label: s.name, color: s.color }
    return acc
  }, {} as ChartConfig)
  const sectorsConfig = { count: { label: "Entreprises", color: "var(--chart-3)" } } satisfies ChartConfig

  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatTile label="Utilisateurs" value="5 / 20" icon={Users} accent="primary" hint="actifs / plan" />
        <StatTile label="Entreprises" value="38 862" icon={Building2} accent="primary" hint="indexées" />
        <StatTile label="Appels API (30j)" value="428k" icon={Code2} accent="accent" hint="totaux" />
        <StatTile label="Exports (30j)" value="68" icon={Download} accent="accent" hint="fichiers générés" />
        <StatTile label="Temps réponse moyen" value="42 ms" icon={Zap} accent="muted" hint="API REST" />
        <StatTile label="Uptime" value="99.97%" icon={Activity} accent="primary" hint="30 derniers jours" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Appels API · 30 jours
            </CardTitle>
            <CardDescription className="text-xs">Évolution journalière</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={callsConfig} className="h-[220px] w-full">
              <AreaChart data={stats30d} margin={{ left: -10, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="statsArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-calls)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="var(--color-calls)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="d" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={5} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => compact(Number(v))} />
                <Tooltip content={<ChartTooltipContent />} />
                <Area dataKey="calls" type="monotone" stroke="var(--color-calls)" strokeWidth={2} fill="url(#statsArea)" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Croissance entreprises · 6 mois
            </CardTitle>
            <CardDescription className="text-xs">Total cumulé par mois</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={growthConfig} className="h-[220px] w-full">
              <LineChart data={companiesGrowth} margin={{ left: -10, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => compact(Number(v))} domain={[30000, 40000]} />
                <Tooltip content={<ChartTooltipContent />} />
                <Line dataKey="v" type="monotone" stroke="var(--color-v)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--color-v)" }} />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              Scraping par source
            </CardTitle>
            <CardDescription className="text-xs">Répartition des entreprises</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={sourceConfig} className="h-[220px] w-full">
              <PieChart>
                <Pie
                  data={scrapingBySource}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                >
                  {scrapingBySource.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltipContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {scrapingBySource.map((s) => (
                <Badge key={s.name} variant="outline" className="text-[10px] gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Top secteurs
            </CardTitle>
            <CardDescription className="text-xs">Par nombre d'entreprises</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={sectorsConfig} className="h-[220px] w-full">
              <BarChart data={topSectors} layout="vertical" margin={{ left: 60, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => compact(Number(v))} />
                <YAxis type="category" dataKey="sector" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} width={110} />
                <Tooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* System health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4 text-primary" />
            Santé système
          </CardTitle>
          <CardDescription className="text-xs">Ressources serveur en temps réel</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "CPU", value: 34, icon: Cpu },
            { label: "Mémoire", value: 58, icon: Cpu },
            { label: "Disque", value: 41, icon: HardDrive },
          ].map((m) => {
            const color = m.value > 90 ? "destructive" : m.value > 70 ? "accent" : "primary"
            const colorClass = color === "destructive" ? "text-destructive" : color === "accent" ? "text-accent-foreground" : "text-primary"
            return (
              <div key={m.label} className="space-y-2 p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <m.icon className="h-4 w-4 text-muted-foreground" />
                    {m.label}
                  </span>
                  <span className={cn("text-sm font-bold", colorClass)}>{m.value}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", color === "destructive" ? "bg-destructive" : color === "accent" ? "bg-accent" : "bg-primary")}
                    style={{ width: `${m.value}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {m.value > 90 ? "Charge critique" : m.value > 70 ? "Charge élevée" : "Charge normale"}
                </p>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}

// ===========================================================================
// Tab 8: Maintenance
// ===========================================================================

function MaintenanceTab() {
  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [services, setServices] = useState([
    { key: "web", label: "Web Application", status: "operational" as const, icon: Globe },
    { key: "api", label: "API REST", status: "operational" as const, icon: Code2 },
    { key: "db", label: "Database", status: "operational" as const, icon: Database },
    { key: "scrape", label: "Scraping Engine", status: "operational" as const, icon: Cpu },
    { key: "ai", label: "AI Engine", status: "operational" as const, icon: Activity },
    { key: "email", label: "Email Service", status: "degraded" as const, icon: Mail },
  ])

  const statusMetaSvc = {
    operational: { label: "Opérationnel", className: "bg-primary/10 text-primary border-primary/20", dot: "bg-primary", icon: CheckCircle2 },
    degraded: { label: "Dégradé", className: "bg-accent/20 text-accent-foreground border-accent/30", dot: "bg-accent", icon: AlertTriangle },
    maintenance: { label: "Maintenance", className: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground", icon: Wrench },
  }

  return (
    <div className="space-y-4">
      {/* Maintenance mode + scheduled window */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className={cn("lg:col-span-2", maintenanceMode && "border-accent/40 bg-accent/5")}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Power className="h-4 w-4 text-primary" />
              Mode maintenance
            </CardTitle>
            <CardDescription className="text-xs">
              {maintenanceMode
                ? "L'application est actuellement en maintenance. Les utilisateurs voient une page d'attente."
                : "Activez pour mettre l'application hors ligne temporairement."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-background">
              <div className="flex items-center gap-3">
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", maintenanceMode ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground")}>
                  {maintenanceMode ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                </div>
                <div>
                  <p className="text-sm font-medium">{maintenanceMode ? "Maintenance active" : "Service en ligne"}</p>
                  <p className="text-[11px] text-muted-foreground">{maintenanceMode ? "Toggle pour reprendre" : "Aucune interruption"}</p>
                </div>
              </div>
              <Switch checked={maintenanceMode} onCheckedChange={(c) => {
                setMaintenanceMode(c)
                toast.success(c ? "Mode maintenance activé" : "Service remis en ligne", {
                  description: c ? "Les utilisateurs voient désormais une page d'attente." : "L'application est de nouveau accessible.",
                })
              }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Fenêtre planifiée
            </CardTitle>
            <CardDescription className="text-xs">Prochaine maintenance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">22 jan. 2027</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>02:00 → 04:00 (UTC)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
              <Wrench className="h-3.5 w-3.5" />
              Mise à jour moteur scraping v2.1
            </div>
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => toast.info("Modification de la fenêtre planifiée")}>
              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
              Modifier
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Services status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                État des services
              </CardTitle>
              <CardDescription className="text-xs">6 services monitorés · {services.filter((s) => s.status === "operational").length} opérationnels</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => {
              toast.success("Cache système vidé", { description: "Redis + CDN + app cache purgés." })
            }}>
              <Trash2 className="h-3.5 w-3.5" />
              Vider le cache
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {services.map((s) => {
              const meta = statusMetaSvc[s.status]
              const SIcon = s.icon
              const MIcon = meta.icon
              return (
                <div key={s.key} className="flex items-center gap-3 p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground shrink-0">
                    <SIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-[11px] text-muted-foreground">{s.key}.scraapiq.ci</p>
                  </div>
                  <Badge variant="outline" className={cn("gap-1.5 text-[10px]", meta.className)}>
                    <MIcon className="h-3 w-3" />
                    {meta.label}
                  </Badge>
                  <TooltipProvider>
                    <UITooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            toast.info(`Redémarrage de ${s.label}…`, { description: "L'opération peut prendre 30 secondes." })
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Redémarrer le service</TooltipContent>
                    </UITooltip>
                  </TooltipProvider>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Backup status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4 text-primary" />
            Sauvegarde
          </CardTitle>
          <CardDescription className="text-xs">Statut des backups automatiques</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border bg-muted/20">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Dernier backup</p>
              <p className="text-sm font-semibold mt-1">15 jan. 2027 · 03:00</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Taille</p>
              <p className="text-sm font-semibold mt-1">1.2 GB</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Statut</p>
              <div className="mt-1">
                <Badge className="bg-primary text-primary-foreground text-[10px] gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Réussi
                </Badge>
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/20">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Prochaine</p>
              <p className="text-sm font-semibold mt-1">16 jan. 2027 · 03:00</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.success("Backup manuel déclenché", { description: "Estimated time: 4 minutes." })}>
              <Database className="h-3.5 w-3.5" />
              Backup manuel
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.info("Restauration depuis backup")}>
              <RefreshCw className="h-3.5 w-3.5" />
              Restaurer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ===========================================================================
// Tab 9: Audit
// ===========================================================================

function AuditTab() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    return auditData.filter((a) => {
      const matchCat = categoryFilter === "all" || a.category === categoryFilter
      const matchSev = severityFilter === "all" || a.severity === severityFilter
      const matchQuery = !query || a.action.toLowerCase().includes(query.toLowerCase()) || a.user.toLowerCase().includes(query.toLowerCase()) || a.details.toLowerCase().includes(query.toLowerCase())
      return matchCat && matchSev && matchQuery
    })
  }, [categoryFilter, severityFilter, query])

  const total = auditData.length
  const criticalCount = auditData.filter((a) => a.severity === "critical").length
  const securityEvents = auditData.filter((a) => a.category === "security").length

  const categoryMeta: Record<AuditRow["category"], { label: string; className: string }> = {
    auth: { label: "Auth", className: "bg-primary/10 text-primary border-primary/20" },
    security: { label: "Security", className: "bg-destructive/10 text-destructive border-destructive/30" },
    oauth: { label: "OAuth", className: "bg-accent/20 text-accent-foreground border-accent/30" },
    api: { label: "API", className: "bg-muted text-muted-foreground border-border" },
    data: { label: "Data", className: "bg-primary/10 text-primary border-primary/20" },
  }

  const severityMeta: Record<AuditRow["severity"], { label: string; className: string }> = {
    info: { label: "INFO", className: "bg-primary/10 text-primary border-primary/20" },
    warn: { label: "WARN", className: "bg-accent/20 text-accent-foreground border-accent/30" },
    error: { label: "ERROR", className: "bg-destructive/10 text-destructive border-destructive/30" },
    critical: { label: "CRIT", className: "bg-destructive text-destructive-foreground border-destructive" },
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Total événements" value={total} icon={FileSearch} accent="primary" />
        <StatTile label="Événements critiques" value={criticalCount} icon={ShieldAlert} accent="accent" />
        <StatTile label="Événements sécurité" value={securityEvents} icon={Lock} accent="muted" />
        <StatTile label="Période" value="24 h" icon={Clock} accent="muted" hint="dernières heures" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FileSearch className="h-4 w-4 text-primary" />
                Journal d'audit
              </CardTitle>
              <CardDescription className="text-xs">{filtered.length} entrée(s) sur {total}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher action, user, détails…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-8 h-9 w-[220px]"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="Catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  <SelectItem value="auth">Auth</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="oauth">OAuth</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="data">Data</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="h-9 w-[130px]">
                  <SelectValue placeholder="Sévérité" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes sévérités</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => toast.success("Audit exporté", { description: "Fichier audit_2027-01-15.csv généré." })}>
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Timestamp</TableHead>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Sévérité</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead className="pr-4">Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => {
                  const c = categoryMeta[a.category]
                  const s = severityMeta[a.severity]
                  return (
                    <TableRow key={a.id} className={cn("hover:bg-muted/40", a.severity === "critical" && "bg-destructive/5")}>
                      <TableCell className="pl-4 text-[11px] font-mono text-muted-foreground whitespace-nowrap">{a.ts}</TableCell>
                      <TableCell className="text-xs">{a.user}</TableCell>
                      <TableCell>
                        <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{a.action}</code>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px]", c.className)}>{c.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px] font-mono", s.className)}>{s.label}</Badge>
                      </TableCell>
                      <TableCell className="text-[11px] font-mono text-muted-foreground">{a.ip}</TableCell>
                      <TableCell className="pr-4 text-xs text-muted-foreground max-w-[320px] truncate" title={a.details}>{a.details}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y">
            {filtered.map((a) => {
              const c = categoryMeta[a.category]
              const s = severityMeta[a.severity]
              return (
                <div key={a.id} className={cn("p-4 space-y-1.5", a.severity === "critical" && "bg-destructive/5")}>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded">{a.action}</code>
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={cn("text-[10px]", c.className)}>{c.label}</Badge>
                      <Badge variant="outline" className={cn("text-[10px] font-mono", s.className)}>{s.label}</Badge>
                    </div>
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground">{a.ts}</p>
                  <p className="text-xs">{a.user}</p>
                  <p className="text-xs text-muted-foreground">{a.details}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">IP: {a.ip}</p>
                </div>
              )
            })}
          </div>

          {filtered.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">Aucun événement ne correspond aux filtres.</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
