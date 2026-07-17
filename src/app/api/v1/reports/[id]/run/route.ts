/**
 * POST /api/v1/reports/[id]/run — Manually trigger report generation
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
import { generateReport } from "@/lib/notifications/reports"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(
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

    const result = await generateReport(report)

    // Ne pas renvoyer le dataUrl complet dans la réponse (potentiellement gros)
    const executionSummary = {
      id: result.execution.id,
      status: result.execution.status,
      format: result.execution.format,
      fileSizeBytes: result.execution.fileSizeBytes,
      filename: result.execution.filename,
      error: result.execution.error,
      startedAt: result.execution.startedAt,
      completedAt: result.execution.completedAt,
      hasData: !!result.execution.dataUrl,
    }

    const res = sendSuccess(
      {
        execution: executionSummary,
        success: result.success,
        error: result.error,
      },
      {
        message: result.success
          ? "Rapport généré avec succès"
          : "Échec de la génération du rapport",
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
    console.error("[reports:run] error:", err)
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
