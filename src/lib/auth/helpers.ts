/**
 * Helpers communs aux routes d'authentification
 */
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { AUTH_CONFIG } from "./config"
import { signAccessToken } from "./jwt"
import { issueRefreshToken } from "./refresh-tokens"
import { createSession } from "./sessions"
import { setAuthCookies } from "./cookies"
import { getEffectivePermissions } from "./rbac"
import { logAudit } from "./audit"
import type { Role } from "./config"

/**
 * Génère et set tous les tokens + session après authentification réussie
 */
export async function completeLogin(params: {
  userId: string
  email: string
  name?: string | null
  role: Role
  orgId?: string
  workspaceId?: string
  userAgent?: string
  ip?: string
  auditAction?: string
}): Promise<{
  accessToken: string
  refreshToken: string
  sessionId: string
}> {
  // 1. Récupère les permissions effectives
  const permissions = getEffectivePermissions(params.role)

  // 2. Crée la session serveur
  const { session, token: sessionToken } = await createSession({
    userId: params.userId,
    userAgent: params.userAgent,
    ip: params.ip,
  })

  // 3. Signe l'access token (15 min)
  const { token: accessToken, jti } = await signAccessToken({
    userId: params.userId,
    email: params.email,
    name: params.name || undefined,
    role: params.role,
    orgId: params.orgId,
    workspaceId: params.workspaceId,
    permissions,
  })

  // 4. Émet le refresh token (rotating family)
  const { token: refreshToken } = await issueRefreshToken({
    userId: params.userId,
    sessionId: session.id,
    userAgent: params.userAgent,
    ip: params.ip,
  })

  // 5. Set les cookies HTTP-only
  await setAuthCookies({ accessToken, refreshToken })

  // 6. Update last login
  await db.user.update({
    where: { id: params.userId },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: params.ip,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  })

  // 7. Audit log
  await logAudit({
    userId: params.userId,
    action: (params.auditAction as "login") || "login",
    category: "auth",
    severity: "info",
    ip: params.ip,
    userAgent: params.userAgent,
    metadata: { sessionId: session.id, jti, role: params.role },
  })

  return {
    accessToken,
    refreshToken,
    sessionId: session.id,
  }
}

/**
 * Extrait IP et User-Agent depuis une request
 */
export function extractRequestInfo(req: Request): {
  ip?: string
  userAgent?: string
} {
  const forwarded = req.headers.get("x-forwarded-for")
  const ip = forwarded ? forwarded.split(",")[0] : req.headers.get("x-real-ip") || undefined
  const userAgent = req.headers.get("user-agent") || undefined
  return { ip, userAgent }
}

/**
 * Réponse JSON uniformisée
 */
export function jsonResponse(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> }
) {
  return NextResponse.json(body, {
    status: init?.status || 200,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
}

/**
 * Réponse d'erreur uniformisée
 */
export function errorResponse(
  error: string,
  status: number = 400,
  details?: Record<string, unknown>
) {
  return jsonResponse({ error, ...details }, { status })
}
