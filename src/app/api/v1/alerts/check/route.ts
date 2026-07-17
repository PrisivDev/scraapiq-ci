/**
 * POST /api/v1/alerts/check — Manually evaluate all alert rules
 *
 * Returns the evaluation results and triggers notifications for any rule that
 * meets its condition (and is not in cooldown).
 */
import { NextRequest } from "next/server"
import {
  sendSuccess,
  sendError,
  logApiCall,
  startTimer,
} from "@/lib/api/helpers"
import { requireApiAuth } from "@/lib/api/auth-middleware"
import { checkAllAlerts } from "@/lib/notifications/alerts"
import { seedNotificationsIfEmpty } from "@/lib/notifications/seed"

export const dynamic = "force-dynamic"
export const maxDuration = 60

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
    await seedNotificationsIfEmpty()
    const result = await checkAllAlerts()

    const res = sendSuccess(
      {
        evaluated: result.evaluated,
        triggered: result.triggered,
        skipped: result.skipped,
        results: result.results,
      },
      {
        message: `${result.triggered} alerte(s) déclenchée(s) sur ${result.evaluated} règle(s) évaluée(s)`,
      }
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
    console.error("[alerts:check] error:", err)
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
