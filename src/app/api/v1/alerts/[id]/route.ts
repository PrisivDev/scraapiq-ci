/**
 * PUT    /api/v1/alerts/[id]  — Update an alert rule
 * DELETE /api/v1/alerts/[id]  — Delete an alert rule
 */
import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import {
  sendSuccess,
  sendError,
  logApiCall,
  startTimer,
} from "@/lib/api/helpers"
import { requireApiAuth } from "@/lib/api/auth-middleware"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const VALID_METRICS = [
  "quota_usage",
  "scrape_failures",
  "source_degraded",
  "companies_added",
  "dedup_rate",
]
const VALID_CONDITIONS = ["gt", "lt", "gte", "lte", "eq", "contains"]
const VALID_CHANNELS = ["email", "sms", "whatsapp", "push", "webhook", "in_app"]

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const timer = startTimer()
  const auth = await requireApiAuth(req)

  if (!auth.user) {
    const err = sendError(auth.error || "Unauthorized", auth.status, "UNAUTHORIZED")
    await logApiCall({
      req,
      statusCode: auth.status,
      responseMs: timer(),
      userId: null,
      error: auth.error,
    })
    return err
  }

  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const existing = await db.alertRule.findUnique({ where: { id } })
    if (!existing) {
      const err = sendError("Alert rule not found", 404, "NOT_FOUND")
      await logApiCall({
        req,
        statusCode: 404,
        responseMs: timer(),
        userId: auth.user.id,
        error: "Not found",
      })
      return err
    }

    const data: Record<string, unknown> = {}

    if (typeof body.name === "string") data.name = body.name.trim()
    if (typeof body.description === "string") data.description = body.description.trim()
    if (body.metric && VALID_METRICS.includes(body.metric)) data.metric = body.metric
    if (body.condition && VALID_CONDITIONS.includes(body.condition))
      data.condition = body.condition
    if (typeof body.threshold === "number") data.threshold = body.threshold
    if (typeof body.cooldownMin === "number") data.cooldownMin = body.cooldownMin
    if (typeof body.isActive === "boolean") data.isActive = body.isActive

    if (Array.isArray(body.channels)) {
      const channels = body.channels.filter((c: string) =>
        VALID_CHANNELS.includes(c)
      )
      if (channels.length > 0) {
        data.channels = JSON.stringify(channels)
      }
    }

    const updated = await db.alertRule.update({
      where: { id },
      data,
    })

    const res = sendSuccess(
      { ...updated, channels: JSON.parse(updated.channels) as string[] },
      { message: "Alert rule updated" }
    )
    await logApiCall({
      req,
      statusCode: 200,
      responseMs: timer(),
      userId: auth.user.id,
      apiKeyId: auth.apiKeyId,
    })
    return res
  } catch (err) {
    console.error("[alerts] PUT error:", err)
    const message = err instanceof Error ? err.message : "Erreur serveur"
    const res = sendError(message, 500, "INTERNAL_ERROR")
    await logApiCall({
      req,
      statusCode: 500,
      responseMs: timer(),
      userId: auth.user?.id,
      error: message,
    })
    return res
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const timer = startTimer()
  const auth = await requireApiAuth(req)

  if (!auth.user) {
    const err = sendError(auth.error || "Unauthorized", auth.status, "UNAUTHORIZED")
    await logApiCall({
      req,
      statusCode: auth.status,
      responseMs: timer(),
      userId: null,
      error: auth.error,
    })
    return err
  }

  try {
    const { id } = await params
    const existing = await db.alertRule.findUnique({ where: { id } })
    if (!existing) {
      const err = sendError("Alert rule not found", 404, "NOT_FOUND")
      await logApiCall({
        req,
        statusCode: 404,
        responseMs: timer(),
        userId: auth.user.id,
        error: "Not found",
      })
      return err
    }

    await db.alertRule.delete({ where: { id } })

    const res = sendSuccess({ id }, { message: "Alert rule deleted" })
    await logApiCall({
      req,
      statusCode: 200,
      responseMs: timer(),
      userId: auth.user.id,
      apiKeyId: auth.apiKeyId,
    })
    return res
  } catch (err) {
    console.error("[alerts] DELETE error:", err)
    const message = err instanceof Error ? err.message : "Erreur serveur"
    const res = sendError(message, 500, "INTERNAL_ERROR")
    await logApiCall({
      req,
      statusCode: 500,
      responseMs: timer(),
      userId: auth.user?.id,
      error: message,
    })
    return res
  }
}
