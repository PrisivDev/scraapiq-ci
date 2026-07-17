/**
 * GET  /api/v1/notifications       — List notifications (paginated, filterable)
 * POST /api/v1/notifications       — Send a notification manually
 *
 * Query params (GET):
 *   page, limit, channel, status, priority, q (search)
 *
 * Body (POST):
 *   { channel, title, body, recipient?, priority?, payload?, webhookUrl? }
 */
import { NextRequest } from "next/server"
import {
  sendSuccess,
  sendError,
  parsePagination,
  buildPaginationMeta,
  logApiCall,
  startTimer,
} from "@/lib/api/helpers"
import { requireApiAuth } from "@/lib/api/auth-middleware"
import {
  sendNotification,
  listNotifications,
} from "@/lib/notifications/engine"
import { seedNotificationsIfEmpty } from "@/lib/notifications/seed"

export const dynamic = "force-dynamic"
export const maxDuration = 60

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
    // Seed defaults if first call
    await seedNotificationsIfEmpty()

    const url = new URL(req.url)
    const { page, limit } = parsePagination(req)
    const channel = url.searchParams.get("channel") || undefined
    const status = url.searchParams.get("status") || undefined
    const priority = url.searchParams.get("priority") || undefined
    const q = url.searchParams.get("q") || undefined

    const result = await listNotifications({
      page,
      limit,
      channel,
      status,
      priority,
      search: q,
    })

    const meta = buildPaginationMeta(page, limit, result.total)
    const res = sendSuccess(result.items, { meta })
    await logApiCall({
      req,
      statusCode: 200,
      responseMs: timer(),
      userId: auth.user.id,
      apiKeyId: auth.apiKeyId,
    })
    return res
  } catch (err) {
    console.error("[notifications] GET error:", err)
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

    if (!body.channel) {
      const err = sendError("Le champ 'channel' est requis", 422, "VALIDATION_ERROR")
      await logApiCall({
        req,
        statusCode: 422,
        responseMs: timer(),
        userId: auth.user.id,
        error: "Missing channel",
      })
      return err
    }
    if (!body.title) {
      const err = sendError("Le champ 'title' est requis", 422, "VALIDATION_ERROR")
      await logApiCall({
        req,
        statusCode: 422,
        responseMs: timer(),
        userId: auth.user.id,
        error: "Missing title",
      })
      return err
    }

    const { notification, result } = await sendNotification({
      userId: body.userId || auth.user.id,
      channel: body.channel,
      title: body.title,
      body: body.body || "",
      recipient: body.recipient,
      senderId: auth.user.id,
      priority: body.priority,
      payload: body.payload,
      webhookUrl: body.webhookUrl,
      webhookSecret: body.webhookSecret,
      eventName: body.eventName,
    })

    const status = result.success ? 201 : 200
    const res = sendSuccess(
      {
        notification,
        result,
      },
      {
        status,
        message: result.success
          ? "Notification envoyée"
          : "Notification enregistrée mais échec d'envoi",
      }
    )
    await logApiCall({
      req,
      statusCode: status,
      responseMs: timer(),
      userId: auth.user.id,
      apiKeyId: auth.apiKeyId,
    })
    return res
  } catch (err) {
    console.error("[notifications] POST error:", err)
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
