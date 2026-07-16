/**
 * GET /api/scraper/facebook/jobs/[id]
 *   ?format=json (défaut) → état + résultats
 *   ?format=csv           → export CSV des lieux extraits
 *
 * DELETE /api/scraper/facebook/jobs/[id]
 *   Annule un job en cours
 */
import { NextRequest } from "next/server"
import {
  getFacebookJob,
  serializeFacebookJob,
  cancelFacebookJob,
  deleteFacebookJob,
} from "@/lib/scraper/facebook-job-store"
import { placesToCSV } from "@/lib/scraper/job-store"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const job = getFacebookJob(id)

  if (!job) {
    return errorResponse("Job Facebook introuvable", 404)
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
        "Content-Disposition": `attachment; filename="scraapiq_fb_${id}.csv"`,
      },
    })
  }

  const serialized = serializeFacebookJob(job)
  // Masque les cookies dans la query renvoyée
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
  const job = getFacebookJob(id)

  if (!job) {
    return errorResponse("Job Facebook introuvable", 404)
  }

  const { searchParams } = new URL(req.url)
  const purge = searchParams.get("purge") === "true"

  if (purge) {
    deleteFacebookJob(id)
    return jsonResponse({ success: true, message: "Job Facebook supprimé" })
  }

  const cancelled = cancelFacebookJob(id)
  if (!cancelled) {
    return errorResponse("Impossible d'annuler le job (déjà terminé?)", 400)
  }

  return jsonResponse({ success: true, message: "Job Facebook annulé" })
}
