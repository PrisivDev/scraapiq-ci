/**
 * Blacklist JWT : permet de révoquer un access token avant son expiration naturelle
 *
 * Stratégie :
 * - À chaque logout, on stocke le JTI du token en base
 * - À chaque vérification de token, on check la blacklist
 * - Les entrées expirent automatiquement (quand le JWT original aurait expiré)
 * - Cleanup périodique des entrées expirées
 */
import { db } from "@/lib/db"

/**
 * Ajoute un JTI à la blacklist
 */
export async function blacklistJwt(params: {
  userId: string
  jti: string
  expiresAt: Date // date d'expiration du JWT original
  reason?: string
}): Promise<void> {
  await db.jwtBlacklist.upsert({
    where: { jti: params.jti },
    create: {
      userId: params.userId,
      jti: params.jti,
      reason: params.reason || "logout",
      expiresAt: params.expiresAt,
    },
    update: {}, // déjà blacklisté, no-op
  })
}

/**
 * Vérifie si un JTI est blacklisted
 */
export async function isJwtBlacklisted(jti: string): Promise<boolean> {
  if (!jti) return false
  const count = await db.jwtBlacklist.count({
    where: { jti },
  })
  return count > 0
}

/**
 * Blacklist tous les tokens d'un utilisateur (logout all devices, breach, password change)
 */
export async function blacklistAllUserTokens(
  userId: string,
  expiresAt: Date,
  reason: string = "security"
): Promise<void> {
  // Note : en pratique on blacklist par JTI (un par token émis).
  // Pour "logout all", on révoque aussi toutes les sessions + refresh tokens,
  // ce qui empêche l'émission de nouveaux access tokens.
  // Les access tokens déjà émis restent valides jusqu'à expiration (15 min max).

  // Pour une invalidation immédiate, on peut stocker un "token_version" sur l'utilisateur
  // et l'inclure dans le JWT. Tout changement de version invalide tous les tokens.
  // Ici on révoque sessions + refresh tokens.
  await db.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  })
  await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  })
}

/**
 * Nettoie les entrées expirées (à appeler par cron)
 */
export async function cleanupExpiredBlacklist(): Promise<number> {
  const result = await db.jwtBlacklist.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  })
  return result.count
}
