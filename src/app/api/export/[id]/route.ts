/**
 * GET /api/export/[id]
 *   ?download=true  → télécharge le fichier (binaire)
 *   ?format=base64  → retourne data URL
 *   (défaut)        → retourne l'état du job
 *
 * DELETE /api/export/[id]
 *   Supprime un job
 */
import { NextRequest } from "next/server"
import { getExportJob, deleteExportJob } from "@/lib/export/export-store"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const job = getExportJob(id)

  if (!job) {
    return errorResponse("Job d'export introuvable", 404)
  }

  const { searchParams } = new URL(req.url)
  const download = searchParams.get("download") === "true"
  const format = searchParams.get("format")

  // Téléchargement direct (binaire)
  if (download && job.status === "completed" && job.dataUrl) {
    const base64Data = job.dataUrl.split(",")[1]
    const buffer = Buffer.from(base64Data, "base64")

    return new Response(buffer, {
      headers: {
        "Content-Type": job.mimeType,
        "Content-Disposition": `attachment; filename="${job.filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    })
  }

  // Format base64 (pour API)
  if (format === "base64" && job.status === "completed" && job.dataUrl) {
    return jsonResponse({
      jobId: job.id,
      status: job.status,
      filename: job.filename,
      mimeType: job.mimeType,
      fileSizeBytes: job.fileSizeBytes,
      dataUrl: job.dataUrl,
    })
  }

  // État du job (défaut)
  return jsonResponse({
    id: job.id,
    status: job.status,
    progress: job.progress,
    totalRows: job.totalRows,
    processedRows: job.processedRows,
    fileSizeBytes: job.fileSizeBytes,
    filename: job.filename,
    mimeType: job.mimeType,
    errors: job.errors,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    downloadUrl: job.status === "completed" ? `/api/export/${job.id}?download=true` : undefined,
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const deleted = deleteExportJob(id)
  if (!deleted) {
    return errorResponse("Job introuvable", 404)
  }
  return jsonResponse({ success: true, message: "Job supprimé" })
}
