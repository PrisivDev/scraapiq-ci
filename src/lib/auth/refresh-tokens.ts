/**
 * Refresh tokens rotatifs avec détection de replay
 *
 * Principe :
 * - À chaque login, on crée une "famille" de refresh tokens
 * - Chaque utilisation rotue vers un nouveau token (même famille)
 * - Si un token déjà utilisé réapparaît → replay détecté → toute la famille révoquée
 * - Stockage hashé en DB (jamais en clair)
 */
import { db } from "@/lib/db"
import { hashToken, generateTokenFamily, signRefreshToken, verifyRefreshToken } from "./jwt"
import { AUTH_CONFIG } from "./config"

export interface RefreshTokenRecord {
  id: string
  userId: string
  token: string // hashé
  family: string
  session: string | null
  expiresAt: Date
  usedAt: Date | null
  revokedAt: Date | null
  revokedReason: string | null
  createdAt: Date
}

/**
 * Crée le premier refresh token d'une nouvelle famille (à l'issue du login)
 */
export async function issueRefreshToken(params: {
  userId: string
  sessionId?: string
  userAgent?: string
  ip?: string
}): Promise<{ token: string; jti: string; family: string }> {
  const family = generateTokenFamily()
  const { token, jti } = await signRefreshToken({ userId: params.userId, family })
  const tokenHash = await hashToken(token)

  await db.refreshToken.create({
    data: {
      userId: params.userId,
      token: tokenHash,
      family,
      session: params.sessionId || null,
      userAgent: params.userAgent || null,
      ip: params.ip || null,
      expiresAt: new Date(Date.now() + AUTH_CONFIG.REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  })

  return { token, jti, family }
}

/**
 * Rotue un refresh token :
 * - Valide le token JWT
 * - Vérifie qu'il n'est pas déjà utilisé (replay detection)
 * - Marque l'ancien comme utilisé
 * - Émet un nouveau token de la même famille
 *
 * Si replay détecté → toute la famille est révoquée (sécurité breach)
 */
export async function rotateRefreshToken(
  oldToken: string,
  context?: { userAgent?: string; ip?: string }
): Promise<
  | { success: true; newToken: string; userId: string }
  | { success: false; reason: "invalid" | "expired" | "used" | "revoked" | "not_found" }
> {
  // 1. Vérification JWT
  let payload
  try {
    payload = await verifyRefreshToken(oldToken)
  } catch {
    return { success: false, reason: "invalid" }
  }

  const oldTokenHash = await hashToken(oldToken)

  // 2. Lookup en DB
  const record = await db.refreshToken.findUnique({
    where: { token: oldTokenHash },
  })

  if (!record) return { success: false, reason: "not_found" }
  if (record.revokedAt) return { success: false, reason: "revoked" }
  if (record.expiresAt < new Date()) return { success: false, reason: "expired" }

  // 3. Détection de replay : token déjà utilisé
  if (record.usedAt) {
    // 🔴 Breach detected : toute la famille doit être révoquée
    await revokeTokenFamily(record.family, "replay_detected")
    return { success: false, reason: "used" }
  }

  // 4. Marquer l'ancien comme utilisé
  await db.refreshToken.update({
    where: { id: record.id },
    data: { usedAt: new Date(), revokedAt: new Date(), revokedReason: "rotated" },
  })

  // 5. Émettre un nouveau token de la même famille
  const { token: newToken } = await signRefreshToken({
    userId: record.userId,
    family: record.family,
  })
  const newTokenHash = await hashToken(newToken)

  await db.refreshToken.create({
    data: {
      userId: record.userId,
      token: newTokenHash,
      family: record.family,
      session: record.session,
      userAgent: context?.userAgent || null,
      ip: context?.ip || null,
      expiresAt: new Date(Date.now() + AUTH_CONFIG.REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  })

  return { success: true, newToken, userId: record.userId }
}

/**
 * Révoque toute une famille de refresh tokens (breach response)
 */
export async function revokeTokenFamily(family: string, reason: string): Promise<void> {
  await db.refreshToken.updateMany({
    where: { family, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  })
}

/**
 * Révoque un refresh token spécifique (logout)
 */
export async function revokeRefreshToken(token: string, reason: string = "logout"): Promise<void> {
  const tokenHash = await hashToken(token)
  await db.refreshToken.updateMany({
    where: { token: tokenHash, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  })
}

/**
 * Révoque tous les refresh tokens d'un utilisateur
 */
export async function revokeAllUserRefreshTokens(
  userId: string,
  reason: string = "security"
): Promise<void> {
  await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  })
}
