/**
 * GET /api/scraper/business/jobs/[id]
 *   ?format=json (défaut) → état + résultats
 *   ?format=csv           → export CSV
 *
 * DELETE /api/scraper/business/jobs/[id]
 */
import { NextRequest } from "next/server"
import {
  getBusinessJob,
  serializeBusinessJob,
  cancelBusinessJob,
  deleteBusinessJob,
} from "@/lib/scraper/business-job-store"
import { placesToCSV } from "@/lib/scraper/job-store"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const job = getBusinessJob(id)

  if (!job) {
    return errorResponse("Job business introuvable", 404)
  }

  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format")

  if (format === "csv") {
    if (!job.result || job.result.places.length === 0) {
      return errorResponse("Aucun résultat à exporter", 400)
    }
    const csv = placesToCSV(job.result.places)
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="scraapiq_biz_${id}.csv"`,
      },
    })
  }

  const serialized = serializeBusinessJob(job)
  if (serialized.query.cookies) {
    serialized.query.cookies = "***"
  }

  return jsonResponse(serialized)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const job = getBusinessJob(id)

  if (!job) {
    return errorResponse("Job business introuvable", 404)
  }

  const { searchParams } = new URL(req.url)
  const purge = searchParams.get("purge") === "true"

  if (purge) {
    deleteBusinessJob(id)
    return jsonResponse({ success: true, message: "Job business supprimé" })
  }

  const cancelled = cancelBusinessJob(id)
  if (!cancelled) {
    return errorResponse("Impossible d'annuler le job (déjà terminé?)", 400)
  }

  return jsonResponse({ success: true, message: "Job business annulé" })
}
