/**
 * POST /api/auth/verify-2fa
 * Vérifie un code TOTP (ou backup code) et finalise le login
 */
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { verifyTOTP, verifyBackupCode } from "@/lib/auth/twofa"
import {
  completeLogin,
  errorResponse,
  extractRequestInfo,
  jsonResponse,
} from "@/lib/auth/helpers"
import { checkRateLimit, getRateLimitKey, resetRateLimit } from "@/lib/auth/rate-limit"
import { logAudit } from "@/lib/auth/audit"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { userId, code, useBackup } = body

    if (!userId || !code) {
      return errorResponse("userId et code requis", 400)
    }

    // Rate limit spécifique 2FA
    const rlKey = getRateLimitKey(req, `2fa:${userId}`)
    const rl = checkRateLimit(rlKey, { max: 5 })
    if (!rl.allowed) {
      return errorResponse("Trop de tentatives 2FA. Réessayez plus tard.", 429)
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { status: "active" },
          take: 1,
        },
      },
    })

    if (!user) {
      return errorResponse("Utilisateur introuvable", 404)
    }

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return errorResponse("2FA non activé pour ce compte", 400)
    }

    const { ip, userAgent } = extractRequestInfo(req)

    // Backup code ?
    if (useBackup) {
      const backupCodes = user.twoFactorBackupCodes
        ? JSON.parse(user.twoFactorBackupCodes)
        : []

      const usedIndex = await verifyBackupCode(code, backupCodes)
      if (usedIndex === -1) {
        await logAudit({
          userId: user.id,
          action: "2fa_challenge",
          category: "twofactor",
          severity: "warn",
          ip,
          userAgent,
          metadata: { success: false, method: "backup" },
        })
        return errorResponse("Code de récupération invalide", 401)
      }

      // Invalide le code utilisé
      backupCodes.splice(usedIndex, 1)
      await db.user.update({
        where: { id: user.id },
        data: { twoFactorBackupCodes: JSON.stringify(backupCodes) },
      })

      await logAudit({
        userId: user.id,
        action: "2fa_backup_used",
        category: "twofactor",
        severity: "warn",
        ip,
        userAgent,
        metadata: { remainingCodes: backupCodes.length },
      })
    } else {
      // TOTP code
      const valid = verifyTOTP(user.twoFactorSecret, code)
      if (!valid) {
        await logAudit({
          userId: user.id,
          action: "2fa_challenge",
          category: "twofactor",
          severity: "warn",
          ip,
          userAgent,
          metadata: { success: false, method: "totp" },
        })
        return errorResponse("Code 2FA invalide", 401)
      }

      await logAudit({
        userId: user.id,
        action: "2fa_challenge",
        category: "twofactor",
        severity: "info",
        ip,
        userAgent,
        metadata: { success: true, method: "totp" },
      })
    }

    resetRateLimit(rlKey)

    const membership = user.memberships[0]
    const role = (membership?.role as "OWNER" | "ADMIN" | "MANAGER" | "AGENT" | "VIEWER") || "VIEWER"

    await completeLogin({
      userId: user.id,
      email: user.email,
      name: user.name,
      role,
      orgId: membership?.organizationId,
      workspaceId: membership?.workspaceId,
      userAgent,
      ip,
      auditAction: "login",
    })

    return jsonResponse({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        twoFactorEnabled: true,
      },
    })
  } catch (err) {
    console.error("[verify-2fa] error:", err)
    return errorResponse("Erreur lors de la vérification 2FA", 500)
  }
}
