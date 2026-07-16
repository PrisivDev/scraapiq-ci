/**
 * GET  /api/sessions — liste les sessions actives
 * DELETE /api/sessions/[id] — révoque une session
 */
import { NextRequest } from "next/server"
import { getAuthUser, errorResponse, jsonResponse } from "@/lib/auth"
import { listUserSessions, revokeSession } from "@/lib/auth/sessions"
import { logAudit } from "@/lib/auth/audit"

export async function GET() {
  try {
    const { user, error, status } = await getAuthUser()
    if (!user) return errorResponse(error || "Unauthorized", status)

    const sessions = await listUserSessions(user.id)
    return jsonResponse({
      sessions: sessions.map((s) => ({
        id: s.id,
        device: s.device,
        ip: s.ip,
        location: s.location,
        userAgent: s.userAgent,
        lastSeenAt: s.lastSeenAt,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        current: false, // TODO: déterminer la session courante
      })),
    })
  } catch (err) {
    console.error("[sessions] error:", err)
    return errorResponse("Erreur serveur", 500)
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, error, status } = await getAuthUser()
    if (!user) return errorResponse(error || "Unauthorized", status)

    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get("id")
    const all = searchParams.get("all") === "true"

    if (all) {
      // Révoque toutes les sessions (logout all devices)
      const { revokeAllUserSessions } = await import("@/lib/auth/sessions")
      const { revokeAllUserRefreshTokens } = await import("@/lib/auth/refresh-tokens")
      const { blacklistAllUserTokens } = await import("@/lib/auth/blacklist")

      await revokeAllUserSessions(user.id, undefined, "logout_all")
      await revokeAllUserRefreshTokens(user.id, "logout_all")
      await blacklistAllUserTokens(
        user.id,
        new Date(Date.now() + 15 * 60 * 1000),
        "logout_all"
      )

      await logAudit({
        userId: user.id,
        action: "logout_all",
        category: "session",
        severity: "warn",
        metadata: {},
      })

      return jsonResponse({ success: true, message: "Toutes les sessions ont été révoquées" })
    }

    if (!sessionId) {
      return errorResponse("Session ID requis (ou ?all=true)", 400)
    }

    await revokeSession(sessionId, "user_revoke")

    await logAudit({
      userId: user.id,
      action: "session_revoked",
      category: "session",
      severity: "info",
      metadata: { sessionId },
    })

    return jsonResponse({ success: true })
  } catch (err) {
    console.error("[sessions DELETE] error:", err)
    return errorResponse("Erreur serveur", 500)
  }
}
