/**
 * POST /api/auth/login
 * Login email + password
 * - Si 2FA activé : retourne un challenge 2FA (sans émettre de tokens)
 * - Sinon : émet access + refresh tokens + session
 */
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { verifyPassword } from "@/lib/auth/password"
import {
  completeLogin,
  errorResponse,
  extractRequestInfo,
  jsonResponse,
} from "@/lib/auth/helpers"
import { checkRateLimit, getRateLimitKey, resetRateLimit } from "@/lib/auth/rate-limit"
import { logAudit } from "@/lib/auth/audit"
import { AUTH_CONFIG } from "@/lib/auth/config"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password } = body

    if (!email || !password) {
      return errorResponse("Email et mot de passe requis", 400)
    }

    const { ip, userAgent } = extractRequestInfo(req)

    // Rate limit par IP + email
    const rlKey = getRateLimitKey(req, `login:${email.toLowerCase()}`)
    const rl = checkRateLimit(rlKey, { max: AUTH_CONFIG.MAX_LOGIN_ATTEMPTS })
    if (!rl.allowed) {
      await logAudit({
        action: "rate_limit_hit",
        category: "security",
        severity: "warn",
        ip,
        userAgent,
        metadata: { email, endpoint: "login" },
      })
      return errorResponse(
        rl.locked
          ? "Compte temporairement bloqué. Réessayez dans 15 minutes."
          : "Trop de tentatives échouées.",
        429,
        { resetAt: new Date(rl.resetAt).toISOString(), remaining: rl.remaining }
      )
    }

    // Lookup user
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        memberships: {
          where: { status: "active" },
          include: { organization: true, workspace: true },
          take: 1,
        },
      },
    })

    // Anti-énumération : ne pas révéler que l'email n'existe pas
    if (!user) {
      await logAudit({
        action: "login_failed",
        category: "auth",
        severity: "warn",
        ip,
        userAgent,
        metadata: { email, reason: "user_not_found" },
      })
      return errorResponse("Identifiants invalides", 401)
    }

    // Check lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return errorResponse("Compte temporairement verrouillé", 423, {
        lockedUntil: user.lockedUntil.toISOString(),
      })
    }

    // Verify password
    const valid = user.passwordHash
      ? await verifyPassword(password, user.passwordHash)
      : false

    if (!valid) {
      // Incrémente failed attempts
      const failedAttempts = user.failedLoginAttempts + 1
      const shouldLock = failedAttempts >= AUTH_CONFIG.MAX_LOGIN_ATTEMPTS

      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + AUTH_CONFIG.LOCKOUT_DURATION_MINUTES * 60 * 1000)
            : null,
        },
      })

      await logAudit({
        userId: user.id,
        action: "login_failed",
        category: "auth",
        severity: "warn",
        ip,
        userAgent,
        metadata: { reason: "wrong_password", attempts: failedAttempts, locked: shouldLock },
      })

      return errorResponse("Identifiants invalides", 401, {
        remaining: Math.max(0, AUTH_CONFIG.MAX_LOGIN_ATTEMPTS - failedAttempts),
      })
    }

    // Si 2FA activé : on ne completed pas le login, on demande le code 2FA
    if (user.twoFactorEnabled) {
      // Reset du rate limit login (le challenge 2FA a son propre rate limit)
      resetRateLimit(rlKey)

      await logAudit({
        userId: user.id,
        action: "2fa_challenge",
        category: "twofactor",
        severity: "info",
        ip,
        userAgent,
        metadata: {},
      })

      return jsonResponse({
        requiresTwoFactor: true,
        userId: user.id,
        message: "Code 2FA requis",
      })
    }

    // Reset du rate limit après succès
    resetRateLimit(rlKey)

    // Login OK
    const membership = user.memberships[0]
    const role = (membership?.role as "OWNER" | "ADMIN" | "MANAGER" | "AGENT" | "VIEWER") || "VIEWER"

    await completeLogin({
      userId: user.id,
      email: user.email,
      name: user.name,
      role,
      orgId: membership?.organizationId,
      workspaceId: membership?.workspaceId ?? undefined,
      userAgent,
      ip,
    })

    return jsonResponse({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role,
        orgId: membership?.organizationId || null,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    })
  } catch (err) {
    console.error("[login] error:", err)
    return errorResponse("Erreur lors de la connexion", 500)
  }
}
