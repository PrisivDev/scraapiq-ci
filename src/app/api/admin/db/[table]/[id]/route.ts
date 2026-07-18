/**
 * GET    /api/admin/db/[table]/[id] — fetch single record by id
 * PUT    /api/admin/db/[table]/[id] — partial update (only provided fields)
 * DELETE /api/admin/db/[table]/[id] — delete record by id
 *
 * OWNER only.
 */
import { NextRequest, NextResponse } from "next/server"
import { getAuthUser } from "@/lib/auth/context"
import { logAudit } from "@/lib/auth/audit"
import {
  isAllowedTable,
  getModel,
  sanitizeRow,
  stripBlocked,
  coerceValue,
} from "@/lib/db-admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

async function requireOwner() {
  const authUser = await getAuthUser()
  if (!authUser.user) {
    return {
      error: NextResponse.json(
        { error: "Authentication required", detail: authUser.error },
        { status: 401 }
      ),
      user: null,
    }
  }
  if (authUser.user.role !== "OWNER") {
    return {
      error: NextResponse.json(
        { error: "OWNER access required", role: authUser.user.role },
        { status: 403 }
      ),
      user: null,
    }
  }
  return { error: null, user: authUser.user }
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ table: string; id: string }> }
) {
  const { error, user } = await requireOwner()
  if (error || !user) return error

  const { table, id } = await ctx.params
  if (!isAllowedTable(table)) {
    return NextResponse.json({ error: "Table non autorisée", table }, { status: 400 })
  }

  try {
    const model = getModel(table)
    const row = await model.findUnique({ where: { id } })
    if (!row) {
      return NextResponse.json({ error: "Enregistrement introuvable", table, id }, { status: 404 })
    }
    return NextResponse.json({ success: true, data: sanitizeRow(row) })
  } catch (err) {
    console.error(`[admin/db/${table}/${id}] GET error:`, err)
    return NextResponse.json(
      { error: "Erreur serveur", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ table: string; id: string }> }
) {
  const { error, user } = await requireOwner()
  if (error || !user) return error

  const { table, id } = await ctx.params
  if (!isAllowedTable(table)) {
    return NextResponse.json({ error: "Table non autorisée", table }, { status: 400 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 })
  }

  const { data: raw, stripped } = stripBlocked(body)
  if (stripped.length > 0) {
    console.warn(`[admin/db/${table}/${id}] PUT stripped blocked fields:`, stripped)
  }

  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    const coerced = coerceValue(key, value)
    if (coerced !== undefined) data[key] = coerced
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ valide à mettre à jour" }, { status: 400 })
  }

  try {
    const model = getModel(table)
    // Check existence first for a cleaner 404
    const existing = await model.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Enregistrement introuvable", table, id }, { status: 404 })
    }
    const updated = await model.update({ where: { id }, data })
    const sanitized = sanitizeRow(updated)

    await logAudit({
      userId: user.id,
      action: "db_record_update",
      category: "admin",
      severity: "warn",
      metadata: {
        table,
        recordId: id,
        fields: Object.keys(data),
        stripped,
      },
    })

    return NextResponse.json({ success: true, data: sanitized })
  } catch (err) {
    console.error(`[admin/db/${table}/${id}] PUT error:`, err)
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ table: string; id: string }> }
) {
  const { error, user } = await requireOwner()
  if (error || !user) return error

  const { table, id } = await ctx.params
  if (!isAllowedTable(table)) {
    return NextResponse.json({ error: "Table non autorisée", table }, { status: 400 })
  }

  // Safety: prevent self-deletion via the generic endpoint
  if (table === "user" && id === user.id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas supprimer votre propre compte via le DB editor" },
      { status: 400 }
    )
  }

  try {
    const model = getModel(table)
    const existing = await model.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: "Enregistrement introuvable", table, id }, { status: 404 })
    }
    await model.delete({ where: { id } })

    await logAudit({
      userId: user.id,
      action: "db_record_delete",
      category: "admin",
      severity: "error", // deletes are worth flagging
      metadata: {
        table,
        recordId: id,
        snapshot: sanitizeRow(existing),
      },
    })

    return NextResponse.json({ success: true, deleted: true, id })
  } catch (err) {
    console.error(`[admin/db/${table}/${id}] DELETE error:`, err)
    return NextResponse.json(
      { error: "Erreur lors de la suppression", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
