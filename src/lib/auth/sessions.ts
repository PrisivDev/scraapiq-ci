/**
 * Sessions : création, validation, révocation, liste
 * - Sessions serveur (persistées) indépendantes du JWT
 * - Couplées au refresh token family pour invalidation cascade
 */
import { db } from "@/lib/db"
import { generateSessionToken, hashToken } from "./jwt"
import { AUTH_CONFIG } from "./config"

export interface SessionInfo {
  id: string
  token: string
  userId: string
  userAgent: string | null
  ip: string | null
  device: string | null
  location: string | null
  lastSeenAt: Date
  expiresAt: Date
  revokedAt: Date | null
  createdAt: Date
}

/**
 * Crée une nouvelle session en DB
 */
export async function createSession(params: {
  userId: string
  userAgent?: string
  ip?: string
}): Promise<{ session: SessionInfo; token: string }> {
  const token = generateSessionToken()
  const tokenHash = await hashToken(token)
  const expiresAt = new Date(Date.now() + AUTH_CONFIG.REFRESH_TOKEN_TTL_SECONDS * 1000)

  const device = parseDevice(params.userAgent)
  const location = await geolocate(params.ip)

  const session = await db.session.create({
    data: {
      userId: params.userId,
      token: tokenHash,
      userAgent: params.userAgent || null,
      ip: params.ip || null,
      device,
      location,
      expiresAt,
    },
  })

  return {
    session: { ...session, token: tokenHash } as SessionInfo,
    token,
  }
}

/**
 * Valide une session par son token (et met à jour lastSeenAt)
 */
export async function validateSession(token: string): Promise<SessionInfo | null> {
  if (!token) return null
  const tokenHash = await hashToken(token)

  const session = await db.session.findUnique({
    where: { token: tokenHash },
  })

  if (!session) return null
  if (session.revokedAt) return null
  if (session.expiresAt < new Date()) return null

  // Update last seen (throttled app-side if needed)
  await db.session.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  })

  return session as SessionInfo
}

/**
 * Révoque une session
 */
export async function revokeSession(
  sessionId: string,
  reason: string = "logout"
): Promise<void> {
  await db.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date(), revokedReason: reason },
  })
}

/**
 * Révoque toutes les sessions d'un utilisateur (sauf celle fournie)
 */
export async function revokeAllUserSessions(
  userId: string,
  exceptSessionId?: string,
  reason: string = "security"
): Promise<void> {
  await db.session.updateMany({
    where: {
      userId,
      id: exceptSessionId ? { not: exceptSessionId } : undefined,
      revokedAt: null,
    },
    data: { revokedAt: new Date(), revokedReason: reason },
  })
}

/**
 * Liste les sessions actives d'un utilisateur
 */
export async function listUserSessions(userId: string): Promise<SessionInfo[]> {
  const sessions = await db.session.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { lastSeenAt: "desc" },
  })
  return sessions as SessionInfo[]
}

// --- Helpers ---

function parseDevice(userAgent?: string): string | null {
  if (!userAgent) return null
  if (/mobile|android|iphone/i.test(userAgent)) return "Mobile"
  if (/tablet|ipad/i.test(userAgent)) return "Tablette"
  if (/windows/i.test(userAgent)) return "Windows PC"
  if (/macintosh|mac os/i.test(userAgent)) return "Mac"
  if (/linux/i.test(userAgent)) return "Linux"
  return "Autre"
}

async function geolocate(ip?: string): Promise<string | null> {
  if (!ip || ip === "127.0.0.1" || ip.startsWith("::1")) return "Local"
  // En production : appel à un service de géoloc IP (MaxMind, IPAPI, etc.)
  // Pour la démo, on retourne Abidjan pour les IPs ivoiriennes
  return "Abidjan, CI"
}
