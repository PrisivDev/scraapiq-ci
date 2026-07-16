/**
 * Auth context : extraction et validation de l'utilisateur courant
 * depuis les cookies HTTP. À utiliser dans les API routes server-side.
 */
import { cookies } from "next/headers"
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { verifyAccessToken } from "./jwt"
import { isJwtBlacklisted } from "./blacklist"
import { getEffectivePermissions } from "./rbac"
import { AUTH_CONFIG } from "./config"
import type { Role } from "./config"

export interface AuthUser {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  role: Role | null
  orgId: string | null
  workspaceId: string | null
  permissions: string[]
  twoFactorEnabled: boolean
}

export interface AuthResult {
  user: AuthUser | null
  error: string | null
  status: number
}

/**
 * Récupère et valide l'utilisateur courant depuis les cookies
 * À utiliser dans les Server Components et API routes
 */
export async function getAuthUser(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies()
    const accessToken = cookieStore.get(AUTH_CONFIG.ACCESS_COOKIE_NAME)?.value

    if (!accessToken) {
      return { user: null, error: "No access token", status: 401 }
    }

    // 1. Vérification signature + expiration
    let claims
    try {
      claims = await verifyAccessToken(accessToken)
    } catch {
      return { user: null, error: "Invalid or expired token", status: 401 }
    }

    // 2. Vérification blacklist (logout)
    if (claims.jti && (await isJwtBlacklisted(claims.jti))) {
      return { user: null, error: "Token revoked", status: 401 }
    }

    // 3. Lookup utilisateur en DB (pour vérifier qu'il existe toujours)
    const user = await db.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        status: true,
        twoFactorEnabled: true,
        memberships: {
          include: { organization: true, workspace: true },
          where: { status: "active" },
          take: 1,
        },
      },
    })

    if (!user || user.status !== "active") {
      return { user: null, error: "User not found or suspended", status: 401 }
    }

    const membership = user.memberships[0]
    const role = (claims.role as Role) || (membership?.role as Role) || "VIEWER"
    const permissions = getEffectivePermissions(role, membership?.permissions ? JSON.parse(membership.permissions) : [])

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role,
        orgId: claims.orgId || membership?.organizationId || null,
        workspaceId: claims.workspaceId || membership?.workspaceId || null,
        permissions,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      error: null,
      status: 200,
    }
  } catch (err) {
    console.error("[auth] getAuthUser error:", err)
    return { user: null, error: "Internal error", status: 500 }
  }
}

/**
 * Variante pour les route handlers (reçoivent la Request directement)
 */
export async function getAuthUserFromRequest(req: NextRequest): Promise<AuthResult> {
  try {
    const accessToken = req.cookies.get(AUTH_CONFIG.ACCESS_COOKIE_NAME)?.value

    if (!accessToken) {
      return { user: null, error: "No access token", status: 401 }
    }

    let claims
    try {
      claims = await verifyAccessToken(accessToken)
    } catch {
      return { user: null, error: "Invalid or expired token", status: 401 }
    }

    if (claims.jti && (await isJwtBlacklisted(claims.jti))) {
      return { user: null, error: "Token revoked", status: 401 }
    }

    const user = await db.user.findUnique({
      where: { id: claims.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        status: true,
        twoFactorEnabled: true,
        memberships: {
          include: { organization: true, workspace: true },
          where: { status: "active" },
          take: 1,
        },
      },
    })

    if (!user || user.status !== "active") {
      return { user: null, error: "User not found or suspended", status: 401 }
    }

    const membership = user.memberships[0]
    const role = (claims.role as Role) || (membership?.role as Role) || "VIEWER"
    const permissions = getEffectivePermissions(role, membership?.permissions ? JSON.parse(membership.permissions) : [])

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role,
        orgId: membership?.organizationId || null,
        workspaceId: membership?.workspaceId || null,
        permissions,
        twoFactorEnabled: user.twoFactorEnabled,
      },
      error: null,
      status: 200,
    }
  } catch (err) {
    console.error("[auth] getAuthUserFromRequest error:", err)
    return { user: null, error: "Internal error", status: 500 }
  }
}

/**
 * Helper pour exiger une authentification (lève une Response 401 si non authentifié)
 */
export async function requireAuth(): Promise<AuthUser> {
  const { user, status, error } = await getAuthUser()
  if (!user) {
    throw new Response(JSON.stringify({ error: error || "Unauthorized" }), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  }
  return user
}

/**
 * Helper pour exiger une permission spécifique
 */
export async function requirePermission(permission: string): Promise<AuthUser> {
  const user = await requireAuth()
  if (!user.permissions.includes(permission)) {
    throw new Response(JSON.stringify({ error: "Forbidden", required: permission }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })
  }
  return user
}
