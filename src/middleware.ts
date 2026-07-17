/**
 * Middleware Next.js — protection des routes + security headers + CORS
 *
 * Responsabilités (par ordre d'exécution) :
 *   1. Répondre aux pré-vols OPTIONS pour /api/* (CORS, 204 No Content)
 *   2. Appliquer les security headers (CSP, HSTS, X-Frame-Options, etc.)
 *      à CHAQUE réponse (pages, API, assets non-exclus par le matcher)
 *   3. Appliquer les headers CORS aux routes /api/* (origines configurables)
 *   4. Protection des routes auth (logique originale conservée à l'identique) :
 *      - Routes publiques : /, /auth/*
 *      - Routes protégées : /account/* (toutes les autres)
 *      - Vérifie la présence du cookie access token (pas la signature - coûteux)
 *        La vérification complète se fait dans les API routes via getAuthUser()
 *      - Pour les API routes protégées, la validation se fait dans chaque handler
 *
 * Note : avec Next.js 16 App Router, le middleware tourne sur Edge Runtime.
 * On ne peut pas y utiliser Prisma ni jose verify (qui fonctionne, mais coûteux).
 * Ici on fait un check léger de présence du cookie.
 *
 * Note Next.js 16 : la convention `middleware.ts` est dépréciée au profit de
 * `proxy.ts`, mais reste fonctionnelle. On garde `middleware.ts` pour la
 * compat avec le reste du codebase / docs existantes.
 */
import { NextResponse, type NextRequest } from "next/server"
import { AUTH_CONFIG } from "@/lib/auth/config"

// ---------------------------------------------------------------------------
// Environnement
// ---------------------------------------------------------------------------
const isProduction = process.env.NODE_ENV === "production"

/**
 * Origines autorisées pour le CORS.
 * - En production : NEXT_PUBLIC_APP_URL + ALLOWED_ORIGINS (séparé par virgules)
 * - En dev : idem + variantes localhost (permissif)
 *
 * En production, si Origin ne match pas, on NE set PAS Access-Control-Allow-Origin
 * → le navigateur bloquera la requête cross-origin.
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = []

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl) {
    const cleaned = appUrl.replace(/\/$/, "")
    if (cleaned) origins.push(cleaned)
  }

  const extra = process.env.ALLOWED_ORIGINS
  if (extra) {
    for (const raw of extra.split(",")) {
      const trimmed = raw.trim().replace(/\/$/, "")
      if (trimmed && !origins.includes(trimmed)) origins.push(trimmed)
    }
  }

  // En dev : fallback permissif sur les variantes localhost
  if (!isProduction) {
    const devFallbacks = [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
    ]
    for (const o of devFallbacks) {
      if (!origins.includes(o)) origins.push(o)
    }
  }

  return origins
}

// ---------------------------------------------------------------------------
// Security headers (appliqués à TOUTES les réponses du matcher)
// ---------------------------------------------------------------------------
const SECURITY_HEADERS: Record<string, string> = {
  // Anti-clickjacking (frame-ancestors 'none' dans la CSP est plus fort,
  // mais on garde X-Frame-Options pour les vieux navigateurs)
  "X-Frame-Options": "DENY",
  // Anti-MIME-sniffing
  "X-Content-Type-Options": "nosniff",
  // Ne pas fuiter l'URL complète vers l'extérieur
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Désactive les fonctionnalités navigateur sensibles
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
  // Pré-fetch DNS (perf)
  "X-DNS-Prefetch-Control": "on",
  // Isolement cross-origin (Spectre / timing attacks)
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  // CSP — voir les notes ci-dessous :
  //  - script-src 'unsafe-inline' 'unsafe-eval' : requis pour l'hydration Next.js
  //    (TECH DEBT : remplacer plus tard par une CSP basée sur des nonces)
  //  - style-src 'unsafe-inline' : requis pour Tailwind CSS (styles injectés)
  //  - img-src https: : couvre les tuiles OpenStreetMap de Leaflet
  //    (https://*.tile.openstreetmap.org) + data: (SVG inline) + blob: (uploads)
  //  - connect-src 'self' https: wss: : API REST + websockets
  //  - frame-ancestors 'none' : clickjacking (plus fort que X-Frame-Options)
  //  - object-src 'none' : pas de plugins (Flash, Java, etc.)
  //  - form-action 'self' : empêche l'exfiltration de formulaires vers l'extérieur
  //  - base-uri 'self' : empêche le hijack de <base>
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https: wss:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; "),
}

// HSTS uniquement en production (casserait http://localhost en dev)
if (isProduction) {
  SECURITY_HEADERS["Strict-Transport-Security"] =
    "max-age=63072000; includeSubDomains; preload"
}

function applySecurityHeaders(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    res.headers.set(key, value)
  }
  return res
}

// ---------------------------------------------------------------------------
// CORS pour /api/*
// ---------------------------------------------------------------------------
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-API-Key, X-Request-Id",
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Max-Age": "86400", // 24h — cache pré-vol navigateur
}

function applyCorsHeaders(
  res: NextResponse,
  req: NextRequest,
  allowedOrigins: string[],
): NextResponse {
  const origin = req.headers.get("origin")
  if (origin) {
    let allow = allowedOrigins.includes(origin)
    // En dev : permissif sur tout localhost (ports variés)
    if (!allow && !isProduction) {
      try {
        const u = new URL(origin)
        if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
          allow = true
        }
      } catch {
        // origin invalide → ignore
      }
    }
    if (allow) {
      // On renvoie l'Origin exacte (pas '*') car Access-Control-Allow-Credentials: true
      // interdit '*' côté navigateur.
      res.headers.set("Access-Control-Allow-Origin", origin)
      res.headers.set("Vary", "Origin")
    }
    // En production, si Origin ne match pas → on NE set PAS ACAO
    // → le navigateur bloquera la requête cross-origin.
  }
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    res.headers.set(key, value)
  }
  return res
}

// ---------------------------------------------------------------------------
// Auth / route-protection (logique originale conservée à l'identique)
// ---------------------------------------------------------------------------
const PUBLIC_ROUTES = ["/auth/login", "/auth/register", "/auth/verify-2fa"]
const PUBLIC_PATTERNS = [
  /^\/api\/auth\//,
  /^\/api\/oauth\//,
  /^\/api\/twofa\/(setup|disable)$/,
  /^\/api\/v1\/?$/, // GET /api/v1 (API info)
  /^\/api\/v1\/docs\/?(\/ui)?$/, // GET /api/v1/docs and /api/v1/docs/ui (Swagger)
  /^\/api\/(health|ready)$/, // LB / monitoring probes (liveness + readiness)
]

// ---------------------------------------------------------------------------
// Middleware entry
// ---------------------------------------------------------------------------
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isApi = pathname.startsWith("/api/")
  const allowedOrigins = getAllowedOrigins()

  // 1. Pré-vol CORS pour les API routes → 204 immédiat (avant tout check auth)
  //    Les pré-vols navigateur ne portent JAMAIS les cookies/credentials,
  //    donc un check auth ici casserait toutes les requêtes cross-origin.
  if (isApi && req.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 })
    applySecurityHeaders(res)
    applyCorsHeaders(res, req, allowedOrigins)
    return res
  }

  // 2. Logique d'auth / route-protection (PRESERVÉE de l'original)
  let res: NextResponse

  if (PUBLIC_PATTERNS.some((p) => p.test(pathname))) {
    // Routes API publiques : laissent passer
    res = NextResponse.next()
  } else if (PUBLIC_ROUTES.includes(pathname)) {
    // Routes pages publiques
    // Si déjà logué et va sur /auth/login → redirige vers /
    const accessToken = req.cookies.get(AUTH_CONFIG.ACCESS_COOKIE_NAME)?.value
    if (
      accessToken &&
      (pathname === "/auth/login" || pathname === "/auth/register")
    ) {
      res = NextResponse.redirect(new URL("/", req.url))
    } else {
      res = NextResponse.next()
    }
  } else {
    // Routes protégées (/account/*, /api/me, /api/sessions, /api/permissions,
    // /api/v1/* sauf docs)
    const accessToken = req.cookies.get(AUTH_CONFIG.ACCESS_COOKIE_NAME)?.value
    const refreshToken = req.cookies.get(
      AUTH_CONFIG.REFRESH_COOKIE_NAME,
    )?.value
    const authHeader = req.headers.get("authorization")
    const apiKeyHeader = req.headers.get("x-api-key")
    const hasBearer = !!authHeader && /^Bearer\s+\S+/i.test(authHeader)
    const hasApiKey = !!apiKeyHeader && apiKeyHeader.trim().length > 0

    if (!accessToken && !refreshToken && !hasBearer && !hasApiKey) {
      // Pour les API routes, retourne 401 JSON
      if (isApi) {
        res = NextResponse.json(
          { error: "Authentication required" },
          { status: 401 },
        )
      } else {
        // Pour les pages, redirige vers /auth/login
        const loginUrl = new URL("/auth/login", req.url)
        loginUrl.searchParams.set("redirect", pathname)
        res = NextResponse.redirect(loginUrl)
      }
    } else {
      res = NextResponse.next()
    }
  }

  // 3. Security headers sur TOUTES les réponses
  applySecurityHeaders(res)

  // 4. CORS headers uniquement sur /api/*
  if (isApi) {
    applyCorsHeaders(res, req, allowedOrigins)
  }

  return res
}

// ---------------------------------------------------------------------------
// Matcher — applique à toutes les routes SAUF :
//   - Internes Next.js : _next/static, _next/image
//   - Fichiers statiques publics : favicon, logo, robots, manifest, sw.js
//   - Fichiers avec extensions (images, fonts, css, js, maps, etc.)
// ---------------------------------------------------------------------------
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt|manifest.json|sw.js|icon-192.png|icon-512.png|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|xml|txt|js|css|woff|woff2|map)$).*)",
  ],
}
