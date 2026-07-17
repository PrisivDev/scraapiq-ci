/**
 * GET /api/scraper/website/jobs/[id]
 *   ?format=json (défaut) → état + résultats
 *   ?format=csv           → export CSV
 *
 * DELETE /api/scraper/website/jobs/[id]
 */
import { NextRequest } from "next/server"
import {
  getWebsiteJob,
  serializeWebsiteJob,
  cancelWebsiteJob,
  deleteWebsiteJob,
} from "@/lib/scraper/website-job-store"
import { placesToCSV } from "@/lib/scraper/job-store"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const job = getWebsiteJob(id)

  if (!job) {
    return errorResponse("Job website introuvable", 404)
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
        "Content-Disposition": `attachment; filename="scraapiq_ws_${id}.csv"`,
      },
    })
  }

  return jsonResponse(serializeWebsiteJob(job))
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const job = getWebsiteJob(id)

  if (!job) {
    return errorResponse("Job website introuvable", 404)
  }

  const { searchParams } = new URL(req.url)
  const purge = searchParams.get("purge") === "true"

  if (purge) {
    deleteWebsiteJob(id)
    return jsonResponse({ success: true, message: "Job website supprimé" })
  }

  const cancelled = cancelWebsiteJob(id)
  if (!cancelled) {
    return errorResponse("Impossible d'annuler le job (déjà terminé?)", 400)
  }

  return jsonResponse({ success: true, message: "Job website annulé" })
}
