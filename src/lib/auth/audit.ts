/**
 * Audit logs : enregistrement immutable des événements de sécurité
 */
import { db } from "@/lib/db"

export type AuditAction =
  | "register"
  | "login"
  | "login_failed"
  | "logout"
  | "logout_all"
  | "token_refreshed"
  | "token_revoked"
  | "session_revoked"
  | "2fa_enable"
  | "2fa_disable"
  | "2fa_challenge"
  | "2fa_backup_used"
  | "oauth_login"
  | "oauth_link"
  | "password_change"
  | "password_reset_request"
  | "member_invited"
  | "member_role_changed"
  | "member_removed"
  | "api_key_created"
  | "api_key_revoked"
  | "rate_limit_hit"
  | "account_locked"
  | "replay_detected"
  // Task 38 — profile + DB editor mutations
  | "user_profile_update"
  | "org_update"
  | "db_record_create"
  | "db_record_update"
  | "db_record_delete"

export type AuditCategory = "auth" | "security" | "oauth" | "twofactor" | "session" | "api" | "admin"
export type AuditSeverity = "debug" | "info" | "warn" | "error" | "critical"

export async function logAudit(params: {
  userId?: string
  action: AuditAction
  category: AuditCategory
  severity?: AuditSeverity
  ip?: string
  userAgent?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId || null,
        action: params.action,
        category: params.category,
        severity: params.severity || "info",
        ip: params.ip || null,
        userAgent: params.userAgent || null,
        metadata: JSON.stringify(params.metadata || {}),
      },
    })
  } catch (err) {
    // Ne pas faire échouer l'action principale si le log échoue
    console.error("[audit] Failed to log:", params.action, err)
  }
}

export async function listAuditLogs(params: {
  userId?: string
  category?: AuditCategory
  limit?: number
  offset?: number
}) {
  return db.auditLog.findMany({
    where: {
      userId: params.userId,
      category: params.category,
    },
    orderBy: { createdAt: "desc" },
    take: params.limit || 50,
    skip: params.offset || 0,
  })
}
