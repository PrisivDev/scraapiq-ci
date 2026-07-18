/**
 * GET  /api/admin/db/[table]?page=1&limit=20 — list records (paginated) + columns + total
 * POST /api/admin/db/[table]                  — create a new record in [table]
 *
 * OWNER only. Powerful & dangerous — see /lib/db-admin.ts for the whitelist.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth/context"
import { logAudit } from "@/lib/auth/audit"
import {
  isAllowedTable,
  getModel,
  getColumns,
  sanitizeRow,
  stripBlocked,
  coerceValue,
} from "@/lib/db-admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  // Auth: OWNER only
  const authUser = await getAuthUser()
  if (!authUser.user) {
    return NextResponse.json({ error: "Authentication required", detail: authUser.error }, { status: 401 })
  }
  if (authUser.user.role !== "OWNER") {
    return NextResponse.json({ error: "OWNER access required", role: authUser.user.role }, { status: 403 })
  }

  const { table } = await ctx.params
  if (!isAllowedTable(table)) {
    return NextResponse.json({ error: "Table non autorisée", table }, { status: 400 })
  }

  const url = req.nextUrl
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10) || 20))
  const skip = (page - 1) * limit

  try {
    const model = getModel(table)
    const where: Record<string, unknown> = {}

    // Optional search: ?search=foo&searchField=name
    const search = url.searchParams.get("search")
    const searchField = url.searchParams.get("searchField")
    if (search && searchField) {
      where[searchField] = { contains: search }
    }

    const [total, rows] = await Promise.all([
      model.count({ where }),
      (async () => {
        try {
          return await model.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: "desc" as const },
          })
        } catch {
          // Fallback: tables without a createdAt field (member, account, etc.)
          return await model.findMany({ where, skip, take: limit })
        }
      })(),
    ])

    const sanitized = rows.map((r) => sanitizeRow(r))

    // Build columns list — from rows if available, else from Prisma DMMF (handles empty tables)
    const columns =
      sanitized.length > 0 ? Object.keys(sanitized[0]) : getColumns(table)

    return NextResponse.json({
      success: true,
      data: {
        table,
        columns,
        rows: sanitized,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
  } catch (err) {
    console.error(`[admin/db/${table}] GET error:`, err)
    return NextResponse.json(
      {
        error: "Erreur lors de la lecture",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ table: string }> }
) {
  // Auth: OWNER only
  const authUser = await getAuthUser()
  if (!authUser.user) {
    return NextResponse.json({ error: "Authentication required", detail: authUser.error }, { status: 401 })
  }
  if (authUser.user.role !== "OWNER") {
    return NextResponse.json({ error: "OWNER access required", role: authUser.user.role }, { status: 403 })
  }

  const { table } = await ctx.params
  if (!isAllowedTable(table)) {
    return NextResponse.json({ error: "Table non autorisée", table }, { status: 400 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  // Strip blocked + auto-managed fields
  const { data: raw, stripped } = stripBlocked(body)
  if (stripped.length > 0) {
    console.warn(`[admin/db/${table}] POST stripped blocked fields:`, stripped)
  }

  // Coerce types for known scalar fields
  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    data[key] = coerceValue(key, value)
  }
  // Drop undefined values (Prisma doesn't accept them on create)
  for (const k of Object.keys(data)) {
    if (data[k] === undefined) delete data[k]
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ valide à insérer" }, { status: 400 })
  }

  try {
    const model = getModel(table)
    const created = await model.create({ data })
    const sanitized = sanitizeRow(created)

    await logAudit({
      userId: authUser.user.id,
      action: "db_record_create",
      category: "admin",
      severity: "warn",
      metadata: {
        table,
        recordId: (created as { id?: string }).id,
        fields: Object.keys(data),
        stripped,
      },
    })

    return NextResponse.json({ success: true, data: sanitized }, { status: 201 })
  } catch (err) {
    console.error(`[admin/db/${table}] POST error:`, err)
    return NextResponse.json(
      {
        error: "Erreur lors de la création",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
