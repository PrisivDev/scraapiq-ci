/**
 * PUT /api/v1/notifications/[id]/read — Mark a notification as read
 */
import { NextRequest } from "next/server"
import {
  sendSuccess,
  sendError,
  logApiCall,
  startTimer,
} from "@/lib/api/helpers"
import { requireApiAuth } from "@/lib/api/auth-middleware"
import { markAsRead } from "@/lib/notifications/engine"

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
    const result = await markAsRead(id, auth.user.id)

    if (!result.success) {
      const status = result.error === "Notification not found" ? 404 : 403
      const err = sendError(
        result.error || "Failed to mark as read",
        status,
        status === 404 ? "NOT_FOUND" : "FORBIDDEN"
      )
      await logApiCall({
        req,
        statusCode: status,
        responseMs: timer(),
        userId: auth.user.id,
        error: result.error,
      })
      return err
    }

    const res = sendSuccess(
      { id, status: "read" },
      { message: "Notification marquée comme lue" }
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
    console.error("[notifications:read] error:", err)
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
