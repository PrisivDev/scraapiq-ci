/**
 * GET /api/scraper/jobs/[id]
 *   ?format=json (défaut) → état + résultats (DB + merge live in-memory)
 *   ?format=csv           → export CSV des lieux extraits (depuis in-memory)
 *
 * DELETE /api/scraper/jobs/[id]
 *   Annule un job en cours (in-memory + DB) ou marque comme annulé en DB
 *   si le serveur a redémarré.
 *
 * Multi-tenant :
 *   - OWNER → peut voir/annuler n'importe quel job
 *   - autres rôles → ne peuvent voir/annuler que les jobs de leur org
 */
import { NextRequest } from "next/server"
import {
  getJob, getJobFromDB, cancelJob, cancelJobInDB, deleteJob, placesToCSV,
} from "@/lib/scraper/job-store"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"
import { requireApiAuth } from "@/lib/api/auth-middleware"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth + tenant scope
  const auth = await requireApiAuth(req)
  if (!auth.user) {
    return errorResponse(auth.error || "Unauthorized", auth.status)
  }

  // Read from DB (history, survives restarts)
  const record = await getJobFromDB(id)
  if (!record) {
    return errorResponse("Job introuvable", 404)
  }

  // Multi-tenant: non-OWNER ne peut voir que les jobs de son org
  if (auth.user.role !== "OWNER") {
    const jobOrg = record.query.organizationId
    if (jobOrg !== auth.user.orgId) {
      // 404 (pas de leak d'existence) au lieu de 403
      return errorResponse("Job introuvable", 404)
    }
  }

  const { searchParams } = new URL(req.url)
  const format = searchParams.get("format")

  // Export CSV — depuis l'in-memory live result
  if (format === "csv") {
    const live = getJob(id)
    if (!live?.result || live.result.places.length === 0) {
      return errorResponse("Aucun résultat à exporter (le serveur a peut-être redémarré)", 400)
    }
    const csv = placesToCSV(live.result.places)
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="scrapiq_${id}.csv"`,
      },
    })
  }

  // JSON par défaut — fusion DB + live in-memory
  return jsonResponse(record)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // Auth + tenant scope
  const auth = await requireApiAuth(req)
  if (!auth.user) {
    return errorResponse(auth.error || "Unauthorized", auth.status)
  }

  // Read from DB to check ownership
  const record = await getJobFromDB(id)
  if (!record) {
    return errorResponse("Job introuvable", 404)
  }

  // Multi-tenant: non-OWNER ne peut annuler que les jobs de son org
  if (auth.user.role !== "OWNER") {
    const jobOrg = record.query.organizationId
    if (jobOrg !== auth.user.orgId) {
      return errorResponse("Job introuvable", 404)
    }
  }

  const { searchParams } = new URL(req.url)
  const purge = searchParams.get("purge") === "true"

  if (purge) {
    // Purge : supprime l'in-memory (la DB conserve l'historique pour audit)
    deleteJob(id)
    return jsonResponse({ success: true, message: "Job supprimé de la mémoire (historique DB conservé)" })
  }

  // Cancel : tente d'abord l'in-memory (live), sinon marque en DB
  const cancelled = cancelJob(id)
  if (!cancelled) {
    // Le job n'est plus en mémoire (serveur redémarré ou déjà terminé).
    // Si la DB indique qu'il est encore "running" ou "queued", on le marque
    // comme "cancelled" en DB pour cohérence.
    if (record.status === "running" || record.status === "queued") {
      const dbCancelled = await cancelJobInDB(id)
      if (!dbCancelled) {
        return errorResponse("Impossible d'annuler le job", 400)
      }
      return jsonResponse({ success: true, message: "Job marqué comme annulé en DB (live state indisponible)" })
    }
    return errorResponse("Impossible d'annuler le job (déjà terminé?)", 400)
  }

  return jsonResponse({ success: true, message: "Job annulé" })
}
