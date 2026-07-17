/**
 * PUT    /api/v1/webhooks/[id]  — Update a webhook
 * DELETE /api/v1/webhooks/[id]  — Delete a webhook
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

    const existing = await db.webhook.findUnique({ where: { id } })
    if (!existing) {
      const err = sendError("Webhook not found", 404, "NOT_FOUND")
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
    if (typeof body.url === "string") {
      try {
        new URL(body.url)
        data.url = body.url.trim()
      } catch {
        const err = sendError("URL invalide", 422, "VALIDATION_ERROR")
        await logApiCall({
          req,
          statusCode: 422,
          responseMs: timer(),
          userId: auth.user.id,
          error: "Invalid URL",
        })
        return err
      }
    }
    if (Array.isArray(body.events)) {
      if (body.events.length === 0) {
        const err = sendError("'events' doit être un tableau non vide", 422, "VALIDATION_ERROR")
        await logApiCall({
          req,
          statusCode: 422,
          responseMs: timer(),
          userId: auth.user.id,
          error: "Empty events",
        })
        return err
      }
      data.events = JSON.stringify(body.events)
    }
    if (typeof body.isActive === "boolean") data.isActive = body.isActive
    if (typeof body.secret === "string") data.secret = body.secret

    const updated = await db.webhook.update({
      where: { id },
      data,
    })

    const res = sendSuccess(
      {
        id: updated.id,
        url: updated.url,
        events: JSON.parse(updated.events) as string[],
        secret: updated.secret ? `${updated.secret.slice(0, 4)}••••` : null,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt,
      },
      { message: "Webhook updated" }
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
    console.error("[webhooks] PUT error:", err)
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
    const existing = await db.webhook.findUnique({ where: { id } })
    if (!existing) {
      const err = sendError("Webhook not found", 404, "NOT_FOUND")
      await logApiCall({
        req,
        statusCode: 404,
        responseMs: timer(),
        userId: auth.user.id,
        error: "Not found",
      })
      return err
    }

    await db.webhook.delete({ where: { id } })

    const res = sendSuccess({ id }, { message: "Webhook deleted" })
    await logApiCall({
      req,
      statusCode: 200,
      responseMs: timer(),
      userId: auth.user.id,
      apiKeyId: auth.apiKeyId,
    })
    return res
  } catch (err) {
    console.error("[webhooks] DELETE error:", err)
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
