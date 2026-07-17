/**
 * GET /api/v1/reports/[id]/executions — List executions for a scheduled report
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

export async function GET(
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

    const report = await db.scheduledReport.findUnique({ where: { id } })
    if (!report) {
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

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 100)

    const executions = await db.reportExecution.findMany({
      where: { reportId: id },
      orderBy: { createdAt: "desc" },
      take: limit,
      // On ne renvoie pas le dataUrl (potentiellement gros) dans la liste
      // Le téléchargement direct se fera via /api/v1/reports/[id]/executions/[execId]
    })

    const data = executions.map((e) => ({
      id: e.id,
      status: e.status,
      format: e.format,
      fileSizeBytes: e.fileSizeBytes,
      filename: e.filename,
      hasData: !!e.dataUrl,
      error: e.error,
      startedAt: e.startedAt,
      completedAt: e.completedAt,
      createdAt: e.createdAt,
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
    console.error("[reports:executions] error:", err)
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
