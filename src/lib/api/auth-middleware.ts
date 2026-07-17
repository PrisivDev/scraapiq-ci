/**
 * API auth middleware — JWT (cookie or Bearer header) or X-API-Key
 *
 * Returns either a valid user or an error + status that the route handler
 * can directly forward to `sendError`.
 */
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { verifyAccessToken } from "@/lib/auth/jwt"
import { isJwtBlacklisted } from "@/lib/auth/blacklist"
import { getEffectivePermissions } from "@/lib/auth/rbac"
import { AUTH_CONFIG, type Role } from "@/lib/auth/config"
import { createHash } from "crypto"
import type { AuthUser } from "@/lib/auth/context"

export interface ApiAuthResult {
  user: AuthUser | null
  apiKeyId?: string | null
  error: string | null
  status: number
}

/**
 * Validates the request using either:
 * 1. JWT in `Authorization: Bearer <token>` header
 * 2. JWT in HTTP-only cookie (scraapiq_access)
 * 3. API key in `X-API-Key` header (looked up in ApiKey table)
 *
 * Returns `{ user, error, status }`. On success, `user` is set.
 * On failure, `error` and `status` are set and `user` is null.
 */
export async function requireApiAuth(req: NextRequest): Promise<ApiAuthResult> {
  try {
    // 1. Try Bearer token
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization")
    let token: string | null = null

    if (authHeader && /^Bearer\s+/i.test(authHeader)) {
      token = authHeader.replace(/^Bearer\s+/i, "").trim()
    } else {
      // 2. Try cookie
      const cookieHeader = req.headers.get("cookie") || ""
      const match = cookieHeader.match(
        new RegExp(`${AUTH_CONFIG.ACCESS_COOKIE_NAME}=([^;]+)`)
      )
      if (match) token = match[1]
    }

    if (token) {
      return await validateJwtToken(token)
    }

    // 3. Try API key
    const apiKey = req.headers.get("x-api-key") || req.headers.get("X-API-Key")
    if (apiKey) {
      return await validateApiKey(apiKey)
    }

    return {
      user: null,
      error: "Authentication required. Provide a Bearer token, cookie, or X-API-Key header.",
      status: 401,
    }
  } catch (err) {
    console.error("[api-auth] error:", err)
    return {
      user: null,
      error: "Authentication error",
      status: 500,
    }
  }
}

async function validateJwtToken(token: string): Promise<ApiAuthResult> {
  let claims
  try {
    claims = await verifyAccessToken(token)
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
  const permissions = getEffectivePermissions(
    role,
    membership?.permissions ? JSON.parse(membership.permissions) : []
  )

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
}

async function validateApiKey(rawKey: string): Promise<ApiAuthResult> {
  const keyHash = createHash("sha256").update(rawKey).digest("hex")

  const apiKey = await db.apiKey.findFirst({
    where: {
      keyHash,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    include: {
      user: {
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
      },
    },
  })

  if (!apiKey || !apiKey.user || apiKey.user.status !== "active") {
    return { user: null, error: "Invalid API key", status: 401 }
  }

  // Update lastUsedAt (best-effort)
  try {
    await db.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
  } catch {
    /* ignore */
  }

  const membership = apiKey.user.memberships[0]
  const role: Role = (membership?.role as Role) || "VIEWER"
  const permissions = getEffectivePermissions(
    role,
    membership?.permissions ? JSON.parse(membership.permissions) : []
  )

  return {
    user: {
      id: apiKey.user.id,
      email: apiKey.user.email,
      name: apiKey.user.name,
      avatarUrl: apiKey.user.avatarUrl,
      role,
      orgId: membership?.organizationId || null,
      workspaceId: membership?.workspaceId || null,
      permissions,
      twoFactorEnabled: apiKey.user.twoFactorEnabled,
    },
    apiKeyId: apiKey.id,
    error: null,
    status: 200,
  }
}
