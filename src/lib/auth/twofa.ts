/**
 * 2FA TOTP : génération secret, validation code, backup codes
 * Utilise otpauth (RFC 6238)
 */
import * as OTPAuth from "otpauth"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { AUTH_CONFIG } from "./config"

/**
 * Génère un nouveau secret TOTP pour un utilisateur
 */
export function generateTOTPSecret(userEmail: string): {
  secret: string
  uri: string
} {
  const secret = new OTPAuth.Secret({ size: 20 })

  const totp = new OTPAuth.TOTP({
    issuer: AUTH_CONFIG.TOTP_ISSUER,
    label: userEmail,
    algorithm: AUTH_CONFIG.TOTP_ALGORITHM,
    digits: AUTH_CONFIG.TOTP_DIGITS,
    period: AUTH_CONFIG.TOTP_PERIOD,
    secret,
  })

  return {
    secret: secret.base32,
    uri: totp.toString(),
  }
}

/**
 * Valide un code TOTP (avec fenêtre de tolérance ±30s)
 */
export function verifyTOTP(secret: string, code: string): boolean {
  if (!secret || !code || code.length !== AUTH_CONFIG.TOTP_DIGITS) return false

  try {
    const totp = new OTPAuth.TOTP({
      issuer: AUTH_CONFIG.TOTP_ISSUER,
      algorithm: AUTH_CONFIG.TOTP_ALGORITHM,
      digits: AUTH_CONFIG.TOTP_DIGITS,
      period: AUTH_CONFIG.TOTP_PERIOD,
      secret: OTPAuth.Secret.fromBase32(secret),
    })

    const delta = totp.validate({
      token: code,
      window: AUTH_CONFIG.TOTP_WINDOW,
    })

    return delta !== null
  } catch {
    return false
  }
}

/**
 * Génère 10 codes de récupération (hashés pour stockage)
 */
export async function generateBackupCodes(): Promise<{
  plain: string[]
  hashed: string[]
}> {
  const plain: string[] = []
  const hashed: string[] = []

  for (let i = 0; i < AUTH_CONFIG.BACKUP_CODES_COUNT; i++) {
    const code = randomBytes(5).toString("hex").toUpperCase().replace(/(.{4})/g, "$1-").slice(0, -1)
    plain.push(code)
    hashed.push(await bcrypt.hash(code, 10))
  }

  return { plain, hashed }
}

/**
 * Consomme un code de récupération (vérifie + retourne l'index pour invalidation)
 */
export async function verifyBackupCode(
  code: string,
  hashedCodes: string[]
): Promise<number> {
  for (let i = 0; i < hashedCodes.length; i++) {
    if (await bcrypt.compare(code, hashedCodes[i])) {
      return i // index du code utilisé
    }
  }
  return -1
}
