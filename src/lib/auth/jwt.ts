/**
 * JWT : émission et vérification avec jose (Edge-compatible)
 * - Access token court (15 min) avec claims typés
 * - JTI unique pour blacklist
 * - Refresh token opaque (hashé en DB)
 */
import { SignJWT, jwtVerify, type JWTPayload } from "jose"
import { randomUUID } from "crypto"
import { AUTH_CONFIG } from "./config"

const secret = new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-in-production-min-32-chars")

export interface AccessTokenClaims extends JWTPayload {
  sub: string // userId
  email: string
  name?: string
  role: string // role principal dans l'org courante
  orgId?: string
  workspaceId?: string
  permissions: string[]
  jti: string // JWT ID (pour blacklist)
  type: "access"
}

export interface RefreshTokenClaims extends JWTPayload {
  sub: string
  jti: string
  family: string
  type: "refresh"
}

/**
 * Signe un access token (15 min)
 */
export async function signAccessToken(params: {
  userId: string
  email: string
  name?: string
  role: string
  orgId?: string
  workspaceId?: string
  permissions: string[]
}): Promise<{ token: string; jti: string; expiresIn: number }> {
  const jti = randomUUID()
  const token = await new SignJWT({
    type: "access",
    email: params.email,
    name: params.name,
    role: params.role,
    orgId: params.orgId,
    workspaceId: params.workspaceId,
    permissions: params.permissions,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(params.userId)
    .setJti(jti)
    .setIssuedAt()
    .setIssuer(AUTH_CONFIG.JWT_ISSUER)
    .setAudience(AUTH_CONFIG.JWT_AUDIENCE)
    .setExpirationTime(AUTH_CONFIG.ACCESS_TOKEN_TTL)
    .sign(secret)

  return { token, jti, expiresIn: AUTH_CONFIG.ACCESS_TOKEN_TTL_SECONDS }
}

/**
 * Signe un refresh token (30 jours)
 */
export async function signRefreshToken(params: {
  userId: string
  family: string
}): Promise<{ token: string; jti: string; expiresIn: number }> {
  const jti = randomUUID()
  const token = await new SignJWT({
    type: "refresh",
    family: params.family,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(params.userId)
    .setJti(jti)
    .setIssuedAt()
    .setIssuer(AUTH_CONFIG.JWT_ISSUER)
    .setAudience(AUTH_CONFIG.JWT_AUDIENCE)
    .setExpirationTime(`${AUTH_CONFIG.REFRESH_TOKEN_TTL_DAYS}d`)
    .sign(secret)

  return { token, jti, expiresIn: AUTH_CONFIG.REFRESH_TOKEN_TTL_SECONDS }
}

/**
 * Vérifie un access token. Lève si invalide.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  const { payload } = await jwtVerify(token, secret, {
    issuer: AUTH_CONFIG.JWT_ISSUER,
    audience: AUTH_CONFIG.JWT_AUDIENCE,
  })
  if (payload.type !== "access") {
    throw new Error("Token type mismatch: expected access")
  }
  return payload as AccessTokenClaims
}

/**
 * Vérifie un refresh token. Lève si invalide.
 */
export async function verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
  const { payload } = await jwtVerify(token, secret, {
    issuer: AUTH_CONFIG.JWT_ISSUER,
    audience: AUTH_CONFIG.JWT_AUDIENCE,
  })
  if (payload.type !== "refresh") {
    throw new Error("Token type mismatch: expected refresh")
  }
  return payload as RefreshTokenClaims
}

/**
 * Hash un refresh token avant stockage (jamais en clair en DB)
 */
export async function hashToken(token: string): Promise<string> {
  const { createHash } = await import("crypto")
  return createHash("sha256").update(token).digest("hex")
}

/**
 * Génère un ID de famille pour les refresh tokens rotatifs
 */
export function generateTokenFamily(): string {
  return randomUUID()
}

/**
 * Génère un opaque session token (non-JWT)
 */
export function generateSessionToken(): string {
  return randomUUID() + "." + randomUUID()
}
