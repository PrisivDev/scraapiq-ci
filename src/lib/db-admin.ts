/**
 * Shared helpers for the generic DB CRUD endpoints (/api/admin/db/[table], /api/admin/db/[table]/[id]).
 *
 * Secured at the route level: OWNER only.
 * Whitelist of tables prevents SQL-injection-like dynamic table access.
 * BLOCKED_FIELDS prevents writing sensitive fields via the generic endpoint.
 */
import { db } from "@/lib/db"
import { Prisma } from "@prisma/client"

export const ALLOWED_TABLES = [
  "user",
  "organization",
  "workspace",
  "member",
  "company",
  "contact",
  "session",
  "refreshToken",
  "jwtBlacklist",
  "auditLog",
  "license",
  "subscription",
  "invoice",
  "quotaUsage",
  "apiKey",
  "restApiLog",
  "notification",
  "alertRule",
  "scheduledReport",
  "reportExecution",
  "webhook",
  "webhookDelivery",
  "account",
] as const

export type AllowedTable = (typeof ALLOWED_TABLES)[number]

// Map table name → Prisma model name (most are simple PascalCase, but some are different)
const TABLE_TO_MODEL: Record<AllowedTable, string> = {
  user: "User",
  organization: "Organization",
  workspace: "Workspace",
  member: "Member",
  company: "Company",
  contact: "Contact",
  session: "Session",
  refreshToken: "RefreshToken",
  jwtBlacklist: "JwtBlacklist",
  auditLog: "AuditLog",
  license: "License",
  subscription: "Subscription",
  invoice: "Invoice",
  quotaUsage: "QuotaUsage",
  apiKey: "ApiKey",
  restApiLog: "RestApiLog",
  notification: "Notification",
  alertRule: "AlertRule",
  scheduledReport: "ScheduledReport",
  reportExecution: "ReportExecution",
  webhook: "Webhook",
  webhookDelivery: "WebhookDelivery",
  account: "Account",
}

/**
 * Returns the list of column names for a given table, from Prisma's DMMF.
 * Works even when the table is empty.
 */
export function getColumns(table: AllowedTable): string[] {
  const modelName = TABLE_TO_MODEL[table]
  const model = (Prisma as unknown as {
    dmmf: {
      datamodel: {
        models: Array<{ name: string; fields: Array<{ name: string }> }>
      }
    }
  }).dmmf.datamodel.models.find((m) => m.name === modelName)
  if (!model) return []
  return model.fields.map((f) => f.name)
}

// Fields that can NEVER be written via the generic CRUD endpoint.
// Even if the user sends them, they're stripped.
export const BLOCKED_FIELDS = new Set([
  "passwordHash",
  "twoFactorSecret",
  "twoFactorBackupCodes",
  "refreshTokenHash",
  "tokenHash",
  "secret",
  "hashedKey",
  "keyHash",
  "accessToken",
  "refreshToken", // OAuth account.refreshToken
])

// Fields that are auto-managed by the DB and should not be set manually on create/update.
export const AUTO_FIELDS = new Set([
  "id",
  "createdAt",
  "updatedAt",
  "lastSeenAt",
  "usedAt",
  "revokedAt",
  "expiresAt", // most expiry fields are computed server-side; safer to block
])

export function isAllowedTable(name: string): name is AllowedTable {
  return (ALLOWED_TABLES as readonly string[]).includes(name)
}

export function getModel(table: AllowedTable) {
  // @ts-expect-error — accès dynamique au modèle Prisma
  return db[table] as {
    count: (args?: { where?: Record<string, unknown> }) => Promise<number>
    findMany: (args?: Record<string, unknown>) => Promise<Record<string, unknown>[]>
    findUnique: (args?: Record<string, unknown>) => Promise<Record<string, unknown> | null>
    findFirst: (args?: Record<string, unknown>) => Promise<Record<string, unknown> | null>
    create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>
    update: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<Record<string, unknown>>
    delete: (args: { where: Record<string, unknown> }) => Promise<Record<string, unknown>>
  }
}

export const SENSITIVE_FIELDS = new Set([
  "passwordHash",
  "twoFactorSecret",
  "twoFactorBackupCodes",
  "refreshTokenHash",
  "tokenHash",
  "secret",
  "hashedKey",
  "keyHash",
  "accessToken",
  "refreshToken",
])

export function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (SENSITIVE_FIELDS.has(key)) {
      cleaned[key] = value ? "***hidden***" : null
    } else if (value instanceof Date) {
      cleaned[key] = value.toISOString()
    } else if (typeof value === "object" && value !== null) {
      cleaned[key] = JSON.stringify(value)
    } else {
      cleaned[key] = value
    }
  }
  return cleaned
}

/**
 * Strip sensitive + auto-managed fields from a write payload (create or update).
 * Returns the cleaned payload + the list of stripped field names (for audit).
 */
export function stripBlocked(
  input: Record<string, unknown>
): { data: Record<string, unknown>; stripped: string[] } {
  const data: Record<string, unknown> = {}
  const stripped: string[] = []
  for (const [key, value] of Object.entries(input)) {
    if (BLOCKED_FIELDS.has(key) || AUTO_FIELDS.has(key)) {
      stripped.push(key)
      continue
    }
    data[key] = value
  }
  return { data, stripped }
}

/**
 * Coerce a string value to the right type for known boolean/integer fields.
 * (Prisma will reject the wrong type otherwise.)
 */
export function coerceValue(key: string, value: unknown): unknown {
  if (value === null || value === undefined) return value
  const BOOL_FIELDS = new Set([
    "twoFactorEnabled",
    "isActive",
    "cancelAtPeriodEnd",
    "emailVerified",
  ])
  const INT_FIELDS = new Set([
    "maxUsers",
    "maxCompanies",
    "maxApiCalls",
    "maxExports",
    "maxSources",
    "maxWorkspaces",
    "amountXOF",
    "taxXOF",
    "totalXOF",
    "apiCalls",
    "companiesStored",
    "exportsCount",
    "scrapeJobs",
    "usersCount",
    "periodYear",
    "periodMonth",
    "statusCode",
    "responseMs",
    "attempts",
    "maxAttempts",
    "triggerCount",
    "cooldownMin",
    "runCount",
    "fileSizeBytes",
    "reviewCount",
    "failedLoginAttempts",
  ])
  const FLOAT_FIELDS = new Set(["lat", "lng", "rating", "threshold"])

  // If value is a string and looks empty, return null for nullable fields
  if (typeof value === "string") {
    if (BOOL_FIELDS.has(key)) {
      if (value === "true") return true
      if (value === "false") return false
    }
    if (INT_FIELDS.has(key)) {
      const n = parseInt(value, 10)
      return Number.isNaN(n) ? value : n
    }
    if (FLOAT_FIELDS.has(key)) {
      const n = parseFloat(value)
      return Number.isNaN(n) ? value : n
    }
    if (value === "") return undefined // let DB default apply
    return value
  }
  return value
}
