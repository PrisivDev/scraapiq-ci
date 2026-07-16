/**
 * Helpers pour gérer les cookies d'auth (HTTP-only, secure, same-site)
 */
import { cookies } from "next/headers"
import { AUTH_CONFIG } from "./config"

/**
 * Définit les cookies access + refresh après login réussi
 */
export async function setAuthCookies(params: {
  accessToken: string
  refreshToken: string
}): Promise<void> {
  const cookieStore = await cookies()

  cookieStore.set(AUTH_CONFIG.ACCESS_COOKIE_NAME, params.accessToken, {
    httpOnly: true,
    secure: AUTH_CONFIG.COOKIE_SECURE,
    sameSite: AUTH_CONFIG.COOKIE_SAME_SITE,
    path: AUTH_CONFIG.COOKIE_PATH,
    maxAge: AUTH_CONFIG.ACCESS_TOKEN_TTL_SECONDS,
  })

  cookieStore.set(AUTH_CONFIG.REFRESH_COOKIE_NAME, params.refreshToken, {
    httpOnly: true,
    secure: AUTH_CONFIG.COOKIE_SECURE,
    sameSite: AUTH_CONFIG.COOKIE_SAME_SITE,
    path: AUTH_CONFIG.COOKIE_PATH,
    maxAge: AUTH_CONFIG.REFRESH_TOKEN_TTL_SECONDS,
  })
}

/**
 * Récupère le refresh token depuis les cookies (pour /refresh)
 */
export async function getRefreshTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(AUTH_CONFIG.REFRESH_COOKIE_NAME)?.value || null
}

/**
 * Supprime les cookies d'auth (logout)
 */
export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(AUTH_CONFIG.ACCESS_COOKIE_NAME)
  cookieStore.delete(AUTH_CONFIG.REFRESH_COOKIE_NAME)
}

/**
 * Helpers pour NextRequest (dans les route handlers)
 */
export function getRefreshTokenFromRequestCookies(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || ""
  const match = cookieHeader.match(new RegExp(`${AUTH_CONFIG.REFRESH_COOKIE_NAME}=([^;]+)`))
  return match ? match[1] : null
}

export function getAccessTokenFromRequestCookies(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || ""
  const match = cookieHeader.match(new RegExp(`${AUTH_CONFIG.ACCESS_COOKIE_NAME}=([^;]+)`))
  return match ? match[1] : null
}
