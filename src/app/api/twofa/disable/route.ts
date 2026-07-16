/**
 * POST /api/twofa/disable
 * Désactive le 2FA (requiert mot de passe ou code TOTP pour confirmation)
 */
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getAuthUser, errorResponse, jsonResponse } from "@/lib/auth"
import { verifyPassword } from "@/lib/auth/password"
import { verifyTOTP } from "@/lib/auth/twofa"
import { logAudit } from "@/lib/auth/audit"

export async function POST(req: NextRequest) {
  try {
    const { user, error, status } = await getAuthUser()
    if (!user) return errorResponse(error || "Unauthorized", status)

    const body = await req.json()
    const { password, code } = body

    if (!password && !code) {
      return errorResponse("Mot de passe ou code TOTP requis pour confirmer", 400)
    }

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true, twoFactorSecret: true, twoFactorEnabled: true },
    })

    if (!dbUser) return errorResponse("User not found", 404)
    if (!dbUser.twoFactorEnabled) {
      return errorResponse("2FA n'est pas activé", 400)
    }

    // Vérifie par mot de passe OU par code TOTP
    let confirmed = false
    if (password && dbUser.passwordHash) {
      confirmed = await verifyPassword(password, dbUser.passwordHash)
    } else if (code && dbUser.twoFactorSecret) {
      confirmed = verifyTOTP(dbUser.twoFactorSecret, code)
    }

    if (!confirmed) {
      return errorResponse("Confirmation invalide", 401)
    }

    await db.user.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorEnabledAt: null,
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      },
    })

    await logAudit({
      userId: user.id,
      action: "2fa_disable",
      category: "twofactor",
      severity: "warn",
      ip: req.headers.get("x-forwarded-for") || undefined,
      userAgent: req.headers.get("user-agent") || undefined,
      metadata: {},
    })

    return jsonResponse({
      success: true,
      message: "2FA désactivé",
    })
  } catch (err) {
    console.error("[2fa/disable] error:", err)
    return errorResponse("Erreur serveur", 500)
  }
}
