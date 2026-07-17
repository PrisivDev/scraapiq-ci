"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Building2, Key, CreditCard, Gauge, Users, Shield, Crown,
  Plus, Download, Copy, CheckCircle2, XCircle, Loader2,
  Zap, FileText, RefreshCw, Trash2, Star, Award, Lock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface PlanDef {
  code: string
  name: string
  priceMonthlyXOF: number
  priceYearlyXOF: number
  maxUsers: number
  maxCompanies: number
  maxApiCalls: number
  maxExports: number
  maxSources: number
  maxWorkspaces: number
  features: string[]
  popular?: boolean
}

interface LicenseInfo {
  id: string
  key: string
  plan: string
  planName: string
  status: string
  maxUsers: number
  maxCompanies: number
  maxApiCalls: number
  features: string[]
  activatedAt: string | null
  expiresAt: string | null
}

interface QuotaStatus {
  maxUsers: number
  maxCompanies: number
  maxApiCalls: number
  maxExports: number
  current: { users: number; companies: number; apiCalls: number; exports: number }
  usage: { users: number; companies: number; apiCalls: number; exports: number }
  exceeded: string[]
}

interface ApiKeyInfo {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
  fullKey?: string
}

interface InvoiceInfo {
  id: string
  number: string
  amountXOF: number
  taxXOF: number
  totalXOF: number
  status: string
  dueDate: string
  paidAt: string | null
  items: Array<{ description: string; amount: number }>
  createdAt: string
}

export function SaasView() {
  const [tab, setTab] = useState("overview")
  const [plans, setPlans] = useState<PlanDef[]>([])
  const [licenses, setLicenses] = useState<LicenseInfo[]>([])
  const [quota, setQuota] = useState<QuotaStatus | null>(null)
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([])
  const [invoices, setInvoices] = useState<InvoiceInfo[]>([])
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/saas", { credentials: "include" })
      if (!res.ok) return
      const d = await res.json()
      setPlans(d.plans || [])
      setLicenses(d.licenses || [])
      setStats(d.stats || null)
    } catch {}
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const fetchQuota = async () => {
    const res = await fetch("/api/v1/saas?view=quota", { credentials: "include" })
    if (res.ok) { const d = await res.json(); setQuota(d.quota) }
  }

  const fetchApiKeys = async () => {
    const res = await fetch("/api/v1/saas?view=api-keys", { credentials: "include" })
    if (res.ok) { const d = await res.json(); setApiKeys(d.keys) }
  }

  const fetchInvoices = async () => {
    const res = await fetch("/api/v1/saas?view=billing", { credentials: "include" })
    if (res.ok) { const d = await res.json(); setInvoices(d.invoices) }
  }

  useEffect(() => {
    if (tab === "quota") fetchQuota()
    if (tab === "apikeys") fetchApiKeys()
    if (tab === "billing") fetchInvoices()
  }, [tab])

  const generateLic = async (plan: string) => {
    setLoading(true)
    try {
      const res = await fetch("/api/v1/saas", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ action: "generate_license", plan }),
      })
      if (!res.ok) throw new Error()
      const d = await res.json()
      toast.success("Licence générée", { description: d.license.key })
      fetchData()
    } catch { toast.error("Erreur génération licence") }
    finally { setLoading(false) }
  }

  const activateLic = async (key: string, orgId: string) => {
    setLoading(true)
    try {
      const res = await fetch("/api/v1/saas", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ action: "activate_license", licenseKey: key, organizationId: orgId }),
      })
      if (!res.ok) throw new Error()
      toast.success("Licence activée")
      fetchData()
    } catch { toast.error("Erreur activation") }
    finally { setLoading(false) }
  }

  const createKey = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/v1/saas", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ action: "create_api_key", name: `Key-${Date.now()}`, scopes: ["read", "write"] }),
      })
      if (!res.ok) throw new Error()
      const d = await res.json()
      toast.success("Clé API créée", { description: d.key.fullKey })
      fetchApiKeys()
    } catch { toast.error("Erreur création clé") }
    finally { setLoading(false) }
  }

  const revokeKey = async (keyId: string) => {
    try {
      await fetch(`/api/v1/saas?keyId=${keyId}`, { method: "DELETE", credentials: "include" })
      toast.success("Clé révoquée")
      fetchApiKeys()
    } catch { toast.error("Erreur") }
  }

  const tabs = [
    { key: "overview", label: "Vue d'ensemble", icon: Building2 },
    { key: "license", label: "Licences", icon: Key },
    { key: "plans", label: "Plans & Abonnements", icon: CreditCard },
    { key: "quota", label: "Quota", icon: Gauge },
    { key: "users", label: "Utilisateurs", icon: Users },
    { key: "permissions", label: "Permissions", icon: Shield },
    { key: "apikeys", label: "API Keys", icon: Zap },
    { key: "billing", label: "Facturation", icon: FileText },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            SaaS Enterprise
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Organisation · Workspace · Licence · Quota · Utilisateurs · Permissions · API Keys · Facturation
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={fetchData}>
          <RefreshCw className="h-3.5 w-3.5" /> Actualiser
        </Button>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-accent")}>
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          )
        })}
      </div>

      {tab === "overview" && <OverviewTab stats={stats} plans={plans} licenses={licenses} />}
      {tab === "license" && <LicenseTab licenses={licenses} onGenerate={generateLic} onActivate={activateLic} loading={loading} />}
      {tab === "plans" && <PlansTab plans={plans} />}
      {tab === "quota" && <QuotaTab quota={quota} />}
      {tab === "users" && <UsersTab />}
      {tab === "permissions" && <PermissionsTab />}
      {tab === "apikeys" && <ApiKeysTab keys={apiKeys} onCreate={createKey} onRevoke={revokeKey} loading={loading} />}
      {tab === "billing" && <BillingTab invoices={invoices} />}
    </div>
  )
}

function OverviewTab({ stats, plans, licenses }: { stats: Record<string, number> | null; plans: PlanDef[]; licenses: LicenseInfo[] }) {
  const cards = [
    { label: "Organisations", value: stats?.totalOrgs || 0, icon: Building2, color: "emerald" },
    { label: "Licences actives", value: stats?.activeLicenses || 0, icon: Key, color: "orange" },
    { label: "Abonnements actifs", value: stats?.activeSubs || 0, icon: CreditCard, color: "emerald" },
    { label: "Revenu total (FCFA)", value: ((stats?.totalRevenueXOF || 0) / 1000).toFixed(0) + "k", icon: Zap, color: "orange" },
    { label: "Factures payées", value: stats?.paidInvoices || 0, icon: FileText, color: "emerald" },
    { label: "Clés API actives", value: stats?.activeApiKeys || 0, icon: Zap, color: "orange" },
  ]
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => { const Icon = c.icon; return (
          <Card key={c.label}><CardContent className="p-3">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg mb-2",
              c.color === "emerald" && "bg-emerald-500/10 text-emerald-600",
              c.color === "orange" && "bg-orange-500/10 text-orange-600")}>
              <Icon className="h-4 w-4" /></div>
            <p className="text-xl font-bold">{c.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase">{c.label}</p>
          </CardContent></Card>
        )})}
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Plans disponibles</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {plans.map((p) => (
              <div key={p.code} className={cn("rounded-lg border p-3", p.popular && "border-primary ring-1 ring-primary/20")}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm">{p.name}</span>
                  {p.popular && <Badge className="text-[9px]">Populaire</Badge>}
                </div>
                <p className="text-lg font-bold">{p.priceMonthlyXOF.toLocaleString("fr-FR")} <span className="text-xs font-normal text-muted-foreground">FCFA/mois</span></p>
                <p className="text-[10px] text-muted-foreground mt-1">{p.maxUsers} users · {p.maxCompanies.toLocaleString("fr-FR")} entr. · {p.maxApiCalls.toLocaleString("fr-FR")} API</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function LicenseTab({ licenses, onGenerate, onActivate, loading }: {
  licenses: LicenseInfo[]; onGenerate: (plan: string) => void; onActivate: (key: string, orgId: string) => void; loading: boolean
}) {
  const [activateKey, setActivateKey] = useState("")
  const [activateOrg, setActivateOrg] = useState("")

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Générer une licence</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {["starter", "pro", "enterprise"].map((p) => (
              <Button key={p} variant="outline" size="sm" disabled={loading} onClick={() => onGenerate(p)} className="gap-2 capitalize">
                <Key className="h-3.5 w-3.5" /> {p}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Activer une licence</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input placeholder="SQCI-XXXX-XXXX-XXXX" value={activateKey} onChange={(e) => setActivateKey(e.target.value)} className="flex-1" />
            <Input placeholder="org-id" value={activateOrg} onChange={(e) => setActivateOrg(e.target.value)} className="w-40" />
            <Button disabled={loading || !activateKey || !activateOrg} onClick={() => onActivate(activateKey, activateOrg)} className="gap-2">
              <Lock className="h-4 w-4" /> Activer
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Licences ({licenses.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {licenses.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Aucune licence générée</div>
            ) : licenses.map((l) => (
              <div key={l.id} className="flex items-center gap-3 p-3">
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  l.status === "active" ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-600")}>
                  <Key className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono truncate">{l.key}</p>
                  <p className="text-[10px] text-muted-foreground">{l.planName} · {l.maxUsers} users · {l.maxCompanies.toLocaleString("fr-FR")} entr.</p>
                </div>
                <Badge variant="outline" className={cn("text-[9px] shrink-0",
                  l.status === "active" && "bg-emerald-500/10 text-emerald-600",
                  l.status === "inactive" && "bg-slate-500/10 text-slate-600",
                  l.status === "expired" && "bg-red-500/10 text-red-600")}>
                  {l.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function PlansTab({ plans }: { plans: PlanDef[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {plans.map((p) => (
        <Card key={p.code} className={cn(p.popular && "border-primary ring-1 ring-primary/20")}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{p.name}</CardTitle>
              {p.popular && <Badge className="text-[9px] gap-1"><Star className="h-2.5 w-2.5" /> Populaire</Badge>}
            </div>
            <CardDescription className="text-xs">{p.priceMonthlyXOF > 0 ? `${p.priceMonthlyXOF.toLocaleString("fr-FR")} FCFA/mois` : "Sur devis"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center gap-1"><Users className="h-3 w-3 text-primary" /> {p.maxUsers} users</div>
              <div className="flex items-center gap-1"><Building2 className="h-3 w-3 text-primary" /> {p.maxCompanies.toLocaleString("fr-FR")}</div>
              <div className="flex items-center gap-1"><Zap className="h-3 w-3 text-primary" /> {p.maxApiCalls.toLocaleString("fr-FR")} API</div>
              <div className="flex items-center gap-1"><Download className="h-3 w-3 text-primary" /> {p.maxExports} exports</div>
              <div className="flex items-center gap-1"><Building2 className="h-3 w-3 text-primary" /> {p.maxSources} sources</div>
              <div className="flex items-center gap-1"><Building2 className="h-3 w-3 text-primary" /> {p.maxWorkspaces} WS</div>
            </div>
            <div className="pt-2 border-t">
              {p.features.map((f, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px] py-0.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0 mt-0.5" /> {f}
                </div>
              ))}
            </div>
            <Button className="w-full mt-2" variant={p.popular ? "default" : "outline"} size="sm">
              {p.code === "custom" ? "Contactez-nous" : `Choisir ${p.name}`}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function QuotaTab({ quota }: { quota: QuotaStatus | null }) {
  if (!quota) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Chargement du quota…</CardContent></Card>
  const items = [
    { label: "Utilisateurs", current: quota.current.users, max: quota.maxUsers, usage: quota.usage.users, icon: Users },
    { label: "Entreprises", current: quota.current.companies, max: quota.maxCompanies, usage: quota.usage.companies, icon: Building2 },
    { label: "Appels API", current: quota.current.apiCalls, max: quota.maxApiCalls, usage: quota.usage.apiCalls, icon: Zap },
    { label: "Exports", current: quota.current.exports, max: quota.maxExports, usage: quota.usage.exports, icon: Download },
  ]
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {items.map((it) => { const Icon = it.icon; return (
        <Card key={it.label}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>
                <span className="text-sm font-medium">{it.label}</span>
              </div>
              <span className={cn("text-xs font-bold", it.usage >= 100 ? "text-red-600" : it.usage >= 80 ? "text-orange-600" : "text-emerald-600")}>
                {it.usage}%
              </span>
            </div>
            <Progress value={Math.min(it.usage, 100)} className={cn("h-2", it.usage >= 100 && "[&>div]:bg-red-500", it.usage >= 80 && "[&>div]:bg-orange-500")} />
            <p className="text-[10px] text-muted-foreground mt-1">{it.current.toLocaleString("fr-FR")} / {it.max.toLocaleString("fr-FR")}</p>
            {it.usage >= 100 && <p className="text-[10px] text-red-600 mt-1">⚠ Quota dépassé</p>}
          </CardContent>
        </Card>
      )})}
    </div>
  )
}

function UsersTab() {
  const roles = [
    { role: "OWNER", label: "Owner", icon: Crown, color: "amber", perms: 22, desc: "Contrôle total" },
    { role: "ADMIN", label: "Admin", icon: Shield, color: "emerald", perms: 18, desc: "Gestion org" },
    { role: "MANAGER", label: "Manager", icon: Award, color: "blue", perms: 12, desc: "Gestion équipe" },
    { role: "AGENT", label: "Agent", icon: Users, color: "violet", perms: 7, desc: "Opérations" },
    { role: "VIEWER", label: "Viewer", icon: Users, color: "slate", perms: 3, desc: "Lecture seule" },
  ]
  return (
    <div className="space-y-3">
      {roles.map((r) => { const Icon = r.icon; return (
        <Card key={r.role}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg",
              r.color === "amber" && "bg-amber-500/10 text-amber-600",
              r.color === "emerald" && "bg-emerald-500/10 text-emerald-600",
              r.color === "blue" && "bg-blue-500/10 text-blue-600",
              r.color === "violet" && "bg-violet-500/10 text-violet-600",
              r.color === "slate" && "bg-slate-500/10 text-slate-600")}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{r.label} <span className="text-[10px] text-muted-foreground font-mono">({r.role})</span></p>
              <p className="text-[10px] text-muted-foreground">{r.desc} · {r.perms} permissions</p>
            </div>
            <Badge variant="outline" className="text-[9px]">{r.perms} perms</Badge>
          </CardContent>
        </Card>
      )})}
    </div>
  )
}

function PermissionsTab() {
  const permissions = [
    { category: "Entreprises", perms: ["company:read", "company:create", "company:update", "company:delete", "company:export"] },
    { category: "Scraping", perms: ["job:read", "job:create", "job:cancel", "job:delete"] },
    { category: "Sources", perms: ["source:read", "source:manage"] },
    { category: "Équipe", perms: ["member:read", "member:invite", "member:remove", "member:update_role"] },
    { category: "API", perms: ["api_key:manage", "export:create"] },
    { category: "Admin", perms: ["org:settings", "org:billing", "audit:read", "session:revoke"] },
  ]
  const roleMatrix: Record<string, boolean[]> = {
    OWNER: [true, true, true, true, true, true],
    ADMIN: [true, true, true, true, true, false],
    MANAGER: [true, true, true, true, false, false],
    AGENT: [true, true, false, false, false, false],
    VIEWER: [true, false, false, false, false, false],
  }
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Matrice permissions (RBAC)</CardTitle></CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/30">
              <tr className="text-left">
                <th className="p-2 font-medium">Catégorie</th>
                <th className="p-2 font-medium">Permission</th>
                {Object.keys(roleMatrix).map((r) => <th key={r} className="p-2 font-medium text-center">{r}</th>)}
              </tr>
            </thead>
            <tbody>
              {permissions.map((cat) => cat.perms.map((perm, i) => (
                <tr key={perm} className="border-b last:border-b-0 hover:bg-muted/20">
                  {i === 0 && <td className="p-2 font-medium" rowSpan={cat.perms.length}>{cat.category}</td>}
                  <td className="p-2 font-mono text-[10px]">{perm}</td>
                  {Object.entries(roleMatrix).map(([role, allowed]) => (
                    <td key={role} className="p-2 text-center">
                      {allowed[permissions.indexOf(cat)] ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 inline" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-slate-300 inline" />
                      )}
                    </td>
                  ))}
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function ApiKeysTab({ keys, onCreate, onRevoke, loading }: {
  keys: ApiKeyInfo[]; onCreate: () => void; onRevoke: (id: string) => void; loading: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Clés API ({keys.length})</p>
        <Button size="sm" onClick={onCreate} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Générer
        </Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {keys.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Aucune clé API. Cliquez sur "Générer".</div>
            ) : keys.map((k) => (
              <div key={k.id} className="flex items-center gap-3 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <Zap className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{k.name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{k.keyPrefix}••••••••</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {k.scopes.map((s) => <Badge key={s} variant="outline" className="text-[9px]">{s}</Badge>)}
                  </div>
                </div>
                {k.revokedAt ? (
                  <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-600 shrink-0">Révoquée</Badge>
                ) : (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onRevoke(k.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function BillingTab({ invoices }: { invoices: InvoiceInfo[] }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{invoices.length}</p><p className="text-[10px] text-muted-foreground uppercase">Factures</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-emerald-600">{invoices.filter((i) => i.status === "paid").length}</p><p className="text-[10px] text-muted-foreground uppercase">Payées</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-orange-600">{invoices.filter((i) => i.status === "pending").length}</p><p className="text-[10px] text-muted-foreground uppercase">En attente</p></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {invoices.length === 0 ? (
              <div className="p-6 text-center text-xs text-muted-foreground">Aucune facture</div>
            ) : invoices.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 p-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium font-mono">{inv.number}</p>
                  <p className="text-[10px] text-muted-foreground">{inv.totalXOF.toLocaleString("fr-FR")} FCFA TTC</p>
                </div>
                <Badge variant="outline" className={cn("text-[9px] shrink-0",
                  inv.status === "paid" && "bg-emerald-500/10 text-emerald-600",
                  inv.status === "pending" && "bg-orange-500/10 text-orange-600")}>
                  {inv.status}
                </Badge>
                {inv.status === "paid" && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><Download className="h-3.5 w-3.5" /></Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
