"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Code,
  Terminal,
  Play,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Unlock,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  BookOpen,
  KeyRound,
  Globe,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

interface EndpointParam {
  name: string
  in: "query" | "path" | "body"
  type: "string" | "integer" | "number" | "boolean" | "array" | "object"
  required?: boolean
  description?: string
  example?: string
  enum?: string[]
}

interface Endpoint {
  method: HttpMethod
  path: string
  summary: string
  description?: string
  auth: boolean
  tags: string[]
  params?: EndpointParam[]
  bodyExample?: string
  responseExample?: string
}

const endpoints: Endpoint[] = [
  {
    method: "GET",
    path: "/api/v1",
    summary: "API info",
    description: "Retourne la version, la liste des endpoints, et les méthodes d'authentification supportées.",
    auth: false,
    tags: ["General"],
    responseExample: JSON.stringify(
      {
        success: true,
        data: {
          name: "ScrapIQ CI REST API",
          version: "1.0.0",
          versionLabel: "v1",
          features: ["Pagination", "Filters", "Sorting", "Search", "Webhooks"],
        },
      },
      null,
      2
    ),
  },
  {
    method: "GET",
    path: "/api/v1/docs",
    summary: "OpenAPI 3.0 spec",
    description: "Retourne la spécification OpenAPI 3.0 complète au format JSON.",
    auth: false,
    tags: ["Docs"],
  },
  {
    method: "GET",
    path: "/api/v1/docs/ui",
    summary: "Swagger UI",
    description: "Sert la page HTML Swagger UI (via CDN).",
    auth: false,
    tags: ["Docs"],
  },
  {
    method: "GET",
    path: "/api/v1/companies",
    summary: "Lister les entreprises",
    description:
      "Retourne une liste paginée d'entreprises avec filtres, tri et recherche. La table est auto-seedée au premier appel.",
    auth: true,
    tags: ["Companies"],
    params: [
      { name: "page", in: "query", type: "integer", description: "Numéro de page (default 1)", example: "1" },
      { name: "limit", in: "query", type: "integer", description: "Items par page (max 100)", example: "20" },
      { name: "q", in: "query", type: "string", description: "Recherche (name, sector, address, description)", example: "orange" },
      { name: "sector", in: "query", type: "string", description: "Filtre par secteur", example: "Télécommunications" },
      { name: "city", in: "query", type: "string", description: "Filtre par ville", example: "Abidjan" },
      { name: "commune", in: "query", type: "string", description: "Filtre par commune", example: "Cocody" },
      { name: "status", in: "query", type: "string", description: "Filtre par statut", enum: ["active", "closed", "relocated"] },
      { name: "minRating", in: "query", type: "number", description: "Note minimum (0-5)", example: "4.0" },
      { name: "sort", in: "query", type: "string", description: "Champ de tri", enum: ["name", "sector", "city", "rating", "createdAt"] },
      { name: "order", in: "query", type: "string", description: "Ordre de tri", enum: ["asc", "desc"] },
    ],
    responseExample: JSON.stringify(
      {
        success: true,
        data: [
          {
            id: "clxxxx",
            name: "Orange CI - Agence Cocody",
            sector: "Télécommunications",
            commune: "Cocody",
            city: "Abidjan",
            rating: 4.5,
            reviewCount: 320,
          },
        ],
        meta: { page: 1, limit: 20, total: 60, totalPages: 3, hasNext: true, hasPrev: false },
      },
      null,
      2
    ),
  },
  {
    method: "POST",
    path: "/api/v1/companies",
    summary: "Créer une entreprise",
    description: "Crée une nouvelle entreprise. Le champ `name` est requis.",
    auth: true,
    tags: ["Companies"],
    bodyExample: JSON.stringify(
      {
        name: "Nouvelle Société CI",
        sector: "Technologie & IT",
        commune: "Plateau",
        city: "Abidjan",
        address: "Av. Houphouët-Boigny, Plateau",
        phone: "+225 01 23 45 67 89",
        email: "contact@societe.ci",
        website: "https://societe.ci",
        employees: "10-50",
        status: "active",
      },
      null,
      2
    ),
    responseExample: JSON.stringify(
      { success: true, data: { id: "clxxxx", name: "Nouvelle Société CI" }, message: "Company created" },
      null,
      2
    ),
  },
  {
    method: "GET",
    path: "/api/v1/companies/{id}",
    summary: "Récupérer une entreprise",
    description: "Retourne les détails d'une entreprise par son ID.",
    auth: true,
    tags: ["Companies"],
    params: [{ name: "id", in: "path", type: "string", required: true, description: "ID de l'entreprise", example: "clxxxx" }],
  },
  {
    method: "PUT",
    path: "/api/v1/companies/{id}",
    summary: "Mettre à jour une entreprise",
    description: "Met à jour une entreprise. Tous les champs sont optionnels (update partielle).",
    auth: true,
    tags: ["Companies"],
    params: [{ name: "id", in: "path", type: "string", required: true, description: "ID de l'entreprise", example: "clxxxx" }],
    bodyExample: JSON.stringify({ rating: 4.8, reviewCount: 410, status: "active" }, null, 2),
  },
  {
    method: "DELETE",
    path: "/api/v1/companies/{id}",
    summary: "Supprimer une entreprise",
    description: "Supprime une entreprise par son ID.",
    auth: true,
    tags: ["Companies"],
    params: [{ name: "id", in: "path", type: "string", required: true, description: "ID de l'entreprise", example: "clxxxx" }],
  },
  {
    method: "GET",
    path: "/api/v1/webhooks",
    summary: "Lister les webhooks",
    description: "Retourne tous les webhooks configurés.",
    auth: true,
    tags: ["Webhooks"],
  },
  {
    method: "POST",
    path: "/api/v1/webhooks",
    summary: "Créer un webhook",
    description: "Crée un nouveau webhook. URL et events sont requis.",
    auth: true,
    tags: ["Webhooks"],
    bodyExample: JSON.stringify(
      {
        url: "https://example.com/webhook",
        events: ["company.created", "company.updated", "company.deleted"],
        isActive: true,
      },
      null,
      2
    ),
  },
  {
    method: "PUT",
    path: "/api/v1/webhooks/{id}",
    summary: "Mettre à jour un webhook",
    description: "Met à jour un webhook existant.",
    auth: true,
    tags: ["Webhooks"],
    params: [{ name: "id", in: "path", type: "string", required: true, description: "ID du webhook", example: "clxxxx" }],
    bodyExample: JSON.stringify({ isActive: false }, null, 2),
  },
  {
    method: "DELETE",
    path: "/api/v1/webhooks/{id}",
    summary: "Supprimer un webhook",
    description: "Supprime un webhook par son ID.",
    auth: true,
    tags: ["Webhooks"],
    params: [{ name: "id", in: "path", type: "string", required: true, description: "ID du webhook", example: "clxxxx" }],
  },
  {
    method: "POST",
    path: "/api/v1/webhooks/{id}/test",
    summary: "Tester un webhook",
    description: "Envoie un événement de test `test.ping` à l'URL du webhook et enregistre la delivery.",
    auth: true,
    tags: ["Webhooks"],
    params: [{ name: "id", in: "path", type: "string", required: true, description: "ID du webhook", example: "clxxxx" }],
  },
]

const methodColors: Record<HttpMethod, string> = {
  GET: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900",
  POST: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900",
  PUT: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900",
  DELETE: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900",
  PATCH: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-900",
}

export function ApiDocsView() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [swaggerOpen, setSwaggerOpen] = useState(false)
  const [tryEndpoint, setTryEndpoint] = useState<Endpoint | null>(null)
  const [tryParams, setTryParams] = useState<Record<string, string>>({})
  const [tryBody, setTryBody] = useState("")
  const [tryResponse, setTryResponse] = useState<{ status: number; body: string; ms: number } | null>(null)
  const [tryLoading, setTryLoading] = useState(false)
  const [copiedPath, setCopiedPath] = useState<string | null>(null)
  const [apiInfo, setApiInfo] = useState<{ version?: string; endpointsCount?: number }>({})

  // Fetch API info on mount
  useEffect(() => {
    fetch("/api/v1", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setApiInfo({
            version: data.data?.version,
            endpointsCount: data.data?.endpoints?.length,
          })
        }
      })
      .catch(() => {
        /* silent */
      })
  }, [])

  const tags = Array.from(new Set(endpoints.map((e) => e.tags[0])))

  const handleToggle = (key: string) => {
    setExpanded(expanded === key ? null : key)
  }

  const openTryPanel = (ep: Endpoint) => {
    setTryEndpoint(ep)
    setTryParams({})
    setTryBody(ep.bodyExample || "")
    setTryResponse(null)
  }

  const buildUrl = useCallback((ep: Endpoint) => {
    let url = ep.path
    // Replace path params
    for (const p of ep.params || []) {
      if (p.in === "path") {
        const val = tryParams[p.name] || `{${p.name}}`
        url = url.replace(`{${p.name}}`, encodeURIComponent(val))
      }
    }
    // Append query params
    const queryParts: string[] = []
    for (const p of ep.params || []) {
      if (p.in === "query" && tryParams[p.name]) {
        queryParts.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(tryParams[p.name])}`)
      }
    }
    if (queryParts.length > 0) url += `?${queryParts.join("&")}`
    return url
  }, [tryParams])

  const buildCurl = useCallback(
    (ep: Endpoint) => {
      const url = buildUrl(ep)
      let cmd = `curl -X ${ep.method} '${url}'`
      cmd += ` \\\n  -H 'Accept: application/json'`
      if (["POST", "PUT", "PATCH"].includes(ep.method) && tryBody) {
        cmd += ` \\\n  -H 'Content-Type: application/json'`
        cmd += ` \\\n  -d '${tryBody.replace(/'/g, "'\\''")}'`
      }
      return cmd
    },
    [buildUrl, tryBody]
  )

  const runTry = async () => {
    if (!tryEndpoint) return
    setTryLoading(true)
    setTryResponse(null)
    const startedAt = Date.now()
    try {
      const url = buildUrl(tryEndpoint)
      const opts: RequestInit = {
        method: tryEndpoint.method,
        credentials: "include",
        headers: { Accept: "application/json" },
      }
      if (["POST", "PUT", "PATCH"].includes(tryEndpoint.method) && tryBody) {
        opts.headers = { ...opts.headers, "Content-Type": "application/json" }
        opts.body = tryBody
      }
      const res = await fetch(url, opts)
      const text = await res.text()
      let body: string
      try {
        body = JSON.stringify(JSON.parse(text), null, 2)
      } catch {
        body = text.slice(0, 4000)
      }
      setTryResponse({ status: res.status, body, ms: Date.now() - startedAt })
    } catch (err) {
      setTryResponse({
        status: 0,
        body: err instanceof Error ? err.message : "Erreur réseau",
        ms: Date.now() - startedAt,
      })
    } finally {
      setTryLoading(false)
    }
  }

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedPath(key)
      toast.success("Copié dans le presse-papiers")
      setTimeout(() => setCopiedPath(null), 2000)
    } catch {
      toast.error("Échec de la copie")
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Code className="h-6 w-6 text-primary" />
          API REST Documentation
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          v1 · CRUD · Swagger · JWT · Pagination · Filtres · Tri · Recherche · Webhooks
          {apiInfo.version && (
            <Badge variant="outline" className="ml-2 text-[10px]">
              v{apiInfo.version}
            </Badge>
          )}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Endpoints</div>
              <div className="text-xl font-bold">{endpoints.length}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <KeyRound className="h-5 w-5 text-accent-foreground" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Méthodes d'auth</div>
              <div className="text-xl font-bold">3</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Zap className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Rate limit</div>
              <div className="text-xl font-bold">100 req</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">OpenAPI</div>
              <div className="text-xl font-bold">3.0.3</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Auth methods */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            Authentification
          </CardTitle>
          <CardDescription className="text-xs">
            Toutes les routes protégées acceptent l'une de ces trois méthodes.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-semibold">Cookie HTTP-only</span>
            </div>
            <code className="text-[10px] block text-muted-foreground">
              scraapiq_access=eyJhbGc...
            </code>
            <p className="text-[11px] text-muted-foreground">Posé automatiquement après <code>/api/auth/login</code>.</p>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-orange-600" />
              <span className="text-xs font-semibold">Bearer token</span>
            </div>
            <code className="text-[10px] block text-muted-foreground">
              Authorization: Bearer &lt;jwt&gt;
            </code>
            <p className="text-[11px] text-muted-foreground">Idéal pour les scripts CLI et intégrations server-side.</p>
          </div>
          <div className="rounded-lg border p-3 space-y-1">
            <div className="flex items-center gap-2">
              <KeyRound className="h-3.5 w-3.5 text-amber-600" />
              <span className="text-xs font-semibold">API Key</span>
            </div>
            <code className="text-[10px] block text-muted-foreground">
              X-API-Key: sk_live_xxx
            </code>
            <p className="text-[11px] text-muted-foreground">Lookup en DB, idéal pour les intégrations longues.</p>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: Explorer vs Swagger UI */}
      <Tabs defaultValue="explorer">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList>
            <TabsTrigger value="explorer">
              <Terminal className="h-4 w-4 mr-2" />
              Explorateur d'API
            </TabsTrigger>
            <TabsTrigger value="swagger" onClick={() => setSwaggerOpen(true)}>
              <BookOpen className="h-4 w-4 mr-2" />
              Swagger UI
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyText(JSON.stringify({ openapi: "3.0.3", url: "/api/v1/docs" }, null, 2), "spec-url")}
            >
              {copiedPath === "spec-url" ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
              Spec URL
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/v1/docs/ui" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Ouvrir Swagger
              </a>
            </Button>
          </div>
        </div>

        {/* Explorer */}
        <TabsContent value="explorer" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Endpoints list — left side */}
            <div className="lg:col-span-2 space-y-3">
              {tags.map((tag) => (
                <Card key={tag}>
                  <CardHeader className="pb-2 pt-3 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{tag}</Badge>
                      <span className="text-xs text-muted-foreground font-normal">
                        {endpoints.filter((e) => e.tags[0] === tag).length} endpoint(s)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-2 pb-2 space-y-1">
                    {endpoints
                      .filter((e) => e.tags[0] === tag)
                      .map((ep) => {
                        const key = `${ep.method}-${ep.path}`
                        const isExpanded = expanded === key
                        return (
                          <div key={key} className="rounded-md border overflow-hidden">
                            <button
                              onClick={() => handleToggle(key)}
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-2 text-left text-xs hover:bg-accent/50 transition-colors",
                                isExpanded && "bg-accent/30"
                              )}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
                              )}
                              <span
                                className={cn(
                                  "px-1.5 py-0.5 rounded text-[10px] font-bold w-14 text-center shrink-0 border",
                                  methodColors[ep.method]
                                )}
                              >
                                {ep.method}
                              </span>
                              <span className="font-mono text-[11px] truncate flex-1">{ep.path}</span>
                              {ep.auth ? (
                                <Lock className="h-3 w-3 text-muted-foreground shrink-0" />
                              ) : (
                                <Unlock className="h-3 w-3 text-emerald-600 shrink-0" />
                              )}
                            </button>
                            {isExpanded && (
                              <div className="px-3 py-2 border-t bg-muted/30 space-y-2">
                                <p className="text-xs">{ep.summary}</p>
                                {ep.description && (
                                  <p className="text-[11px] text-muted-foreground">{ep.description}</p>
                                )}
                                {ep.params && ep.params.length > 0 && (
                                  <div className="space-y-1">
                                    <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                                      Paramètres
                                    </p>
                                    {ep.params.map((p) => (
                                      <div key={p.name} className="flex items-center gap-2 text-[11px]">
                                        <code className="bg-background px-1.5 py-0.5 rounded border">
                                          {p.name}
                                        </code>
                                        <Badge variant="secondary" className="text-[9px] py-0 h-4">
                                          {p.in}
                                        </Badge>
                                        {p.required && (
                                          <Badge variant="destructive" className="text-[9px] py-0 h-4">
                                            requis
                                          </Badge>
                                        )}
                                        <span className="text-muted-foreground truncate">
                                          {p.description}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div className="flex items-center gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    className="h-7 text-xs"
                                    onClick={() => openTryPanel(ep)}
                                  >
                                    <Play className="h-3 w-3 mr-1" />
                                    Try it
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    onClick={() => copyText(ep.path, `path-${key}`)}
                                  >
                                    {copiedPath === `path-${key}` ? (
                                      <Check className="h-3 w-3 mr-1" />
                                    ) : (
                                      <Copy className="h-3 w-3 mr-1" />
                                    )}
                                    Path
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Try-it panel — right side */}
            <div className="lg:col-span-3">
              <Card className="sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Play className="h-4 w-4 text-primary" />
                    {tryEndpoint ? "Try it out" : "Testeur interactif"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {tryEndpoint
                      ? "Exécute l'endpoint directement depuis le navigateur (cookies inclus)."
                      : "Sélectionnez un endpoint dans la liste et cliquez sur « Try it »."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!tryEndpoint ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-muted-foreground">
                      <Terminal className="h-10 w-10 mb-3 opacity-40" />
                      <p>Aucun endpoint sélectionné.</p>
                      <p className="text-xs">Cliquez sur « Try it » sur un endpoint à gauche.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-2 py-1 rounded text-xs font-bold w-16 text-center border",
                            methodColors[tryEndpoint.method]
                          )}
                        >
                          {tryEndpoint.method}
                        </span>
                        <code className="font-mono text-xs flex-1 truncate">{tryEndpoint.path}</code>
                      </div>

                      {/* Path params */}
                      {tryEndpoint.params?.filter((p) => p.in === "path").map((p) => (
                        <div key={p.name} className="space-y-1">
                          <Label className="text-xs flex items-center gap-1">
                            {p.name}
                            <Badge variant="secondary" className="text-[9px] py-0 h-4">path</Badge>
                            {p.required && <Badge variant="destructive" className="text-[9px] py-0 h-4">requis</Badge>}
                          </Label>
                          <Input
                            value={tryParams[p.name] || ""}
                            onChange={(e) => setTryParams((s) => ({ ...s, [p.name]: e.target.value }))}
                            placeholder={p.example || `Enter ${p.name}`}
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      ))}

                      {/* Query params */}
                      {tryEndpoint.params?.filter((p) => p.in === "query").length ? (
                        <div className="space-y-2">
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                            Query params
                          </p>
                          {tryEndpoint.params
                            ?.filter((p) => p.in === "query")
                            .map((p) => (
                              <div key={p.name} className="space-y-1">
                                <Label className="text-xs flex items-center gap-1">
                                  {p.name}
                                  <span className="text-muted-foreground font-normal text-[10px]">
                                    {p.description}
                                  </span>
                                </Label>
                                <Input
                                  value={tryParams[p.name] || ""}
                                  onChange={(e) => setTryParams((s) => ({ ...s, [p.name]: e.target.value }))}
                                  placeholder={p.example || ""}
                                  className="h-8 text-xs font-mono"
                                />
                              </div>
                            ))}
                        </div>
                      ) : null}

                      {/* Body for POST/PUT/PATCH */}
                      {["POST", "PUT", "PATCH"].includes(tryEndpoint.method) && (
                        <div className="space-y-1">
                          <Label className="text-xs">Body (JSON)</Label>
                          <Textarea
                            value={tryBody}
                            onChange={(e) => setTryBody(e.target.value)}
                            className="font-mono text-xs min-h-[160px] max-h-[300px]"
                            placeholder='{"name": "..."}'
                          />
                        </div>
                      )}

                      {/* URL preview */}
                      <div className="space-y-1">
                        <Label className="text-xs">URL finale</Label>
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-[11px] flex-1 bg-muted px-2 py-1.5 rounded border truncate">
                            {buildUrl(tryEndpoint)}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2"
                            onClick={() => copyText(buildUrl(tryEndpoint), `url-${tryEndpoint.method}`)}
                          >
                            {copiedPath === `url-${tryEndpoint.method}` ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* curl preview */}
                      <div className="space-y-1">
                        <Label className="text-xs">Commande cURL</Label>
                        <div className="relative">
                          <pre className="font-mono text-[10px] bg-muted p-2 rounded border overflow-x-auto max-h-[120px]">
                            {buildCurl(tryEndpoint)}
                          </pre>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="absolute top-1 right-1 h-6 px-2"
                            onClick={() => copyText(buildCurl(tryEndpoint), `curl-${tryEndpoint.method}`)}
                          >
                            {copiedPath === `curl-${tryEndpoint.method}` ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <Button
                        className="w-full"
                        onClick={runTry}
                        disabled={tryLoading}
                      >
                        {tryLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Exécution...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Exécuter la requête
                          </>
                        )}
                      </Button>

                      {/* Response */}
                      {tryResponse && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">Réponse:</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                tryResponse.status >= 200 && tryResponse.status < 300
                                  ? "border-emerald-300 text-emerald-700"
                                  : tryResponse.status >= 400 && tryResponse.status < 500
                                  ? "border-amber-300 text-amber-700"
                                  : "border-red-300 text-red-700"
                              )}
                            >
                              {tryResponse.status || "ERR"}
                            </Badge>
                            <span className="text-muted-foreground">{tryResponse.ms} ms</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 ml-auto"
                              onClick={() => copyText(tryResponse.body, `res-${tryEndpoint.method}`)}
                            >
                              {copiedPath === `res-${tryEndpoint.method}` ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                          <pre className="font-mono text-[11px] bg-muted p-3 rounded border overflow-x-auto max-h-[300px] overflow-y-auto">
                            {tryResponse.body}
                          </pre>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Swagger UI */}
        <TabsContent value="swagger" className="mt-4">
          <Card>
            <CardContent className="p-0 overflow-hidden">
              {swaggerOpen ? (
                <iframe
                  src="/api/v1/docs/ui"
                  title="Swagger UI"
                  className="w-full h-[800px] border-0"
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <BookOpen className="h-12 w-12 mb-3 text-muted-foreground opacity-40" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Swagger UI se charge via CDN.
                  </p>
                  <Button onClick={() => setSwaggerOpen(true)}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Charger Swagger UI
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
