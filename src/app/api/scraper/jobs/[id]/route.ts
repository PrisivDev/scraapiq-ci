/**
 * GET /api/scraper/jobs/[id]
 *   ?format=json (défaut) → état + résultats
 *   ?format=csv           → export CSV des lieux extraits
 *
 * DELETE /api/scraper/jobs/[id]
 *   Annule un job en cours
 */
import { NextRequest } from "next/server"
import { getJob, serializeJob, cancelJob, deleteJob, placesToCSV } from "@/lib/scraper/job-store"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const job = getJob(id)

  if (!job) {
    return errorResponse("Job introuvable", 404)
  }

  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format")

  // Export CSV
  if (format === "csv") {
    if (!job.result || job.result.places.length === 0) {
      return errorResponse("Aucun résultat à exporter", 400)
    }
    const csv = placesToCSV(job.result.places)
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="scrapiq_${id}.csv"`,
      },
    })
  }

  // JSON par défaut
  return jsonResponse(serializeJob(job))
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const job = getJob(id)

  if (!job) {
    return errorResponse("Job introuvable", 404)
  }

  const { searchParams } = new URL(req.url)
  const purge = searchParams.get("purge") === "true"

  if (purge) {
    deleteJob(id)
    return jsonResponse({ success: true, message: "Job supprimé" })
  }

  const cancelled = cancelJob(id)
  if (!cancelled) {
    return errorResponse("Impossible d'annuler le job (déjà terminé?)", 400)
  }

  return jsonResponse({ success: true, message: "Job annulé" })
}
