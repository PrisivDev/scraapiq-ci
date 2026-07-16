/**
 * POST /api/auth/logout
 * - Blacklist le JTI du access token courant
 * - Révoque le refresh token
 * - Révoque la session serveur
 * - Nettoie les cookies
 */
import { NextRequest } from "next/server"
import { verifyAccessToken } from "@/lib/auth/jwt"
import { blacklistJwt } from "@/lib/auth/blacklist"
import { revokeRefreshToken } from "@/lib/auth/refresh-tokens"
import { revokeSession } from "@/lib/auth/sessions"
import {
  getAccessTokenFromRequestCookies,
  getRefreshTokenFromRequestCookies,
} from "@/lib/auth/cookies"
import { db } from "@/lib/db"
import { errorResponse, extractRequestInfo, jsonResponse } from "@/lib/auth/helpers"
import { logAudit } from "@/lib/auth/audit"
import { AUTH_CONFIG } from "@/lib/auth/config"

export async function POST(req: NextRequest) {
  try {
    const accessToken = getAccessTokenFromRequestCookies(req)
    const refreshToken = getRefreshTokenFromRequestCookies(req)
    const { ip, userAgent } = extractRequestInfo(req)

    let userId: string | undefined
    let jti: string | undefined

    if (accessToken) {
      try {
        const claims = await verifyAccessToken(accessToken)
        userId = claims.sub
        jti = claims.jti

        // Blacklist le JTI (pour empêcher réutilisation avant expiration)
        if (jti && userId) {
          const expiresAt = new Date((claims.exp || 0) * 1000)
          await blacklistJwt({ userId, jti, expiresAt, reason: "logout" })
        }
      } catch {
        // Token invalide, on continue le logout quand même
      }
    }

    // Révoque le refresh token
    if (refreshToken) {
      await revokeRefreshToken(refreshToken, "logout")
    }

    // Révoque la session liée
    if (refreshToken) {
      const { hashToken } = await import("@/lib/auth/jwt")
      const tokenHash = await hashToken(refreshToken)
      const rt = await db.refreshToken.findUnique({
        where: { token: tokenHash },
        select: { session: true },
      })
      if (rt?.session) {
        await revokeSession(rt.session, "logout")
      }
    }

    // Audit
    if (userId) {
      await logAudit({
        userId,
        action: "logout",
        category: "auth",
        severity: "info",
        ip,
        userAgent,
        metadata: { jti },
      })
    }

    // Nettoie les cookies
    const response = jsonResponse({ success: true })
    response.cookies.delete(AUTH_CONFIG.ACCESS_COOKIE_NAME)
    response.cookies.delete(AUTH_CONFIG.REFRESH_COOKIE_NAME)
    return response
  } catch (err) {
    console.error("[logout] error:", err)
    return errorResponse("Erreur lors de la déconnexion", 500)
  }
}
