/**
 * Middleware Next.js — protection des routes
 *
 * - Routes publiques : /, /auth/*
 * - Routes protégées : /account/* (toutes les autres)
 * - Vérifie la présence du cookie access token (pas la signature - coûteux)
 *   La vérification complète se fait dans les API routes via getAuthUser()
 * - Pour les API routes protégées, la validation se fait dans chaque handler
 *
 * Note : avec Next.js 16 App Router, le middleware tourne sur Edge Runtime.
 * On ne peut pas y utiliser Prisma ni jose verify (qui fonctionne, mais coûteux).
 * Ici on fait un check léger de présence du cookie.
 */
import { NextResponse, type NextRequest } from "next/server"
import { AUTH_CONFIG } from "@/lib/auth/config"

// Routes publiques (pas besoin d'auth)
const PUBLIC_ROUTES = ["/", "/auth/login", "/auth/register", "/auth/verify-2fa"]
const PUBLIC_PATTERNS = [
  /^\/api\/auth\//,
  /^\/api\/oauth\//,
  /^\/api\/twofa\/(setup|disable)$/,
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Routes API publiques : laissent passer
  if (PUBLIC_PATTERNS.some((p) => p.test(pathname))) {
    return NextResponse.next()
  }

  // Routes publiques : laissent passer
  if (PUBLIC_ROUTES.includes(pathname)) {
    // Si déjà logué et va sur /auth/login → redirige vers /
    const accessToken = req.cookies.get(AUTH_CONFIG.ACCESS_COOKIE_NAME)?.value
    if (accessToken && (pathname === "/auth/login" || pathname === "/auth/register")) {
      return NextResponse.redirect(new URL("/", req.url))
    }
    return NextResponse.next()
  }

  // Routes protégées (/account/*, /api/me, /api/sessions, /api/permissions)
  const accessToken = req.cookies.get(AUTH_CONFIG.ACCESS_COOKIE_NAME)?.value
  const refreshToken = req.cookies.get(AUTH_CONFIG.REFRESH_COOKIE_NAME)?.value

  if (!accessToken && !refreshToken) {
    // Pour les API routes, retourne 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }
    // Pour les pages, redirige vers /auth/login
    const loginUrl = new URL("/auth/login", req.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    // Exclut les fichiers statiques et _next
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt).*)",
  ],
}
