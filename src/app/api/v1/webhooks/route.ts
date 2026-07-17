/**
 * GET  /api/v1/webhooks  — List webhooks
 * POST /api/v1/webhooks  — Create a webhook
 *
 * Body: { url, events: string[], isActive?, secret? }
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
import { randomUUID } from "crypto"

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
    const webhooks = await db.webhook.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { deliveries: true } },
      },
    })

    const data = webhooks.map((w) => ({
      id: w.id,
      url: w.url,
      events: JSON.parse(w.events) as string[],
      secret: w.secret ? `${w.secret.slice(0, 4)}••••` : null,
      isActive: w.isActive,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
      deliveriesCount: w._count.deliveries,
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
    console.error("[webhooks] GET error:", err)
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

    if (!body.url || typeof body.url !== "string") {
      const err = sendError("Le champ 'url' est requis", 422, "VALIDATION_ERROR")
      await logApiCall({
        req,
        statusCode: 422,
        responseMs: timer(),
        userId: auth.user.id,
        error: "Missing url",
      })
      return err
    }

    if (!Array.isArray(body.events) || body.events.length === 0) {
      const err = sendError("Le champ 'events' doit être un tableau non vide", 422, "VALIDATION_ERROR")
      await logApiCall({
        req,
        statusCode: 422,
        responseMs: timer(),
        userId: auth.user.id,
        error: "Missing events",
      })
      return err
    }

    // Validate URL
    try {
      new URL(body.url)
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

    const created = await db.webhook.create({
      data: {
        url: body.url.trim(),
        events: JSON.stringify(body.events),
        secret: body.secret || randomUUID(),
        isActive: body.isActive !== false,
      },
    })

    const res = sendSuccess(
      {
        id: created.id,
        url: created.url,
        events: JSON.parse(created.events) as string[],
        secret: created.secret,
        isActive: created.isActive,
        createdAt: created.createdAt,
      },
      { message: "Webhook created", status: 201 }
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
    console.error("[webhooks] POST error:", err)
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
