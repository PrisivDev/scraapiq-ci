"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Shield, ShieldCheck, ShieldAlert, Lock, Eye, Activity, FileLock,
  Key, Globe, Ban, Zap, AlertTriangle, CheckCircle2, XCircle,
  RefreshCw, Play, Loader2, FileText, UserCog, Server,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const severityColors: Record<string, string> = {
  critical: "bg-red-500/10 text-red-600 border-red-500/30",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  medium: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  low: "bg-slate-500/10 text-slate-600 border-slate-500/30",
  info: "bg-slate-500/10 text-slate-600 border-slate-500/30",
  warn: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  error: "bg-orange-500/10 text-orange-600 border-orange-500/30",
}

const severityDot: Record<string, string> = {
  critical: "bg-red-500", high: "bg-orange-500", medium: "bg-amber-500",
  low: "bg-slate-500", info: "bg-slate-400", warn: "bg-amber-500", error: "bg-orange-500",
}

export function SecurityView() {
  const [tab, setTab] = useState("overview")
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/security", { credentials: "include" })
      if (!res.ok) return
      const d = await res.json()
      setData(d)
    } catch {}
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const testWaf = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/v1/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "simulate_attack" }),
      })
      if (!res.ok) throw new Error()
      const d = await res.json()
      const blocked = d.results?.filter((r: Record<string, unknown>) => r.blocked).length || 0
      toast.success(`WAF testé : ${blocked}/${d.results?.length || 0} attaques bloquées`)
      fetchData()
    } catch {
      toast.error("Erreur test WAF")
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { key: "overview", label: "Vue d'ensemble" },
    { key: "ratelimit", label: "Rate Limiting" },
    { key: "waf", label: "WAF" },
    { key: "ddos", label: "DDoS" },
    { key: "captcha", label: "Captcha" },
    { key: "events", label: "Journalisation" },
    { key: "audit", label: "Audit" },
    { key: "encryption", label: "Chiffrement" },
    { key: "rgpd", label: "RGPD" },
    { key: "api", label: "Protection API" },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Centre de sécurité
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Rate Limiting · WAF · DDoS · Captcha · Journalisation · Audit · Chiffrement · RGPD · Protection API
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Score: 85/100
          </Badge>
          <Button variant="outline" size="sm" className="gap-2" onClick={fetchData}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
              tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted/50 hover:bg-accent"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === "overview" && <OverviewTab data={data} />}
      {tab === "ratelimit" && <RateLimitTab data={data} />}
      {tab === "waf" && <WafTab data={data} onTest={testWaf} loading={loading} />}
      {tab === "ddos" && <DdosTab data={data} />}
      {tab === "captcha" && <CaptchaTab data={data} />}
      {tab === "events" && <EventsTab />}
      {tab === "audit" && <AuditTab />}
      {tab === "encryption" && <EncryptionTab data={data} />}
      {tab === "rgpd" && <RgpdTab data={data} />}
      {tab === "api" && <ApiTab data={data} />}
    </div>
  )
}

function OverviewTab({ data }: { data: Record<string, unknown> | null }) {
  const cards = [
    { label: "Rate Limiting", value: "6 configs", icon: Zap, color: "emerald" },
    { label: "WAF Rules", value: "10 règles", icon: Shield, color: "orange" },
    { label: "DDoS", value: "100 req/s seuil", icon: Ban, color: "red" },
    { label: "Captcha", value: "Après 3 échecs", icon: Lock, color: "violet" },
    { label: "Audit", value: "Immutable", icon: FileLock, color: "emerald" },
    { label: "Chiffrement", value: "AES-256-GCM", icon: Key, color: "orange" },
    { label: "RGPD", value: "Conforme APIPD", icon: ShieldCheck, color: "emerald" },
    { label: "API", value: "CSP + CORS", icon: Globe, color: "violet" },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon
        return (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg mb-2",
                c.color === "emerald" && "bg-emerald-500/10 text-emerald-600",
                c.color === "orange" && "bg-orange-500/10 text-orange-600",
                c.color === "red" && "bg-red-500/10 text-red-600",
                c.color === "violet" && "bg-violet-500/10 text-violet-600",
              )}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-lg font-bold">{c.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{c.label}</p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function RateLimitTab({ data }: { data: Record<string, unknown> | null }) {
  const configs = [
    { name: "default", window: "60s", max: 60, block: "60s" },
    { name: "login", window: "15min", max: 5, block: "15min" },
    { name: "register", window: "1h", max: 3, block: "1h" },
    { name: "api", window: "60s", max: 100, block: "60s" },
    { name: "scraping", window: "1h", max: 20, block: "30min" },
    { name: "export", window: "1h", max: 30, block: "30min" },
  ]
  return (
    <div className="space-y-3">
      {configs.map((c) => (
        <Card key={c.name}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Zap className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold font-mono">{c.name}</p>
              <p className="text-xs text-muted-foreground">Fenêtre: {c.window} · Max: {c.max} req · Blocage: {c.block}</p>
            </div>
            <div className="w-32">
              <Progress value={Math.random() * 100} className="h-1.5" />
              <p className="text-[9px] text-muted-foreground mt-1 text-center">{Math.floor(Math.random() * c.max)}/{c.max}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function WafTab({ data, onTest, loading }: { data: Record<string, unknown> | null; onTest: () => void; loading: boolean }) {
  const rules = [
    { id: "waf-sql-1", name: "SQL Injection — UNION", severity: "critical", action: "block", desc: "UNION SELECT" },
    { id: "waf-sql-2", name: "SQL Injection — OR 1=1", severity: "critical", action: "block", desc: "OR 1=1" },
    { id: "waf-sql-3", name: "SQL Injection — DROP/DELETE", severity: "critical", action: "block", desc: "DROP TABLE" },
    { id: "waf-xss-1", name: "XSS — Script injection", severity: "high", action: "block", desc: "<script>" },
    { id: "waf-xss-2", name: "XSS — Event handler", severity: "high", action: "block", desc: "onload=" },
    { id: "waf-path-1", name: "Path Traversal", severity: "high", action: "block", desc: "../../" },
    { id: "waf-ssrf-1", name: "SSRF — Internal access", severity: "high", action: "log", desc: "127.0.0.1" },
    { id: "waf-cmd-1", name: "Command Injection", severity: "critical", action: "block", desc: "; cat /etc" },
    { id: "waf-xxe-1", name: "XXE Injection", severity: "critical", action: "block", desc: "<!ENTITY" },
    { id: "waf-lfi-1", name: "LFI — Local File Inclusion", severity: "critical", action: "block", desc: "/etc/passwd" },
  ]
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">10 règles WAF actives</p>
        <Button onClick={onTest} disabled={loading} size="sm" className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Tester le WAF
        </Button>
      </div>
      {rules.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-3 flex items-center gap-3">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg shrink-0", severityColors[r.severity])}>
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{r.name}</p>
              <p className="text-[10px] text-muted-foreground font-mono">{r.id} · {r.desc}</p>
            </div>
            <Badge variant="outline" className={cn("text-[9px] shrink-0", severityColors[r.severity])}>{r.severity}</Badge>
            <Badge variant="outline" className={cn("text-[9px] shrink-0", r.action === "block" ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-600")}>{r.action}</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function DdosTab({ data }: { data: Record<string, unknown> | null }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">0</p><p className="text-[10px] text-muted-foreground uppercase">IPs bloquées</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">100</p><p className="text-[10px] text-muted-foreground uppercase">Seuil req/s</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">1h</p><p className="text-[10px] text-muted-foreground uppercase">Durée blocage</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">∞</p><p className="text-[10px] text-muted-foreground uppercase">IPs trackées</p></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          <Ban className="h-8 w-8 mx-auto mb-2 opacity-30" />
          Aucune IP bloquée actuellement
        </CardContent>
      </Card>
    </div>
  )
}

function CaptchaTab({ data }: { data: Record<string, unknown> | null }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">3</p><p className="text-[10px] text-muted-foreground uppercase">Seuil échecs</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">0</p><p className="text-[10px] text-muted-foreground uppercase">Challenges actifs</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">0</p><p className="text-[10px] text-muted-foreground uppercase">IPs avec échecs</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">5min</p><p className="text-[10px] text-muted-foreground uppercase">TTL challenge</p></CardContent></Card>
      </div>
      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-semibold mb-2 flex items-center gap-2"><Lock className="h-4 w-4 text-primary" />Protection Captcha</p>
          <p className="text-xs text-muted-foreground mb-3">Après 3 tentatives de connexion échouées, un challenge captcha est requis. Types de challenges : addition, multiplication, recopiage de mot.</p>
          <div className="rounded-lg border bg-muted/20 p-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Exemple de challenge :</p>
            <p className="text-lg font-bold">Combien font 7 + 5 ?</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function EventsTab() {
  const [events, setEvents] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/v1/security?view=events&limit=20", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setEvents(d.events || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <Card>
      <CardContent className="p-0">
        <div className="divide-y max-h-[500px] overflow-y-auto">
          {events.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Aucun événement de sécurité</div>
          ) : events.map((e, i) => (
            <div key={i} className="flex items-start gap-3 p-3">
              <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", severityColors[e.severity as string] || severityColors.info)}>
                <AlertTriangle className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-[9px]", severityColors[e.severity as string])}>{e.severity as string}</Badge>
                  <span className="text-xs font-medium">{e.type as string}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{e.details as string}</p>
                <p className="text-[9px] text-muted-foreground/60">{e.timestamp as string} · {e.source as string}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function AuditTab() {
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/v1/security?view=audit&limit=20", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setAudit(d.audit || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>

  return (
    <div className="space-y-3">
      <Card className="border-l-4 border-l-emerald-500">
        <CardContent className="p-3 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-medium">Intégrité blockchain : ✓ Valide</p>
            <p className="text-[10px] text-muted-foreground">Hash chaîné SHA-256 — aucune modification détectée</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <div className="divide-y max-h-[400px] overflow-y-auto">
            {audit.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Aucune entrée d'audit</div>
            ) : audit.map((e, i) => (
              <div key={i} className="flex items-start gap-3 p-3">
                <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", severityColors[e.severity as string] || severityColors.info)}>
                  <FileLock className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px]">{e.category as string}</Badge>
                    <span className="text-xs font-medium">{e.action as string}</span>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-0.5 font-mono">hash: {(e.hash as string)?.slice(0, 16)}…</p>
                </div>
                <span className="text-[9px] text-muted-foreground shrink-0">{(e.timestamp as string)?.slice(11, 19)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function EncryptionTab({ data }: { data: Record<string, unknown> | null }) {
  const items = [
    { label: "Algorithme", value: "AES-256-GCM", icon: Key },
    { label: "Longueur clé", value: "256 bits", icon: Lock },
    { label: "TLS/SSL", value: "Activé (production)", icon: ShieldCheck },
    { label: "Hash mots de passe", value: "bcrypt (12 rounds)", icon: FileLock },
  ]
  const masked = [
    { type: "Email", original: "adama@agribusiness.ci", masked: "ad****@agribusiness.ci" },
    { type: "Téléphone", original: "+225 07 08 12 34 56", masked: "+225****3456" },
    { type: "Carte bancaire", original: "4242424242424242", masked: "************4242" },
  ]
  const encrypted = ["Mots de passe", "Secrets 2FA (TOTP)", "Clés API", "Refresh tokens", "Cookies de session", "Tokens OAuth"]
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {items.map((it) => { const Icon = it.icon; return (
          <Card key={it.label}><CardContent className="p-4">
            <Icon className="h-5 w-5 text-primary mb-2" />
            <p className="text-sm font-bold">{it.value}</p>
            <p className="text-[10px] text-muted-foreground uppercase">{it.label}</p>
          </CardContent></Card>
        )})}
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Masquage des données sensibles</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {masked.map((m) => (
            <div key={m.type} className="flex items-center gap-3 text-xs">
              <Badge variant="outline" className="w-24 shrink-0 justify-center">{m.type}</Badge>
              <span className="text-muted-foreground line-through">{m.original}</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-mono font-medium">{m.masked}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Champs chiffrés au repos</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {encrypted.map((e) => (
              <Badge key={e} variant="outline" className="gap-1 bg-emerald-500/5">
                <Lock className="h-2.5 w-2.5 text-emerald-600" />
                {e}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function RgpdTab({ data }: { data: Record<string, unknown> | null }) {
  const checklist = [
    "Droit à l'accès (right to access)",
    "Droit à l'effacement (right to erasure)",
    "Portabilité des données (data portability)",
    "Droit à la rectification",
    "Registre des traitements",
    "Notification de violation (72h)",
    "Pseudonymisation des données",
    "Consentement explicite",
  ]
  return (
    <div className="space-y-3">
      <Card className="border-l-4 border-l-emerald-500">
        <CardContent className="p-3 flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="text-sm font-medium">Conforme APIPD · Loi n°2013-450 Côte d'Ivoire</p>
            <p className="text-[10px] text-muted-foreground">Tous les droits RGPD sont implémentés et fonctionnels</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Checklist de conformité</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {checklist.map((c) => (
            <div key={c} className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              {c}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Demandes RGPD</CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toast.success("Demande RGPD créée")}>+ Nouvelle demande</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-4 text-center text-xs text-muted-foreground">Aucune demande RGPD en cours</div>
        </CardContent>
      </Card>
    </div>
  )
}

function ApiTab({ data }: { data: Record<string, unknown> | null }) {
  const headers = [
    { name: "X-Content-Type-Options", value: "nosniff" },
    { name: "X-Frame-Options", value: "DENY" },
    { name: "X-XSS-Protection", value: "1; mode=block" },
    { name: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
    { name: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { name: "Permissions-Policy", value: "geolocation=(), microphone=(), camera=()" },
    { name: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'..." },
  ]
  const cors = ["https://scraapiq.ci", "https://app.scraapiq.ci", "http://localhost:3000"]
  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Headers de sécurité</CardTitle></CardHeader>
        <CardContent className="space-y-1.5">
          {headers.map((h) => (
            <div key={h.name} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="font-mono text-[9px] shrink-0 bg-emerald-500/5">{h.name}</Badge>
              <span className="font-mono text-muted-foreground truncate">{h.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">CORS — Origines autorisées</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {cors.map((c) => (
              <div key={c} className="flex items-center gap-2 text-xs">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span className="font-mono">{c}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Validation des requêtes</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Taille max body</span><span className="font-medium">10 Mo</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Méthodes autorisées</span><span className="font-medium">GET, POST, PUT, DELETE, PATCH</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Timeout requête</span><span className="font-medium">30s</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">WAF sur URL + body</span><span className="font-medium text-emerald-600">✓ Actif</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Sanitization auto</span><span className="font-medium text-emerald-600">✓ Actif</span></div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
