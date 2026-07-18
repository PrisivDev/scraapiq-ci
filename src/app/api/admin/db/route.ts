/**
 * GET /api/admin/db
 *
 * Retourne l'état de la base de données : liste des tables, nombre de lignes,
 * et les 5 premières lignes de chaque table (pour le DB Viewer du dashboard).
 *
 * Accès : OWNER uniquement (données sensibles).
 */
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getAuthUser } from "@/lib/auth/context"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Liste des modèles Prisma à inspecter (ordre alphabétique)
const MODELS = [
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

// Champs à masquer pour éviter de fuiter des données sensibles
const SENSITIVE_FIELDS = new Set([
  "passwordHash",
  "twoFactorSecret",
  "backupCodes",
  "refreshTokenHash",
  "tokenHash",
  "secret",
  "hashedKey",
])

function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
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

export async function GET() {
  // Auth : OWNER uniquement
  const authUser = await getAuthUser()
  if (!authUser.user) {
    return NextResponse.json({ error: "Authentication required", detail: authUser.error }, { status: 401 })
  }
  if (authUser.user.role !== "OWNER") {
    return NextResponse.json({ error: "OWNER access required", role: authUser.user.role }, { status: 403 })
  }

  const tables: Array<{
    name: string
    count: number
    sampleRows: Record<string, unknown>[]
    error?: string
  }> = []

  let totalRows = 0

  for (const modelName of MODELS) {
    try {
      // @ts-expect-error — accès dynamique au modèle Prisma
      const model = db[modelName]
      if (!model || typeof model.count !== "function") {
        tables.push({ name: modelName, count: 0, sampleRows: [], error: "model not found" })
        continue
      }

      const count = await model.count()
      totalRows += count

      // Récupère les 5 premières lignes triées par createdAt desc (si le champ existe)
      let sampleRows: Record<string, unknown>[] = []
      if (count > 0) {
        try {
          // @ts-expect-error — accès dynamique
          const rows = await model.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
          })
          sampleRows = rows.map((r: Record<string, unknown>) => sanitizeRow(r))
        } catch {
          // Si pas de createdAt, on prend les 5 premières sans ordre
          // @ts-expect-error — accès dynamique
          const rows = await model.findMany({ take: 5 })
          sampleRows = rows.map((r: Record<string, unknown>) => sanitizeRow(r))
        }
      }

      tables.push({ name: modelName, count, sampleRows })
    } catch (e) {
      tables.push({
        name: modelName,
        count: 0,
        sampleRows: [],
        error: e instanceof Error ? e.message : "unknown error",
      })
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      database: {
        provider: "sqlite",
        url: process.env.DATABASE_URL?.replace(/\/\/.*@/, "//***@") || "unknown",
      },
      summary: {
        totalTables: tables.length,
        totalRows,
        tablesWithData: tables.filter((t) => t.count > 0).length,
      },
      tables,
    },
  })
}
