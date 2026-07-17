/**
 * GET  /api/v1/alerts   — List alert rules
 * POST /api/v1/alerts   — Create an alert rule
 *
 * Body (POST):
 *   { name, description?, metric, condition, threshold, channels?, cooldownMin?, isActive? }
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
import { seedNotificationsIfEmpty } from "@/lib/notifications/seed"

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

    const rules = await db.alertRule.findMany({
      orderBy: { createdAt: "desc" },
    })

    const data = rules.map((r) => ({
      ...r,
      channels: JSON.parse(r.channels) as string[],
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
    console.error("[alerts] GET error:", err)
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

    // Validation
    if (!body.name) {
      return fail(req, auth, timer, "Le champ 'name' est requis", 422)
    }
    if (!body.metric || !VALID_METRICS.includes(body.metric)) {
      return fail(
        req,
        auth,
        timer,
        `Métrique invalide. Valeurs supportées: ${VALID_METRICS.join(", ")}`,
        422
      )
    }
    if (!body.condition || !VALID_CONDITIONS.includes(body.condition)) {
      return fail(
        req,
        auth,
        timer,
        `Condition invalide. Valeurs supportées: ${VALID_CONDITIONS.join(", ")}`,
        422
      )
    }
    if (typeof body.threshold !== "number") {
      return fail(req, auth, timer, "Le champ 'threshold' doit être un nombre", 422)
    }

    let channels: string[] = ["in_app"]
    if (Array.isArray(body.channels)) {
      channels = body.channels.filter((c: string) => VALID_CHANNELS.includes(c))
      if (channels.length === 0) channels = ["in_app"]
    }

    const created = await db.alertRule.create({
      data: {
        name: body.name.trim(),
        description: body.description?.trim() || null,
        metric: body.metric,
        condition: body.condition,
        threshold: body.threshold,
        channels: JSON.stringify(channels),
        cooldownMin: typeof body.cooldownMin === "number" ? body.cooldownMin : 30,
        isActive: body.isActive !== false,
      },
    })

    const res = sendSuccess(
      { ...created, channels: JSON.parse(created.channels) as string[] },
      { status: 201, message: "Alert rule created" }
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
    console.error("[alerts] POST error:", err)
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

async function fail(
  req: NextRequest,
  auth: { user: { id: string } | null },
  timer: () => number,
  message: string,
  status: number
) {
  const err = sendError(message, status, "VALIDATION_ERROR")
  await logApiCall({
    req,
    statusCode: status,
    responseMs: timer(),
    userId: auth.user?.id,
    error: message,
  })
  return err
}
