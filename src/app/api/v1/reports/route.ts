/**
 * GET  /api/v1/reports  — List scheduled reports
 * POST /api/v1/reports  — Create a scheduled report
 *
 * Body (POST):
 *   { name, description?, type, schedule, channels?, recipients?, filters?, format?, isActive? }
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
import { createScheduledReport } from "@/lib/notifications/reports"
import { seedNotificationsIfEmpty } from "@/lib/notifications/seed"

export const dynamic = "force-dynamic"
export const maxDuration = 60

const VALID_TYPES = ["daily", "weekly", "monthly", "custom"]
const VALID_FORMATS = ["pdf", "xlsx", "csv", "json"]
const VALID_CHANNELS = ["email", "sms", "whatsapp", "push", "webhook", "in_app"]

export async function GET(req: NextRequest) {
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
    await seedNotificationsIfEmpty()

    const reports = await db.scheduledReport.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { executions: true } },
      },
    })

    const data = reports.map((r) => ({
      ...r,
      channels: JSON.parse(r.channels) as string[],
      recipients: JSON.parse(r.recipients) as string[],
      filters: JSON.parse(r.filters) as Record<string, unknown>,
      executionsCount: r._count.executions,
    }))

    const res = sendSuccess(data)
    await logApiCall({
      req,
      statusCode: 200,
      responseMs: timer(),
      userId: auth.user.id,
      apiKeyId: auth.apiKeyId,
    })
    return res
  } catch (err) {
    console.error("[reports] GET error:", err)
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

export async function POST(req: NextRequest) {
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
    const body = await req.json().catch(() => ({}))

    if (!body.name) {
      const err = sendError("Le champ 'name' est requis", 422, "VALIDATION_ERROR")
      await logApiCall({
        req,
        statusCode: 422,
        responseMs: timer(),
        userId: auth.user.id,
        error: "Missing name",
      })
      return err
    }
    if (!body.type || !VALID_TYPES.includes(body.type)) {
      const err = sendError(
        `Type invalide. Valeurs supportées: ${VALID_TYPES.join(", ")}`,
        422,
        "VALIDATION_ERROR"
      )
      await logApiCall({
        req,
        statusCode: 422,
        responseMs: timer(),
        userId: auth.user.id,
        error: "Invalid type",
      })
      return err
    }
    if (!body.schedule || typeof body.schedule !== "string") {
      const err = sendError(
        "Le champ 'schedule' est requis (ex: 'daily:08:00', 'weekly:mon:08:00', 'monthly:01:08:00')",
        422,
        "VALIDATION_ERROR"
      )
      await logApiCall({
        req,
        statusCode: 422,
        responseMs: timer(),
        userId: auth.user.id,
        error: "Missing schedule",
      })
      return err
    }

    const format = body.format && VALID_FORMATS.includes(body.format) ? body.format : "pdf"

    let channels: string[] = ["email"]
    if (Array.isArray(body.channels)) {
      channels = body.channels.filter((c: string) => VALID_CHANNELS.includes(c))
      if (channels.length === 0) channels = ["email"]
    }

    const recipients = Array.isArray(body.recipients) ? body.recipients : []
    const filters = body.filters && typeof body.filters === "object" ? body.filters : {}

    const created = await createScheduledReport({
      name: body.name.trim(),
      description: body.description?.trim(),
      type: body.type,
      schedule: body.schedule.trim(),
      channels: channels as never,
      recipients,
      filters,
      format,
      isActive: body.isActive !== false,
    })

    const res = sendSuccess(
      {
        ...created,
        channels: JSON.parse(created.channels) as string[],
        recipients: JSON.parse(created.recipients) as string[],
        filters: JSON.parse(created.filters) as Record<string, unknown>,
      },
      { status: 201, message: "Scheduled report created" }
    )
    await logApiCall({
      req,
      statusCode: 201,
      responseMs: timer(),
      userId: auth.user.id,
      apiKeyId: auth.apiKeyId,
    })
    return res
  } catch (err) {
    console.error("[reports] POST error:", err)
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
