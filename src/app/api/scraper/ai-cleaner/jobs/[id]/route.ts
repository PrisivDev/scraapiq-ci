/**
 * GET /api/scraper/ai-cleaner/jobs/[id]
 *   ?format=json (défaut) → état + entités nettoyées + rapport
 *   ?format=csv           → export CSV
 *
 * DELETE /api/scraper/ai-cleaner/jobs/[id]
 */
import { NextRequest } from "next/server"
import {
  getAICleanerJob,
  serializeAICleanerJob,
  cancelAICleanerJob,
  deleteAICleanerJob,
} from "@/lib/scraper/ai-cleaner-job-store"
import { placesToCSV } from "@/lib/scraper/job-store"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const job = getAICleanerJob(id)

  if (!job) {
    return errorResponse("Job IA introuvable", 404)
  }

  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format")

  if (format === "csv") {
    if (!job.cleanedEntities || job.cleanedEntities.length === 0) {
      return errorResponse("Aucune entité nettoyée à exporter", 400)
    }
    const csv = placesToCSV(job.cleanedEntities)
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="scraapiq_ai_${id}.csv"`,
      },
    })
  }

  return jsonResponse(serializeAICleanerJob(job))
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const job = getAICleanerJob(id)

  if (!job) {
    return errorResponse("Job IA introuvable", 404)
  }

  const { searchParams } = new URL(req.url)
  const purge = searchParams.get("purge") === "true"

  if (purge) {
    deleteAICleanerJob(id)
    return jsonResponse({ success: true, message: "Job IA supprimé" })
  }

  const cancelled = cancelAICleanerJob(id)
  if (!cancelled) {
    return errorResponse("Impossible d'annuler le job (déjà terminé?)", 400)
  }

  return jsonResponse({ success: true, message: "Job IA annulé" })
}
