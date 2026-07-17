/**
 * PUT    /api/v1/reports/[id]  — Update a scheduled report
 * DELETE /api/v1/reports/[id]  — Delete a scheduled report
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
import { calculateNextRun } from "@/lib/notifications/reports"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const VALID_TYPES = ["daily", "weekly", "monthly", "custom"]
const VALID_FORMATS = ["pdf", "xlsx", "csv", "json"]
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

    const existing = await db.scheduledReport.findUnique({ where: { id } })
    if (!existing) {
      const err = sendError("Scheduled report not found", 404, "NOT_FOUND")
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
    if (typeof body.description === "string")
      data.description = body.description.trim()
    if (body.type && VALID_TYPES.includes(body.type)) data.type = body.type
    if (body.format && VALID_FORMATS.includes(body.format)) data.format = body.format
    if (typeof body.isActive === "boolean") data.isActive = body.isActive

    if (typeof body.schedule === "string") {
      data.schedule = body.schedule.trim()
      data.nextRunAt = calculateNextRun(body.schedule.trim())
    }

    if (Array.isArray(body.channels)) {
      const channels = body.channels.filter((c: string) =>
        VALID_CHANNELS.includes(c)
      )
      if (channels.length > 0) data.channels = JSON.stringify(channels)
    }
    if (Array.isArray(body.recipients)) {
      data.recipients = JSON.stringify(body.recipients)
    }
    if (body.filters && typeof body.filters === "object") {
      data.filters = JSON.stringify(body.filters)
    }

    const updated = await db.scheduledReport.update({
      where: { id },
      data,
    })

    const res = sendSuccess(
      {
        ...updated,
        channels: JSON.parse(updated.channels) as string[],
        recipients: JSON.parse(updated.recipients) as string[],
        filters: JSON.parse(updated.filters) as Record<string, unknown>,
      },
      { message: "Scheduled report updated" }
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
    console.error("[reports] PUT error:", err)
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
    const existing = await db.scheduledReport.findUnique({ where: { id } })
    if (!existing) {
      const err = sendError("Scheduled report not found", 404, "NOT_FOUND")
      await logApiCall({
        req,
        statusCode: 404,
        responseMs: timer(),
        userId: auth.user.id,
        error: "Not found",
      })
      return err
    }

    await db.scheduledReport.delete({ where: { id } })

    const res = sendSuccess({ id }, { message: "Scheduled report deleted" })
    await logApiCall({
      req,
      statusCode: 200,
      responseMs: timer(),
      userId: auth.user.id,
      apiKeyId: auth.apiKeyId,
    })
    return res
  } catch (err) {
    console.error("[reports] DELETE error:", err)
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
