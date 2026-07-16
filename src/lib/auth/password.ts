/**
 * Gestion des mots de passe : hash bcrypt + vérification
 */
import bcrypt from "bcryptjs"

const BCRYPT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error("Le mot de passe doit faire au moins 8 caractères")
  }
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false
  try {
    return await bcrypt.compare(password, hash)
  } catch {
    return false
  }
}

export function isPasswordStrong(password: string): {
  ok: boolean
  checks: { length: boolean; upper: boolean; lower: boolean; digit: boolean; special: boolean }
} {
  const checks = {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  }
  return { ok: Object.values(checks).every(Boolean), checks }
}
