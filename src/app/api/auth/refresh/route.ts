/**
 * POST /api/auth/refresh
 * Rotue un refresh token et émet un nouvel access token
 * - Détection de replay → révocation de toute la famille
 * - Invalide le refresh token précédent
 */
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { rotateRefreshToken, revokeRefreshToken } from "@/lib/auth/refresh-tokens"
import { signAccessToken } from "@/lib/auth/jwt"
import { setAuthCookies, getRefreshTokenFromRequestCookies } from "@/lib/auth/cookies"
import { getEffectivePermissions } from "@/lib/auth/rbac"
import { errorResponse, extractRequestInfo, jsonResponse } from "@/lib/auth/helpers"
import { logAudit } from "@/lib/auth/audit"

export async function POST(req: NextRequest) {
  try {
    const refreshToken = getRefreshTokenFromRequestCookies(req)

    if (!refreshToken) {
      return errorResponse("No refresh token", 401)
    }

    const { ip, userAgent } = extractRequestInfo(req)

    const result = await rotateRefreshToken(refreshToken, { userAgent, ip })

    if (!result.success) {
      // Si replay détecté, on log critique
      if (result.reason === "used") {
        await logAudit({
          action: "replay_detected",
          category: "security",
          severity: "critical",
          ip,
          userAgent,
          metadata: { reason: result.reason },
        })
      }

      // Nettoie le cookie
      const response = errorResponse("Invalid refresh token", 401, { reason: result.reason })
      response.cookies.delete("scraapiq_refresh")
      response.cookies.delete("scraapiq_access")
      return response
    }

    // Lookup user + role
    const user = await db.user.findUnique({
      where: { id: result.userId },
      include: {
        memberships: {
          where: { status: "active" },
          take: 1,
        },
      },
    })

    if (!user || user.status !== "active") {
      await revokeRefreshToken(result.newToken, "user_invalid")
      return errorResponse("User not found or suspended", 401)
    }

    const membership = user.memberships[0]
    const role = (membership?.role as "OWNER" | "ADMIN" | "MANAGER" | "AGENT" | "VIEWER") || "VIEWER"
    const permissions = getEffectivePermissions(role)

    // Émet un nouvel access token
    const { token: accessToken } = await signAccessToken({
      userId: user.id,
      email: user.email,
      name: user.name || undefined,
      role,
      orgId: membership?.organizationId,
      workspaceId: membership?.workspaceId ?? undefined,
      permissions,
    })

    // Set les cookies (nouveau access + nouveau refresh rotated)
    await setAuthCookies({ accessToken, refreshToken: result.newToken })

    await logAudit({
      userId: user.id,
      action: "token_refreshed",
      category: "auth",
      severity: "debug",
      ip,
      userAgent,
      metadata: {},
    })

    return jsonResponse({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
      },
    })
  } catch (err) {
    console.error("[refresh] error:", err)
    return errorResponse("Erreur lors du refresh", 500)
  }
}
