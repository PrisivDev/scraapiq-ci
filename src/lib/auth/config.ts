/**
 * Constantes & configuration du système d'authentification
 */

export const AUTH_CONFIG = {
  // JWT
  JWT_ISSUER: "scraapiq-ci",
  JWT_AUDIENCE: "scraapiq-users",
  ACCESS_TOKEN_TTL: "15m", // 15 minutes
  ACCESS_TOKEN_TTL_SECONDS: 15 * 60,
  REFRESH_TOKEN_TTL_DAYS: 30,
  REFRESH_TOKEN_TTL_SECONDS: 30 * 24 * 60 * 60,

  // 2FA
  TOTP_ISSUER: "ScrapIQ CI",
  TOTP_ALGORITHM: "SHA1" as const,
  TOTP_DIGITS: 6,
  TOTP_PERIOD: 30,
  TOTP_WINDOW: 1, // ±30s
  BACKUP_CODES_COUNT: 10,

  // Rate limiting (login)
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MINUTES: 15,

  // Cookies
  ACCESS_COOKIE_NAME: "scraapiq_access",
  REFRESH_COOKIE_NAME: "scraapiq_refresh",
  SESSION_COOKIE_NAME: "scraapiq_session",
  COOKIE_PATH: "/",
  COOKIE_SECURE: process.env.NODE_ENV === "production",
  COOKIE_SAME_SITE: "lax" as const,

  // OAuth
  OAUTH_STATE_TTL_SECONDS: 600, // 10 min
  OAUTH_PKCE_LENGTH: 64,
}

// Rôles hiérarchiques (l'ordre compte pour l'héritage)
export const ROLE_HIERARCHY = {
  OWNER: 100,
  ADMIN: 80,
  MANAGER: 60,
  AGENT: 40,
  VIEWER: 20,
} as const

export type Role = keyof typeof ROLE_HIERARCHY

// Permissions granulaires (RBAC)
export const PERMISSIONS = {
  // Companies
  COMPANY_READ: "company:read",
  COMPANY_CREATE: "company:create",
  COMPANY_UPDATE: "company:update",
  COMPANY_DELETE: "company:delete",
  COMPANY_EXPORT: "company:export",

  // Scraping jobs
  JOB_READ: "job:read",
  JOB_CREATE: "job:create",
  JOB_CANCEL: "job:cancel",
  JOB_DELETE: "job:delete",

  // Sources
  SOURCE_READ: "source:read",
  SOURCE_MANAGE: "source:manage",

  // Team & org
  MEMBER_READ: "member:read",
  MEMBER_INVITE: "member:invite",
  MEMBER_REMOVE: "member:remove",
  MEMBER_UPDATE_ROLE: "member:update_role",
  ORG_SETTINGS: "org:settings",
  ORG_BILLING: "org:billing",

  // API & exports
  API_KEY_MANAGE: "api_key:manage",
  EXPORT_CREATE: "export:create",

  // Audit & security
  AUDIT_READ: "audit:read",
  SESSION_REVOKE: "session:revoke",
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

// Matrice rôle → permissions par défaut
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: Object.values(PERMISSIONS), // tous les droits
  ADMIN: [
    PERMISSIONS.COMPANY_READ, PERMISSIONS.COMPANY_CREATE, PERMISSIONS.COMPANY_UPDATE, PERMISSIONS.COMPANY_DELETE, PERMISSIONS.COMPANY_EXPORT,
    PERMISSIONS.JOB_READ, PERMISSIONS.JOB_CREATE, PERMISSIONS.JOB_CANCEL, PERMISSIONS.JOB_DELETE,
    PERMISSIONS.SOURCE_READ, PERMISSIONS.SOURCE_MANAGE,
    PERMISSIONS.MEMBER_READ, PERMISSIONS.MEMBER_INVITE, PERMISSIONS.MEMBER_REMOVE, PERMISSIONS.MEMBER_UPDATE_ROLE,
    PERMISSIONS.ORG_SETTINGS,
    PERMISSIONS.API_KEY_MANAGE, PERMISSIONS.EXPORT_CREATE,
    PERMISSIONS.AUDIT_READ, PERMISSIONS.SESSION_REVOKE,
  ],
  MANAGER: [
    PERMISSIONS.COMPANY_READ, PERMISSIONS.COMPANY_CREATE, PERMISSIONS.COMPANY_UPDATE, PERMISSIONS.COMPANY_EXPORT,
    PERMISSIONS.JOB_READ, PERMISSIONS.JOB_CREATE, PERMISSIONS.JOB_CANCEL,
    PERMISSIONS.SOURCE_READ,
    PERMISSIONS.MEMBER_READ, PERMISSIONS.MEMBER_INVITE,
    PERMISSIONS.EXPORT_CREATE,
    PERMISSIONS.AUDIT_READ,
  ],
  AGENT: [
    PERMISSIONS.COMPANY_READ, PERMISSIONS.COMPANY_CREATE, PERMISSIONS.COMPANY_UPDATE,
    PERMISSIONS.JOB_READ, PERMISSIONS.JOB_CREATE,
    PERMISSIONS.SOURCE_READ,
    PERMISSIONS.EXPORT_CREATE,
  ],
  VIEWER: [
    PERMISSIONS.COMPANY_READ,
    PERMISSIONS.JOB_READ,
    PERMISSIONS.SOURCE_READ,
    PERMISSIONS.MEMBER_READ,
  ],
}
