/**
 * POST /api/twofa/setup
 * Active le 2FA : génère un secret + backup codes, retourne le QR code
 *
 * Body (étape 1 - init) :
 *   { action: "init" } → retourne { secret, qrUri, backupCodes }
 * Body (étape 2 - confirm) :
 *   { action: "confirm", secret, code } → active le 2FA en DB
 */
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getAuthUser, errorResponse, jsonResponse } from "@/lib/auth"
import { generateTOTPSecret, verifyTOTP, generateBackupCodes } from "@/lib/auth/twofa"
import { logAudit } from "@/lib/auth/audit"
import QRCode from "qrcode"

export async function POST(req: NextRequest) {
  try {
    const { user, error, status } = await getAuthUser()
    if (!user) return errorResponse(error || "Unauthorized", status)

    const body = await req.json()
    const action = body.action || "init"

    if (action === "init") {
      // Étape 1 : génération
      const { secret, uri } = generateTOTPSecret(user.email)
      const { plain: backupCodes, hashed: hashedCodes } = await generateBackupCodes()

      // Génère le QR code en data URL
      const qrDataUrl = await QRCode.toDataURL(uri, {
        width: 240,
        margin: 2,
        color: { dark: "#0f172a", light: "#ffffff" },
      })

      // Stocke temporairement en DB (status pending - non encore activé)
      await db.user.update({
        where: { id: user.id },
        data: {
          twoFactorSecret: secret,
          twoFactorBackupCodes: JSON.stringify(hashedCodes),
        },
      })

      return jsonResponse({
        secret,
        qrCode: qrDataUrl,
        otpauthUri: uri,
        backupCodes,
        message:
          "Scannez le QR code avec votre app d'authentification (Google Authenticator, Authy, 1Password), puis confirmez avec un code.",
      })
    }

    if (action === "confirm") {
      // Étape 2 : validation du code avant activation
      const { code } = body
      if (!code) return errorResponse("Code requis", 400)

      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: { twoFactorSecret: true },
      })

      if (!dbUser?.twoFactorSecret) {
        return errorResponse("2FA non initialisé. Appelez d'abord action=init", 400)
      }

      const valid = verifyTOTP(dbUser.twoFactorSecret, code)
      if (!valid) {
        return errorResponse("Code TOTP invalide", 401)
      }

      // Active le 2FA
      await db.user.update({
        where: { id: user.id },
        data: {
          twoFactorEnabled: true,
          twoFactorEnabledAt: new Date(),
        },
      })

      await logAudit({
        userId: user.id,
        action: "2fa_enable",
        category: "twofactor",
        severity: "info",
        ip: req.headers.get("x-forwarded-for") || undefined,
        userAgent: req.headers.get("user-agent") || undefined,
        metadata: {},
      })

      return jsonResponse({
        success: true,
        message: "2FA activé avec succès",
      })
    }

    return errorResponse("Action invalide (init ou confirm)", 400)
  } catch (err) {
    console.error("[2fa/setup] error:", err)
    return errorResponse("Erreur serveur", 500)
  }
}
