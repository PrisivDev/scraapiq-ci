/**
 * POST /api/export
 * Lance un job d'export
 *
 * Body: {
 *   format: "xlsx" | "csv" | "pdf" | "json" | "zip",
 *   columns?: ExportColumn[],           // défaut: DEFAULT_COLUMNS (toutes sélectionnées)
 *   filters?: ExportFilters,
 *   selectedIds?: string[],             // sélection personnalisée
 *   includeGps?: boolean,
 *   includeSocials?: boolean,
 *   includeSources?: boolean,
 *   filename?: string,
 *   zipFormats?: ExportFormat[],        // pour ZIP
 * }
 *
 * GET /api/export
 * Liste tous les jobs d'export
 */
import { NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { startExportJob, listExportJobs } from "@/lib/export/export-store"
import { DEFAULT_COLUMNS } from "@/lib/export/types"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      format,
      columns,
      filters,
      selectedIds,
      includeGps,
      includeSocials,
      includeSources,
      filename,
      zipFormats,
    } = body

    if (!format || !["xlsx", "csv", "pdf", "json", "zip"].includes(format)) {
      return errorResponse("Format requis (xlsx, csv, pdf, json, zip)", 400)
    }

    const jobId = `export-${randomUUID().slice(0, 8)}`
    const config = {
      format,
      columns: columns || DEFAULT_COLUMNS,
      filters,
      selectedIds,
      includeGps: includeGps || false,
      includeSocials: includeSocials || false,
      includeSources: includeSources || false,
      filename: filename || `export_entreprises_${new Date().toISOString().slice(0, 10)}`,
      zipFormats: zipFormats || ["xlsx", "csv", "json"],
    }

    const job = startExportJob(jobId, config)

    return jsonResponse({
      jobId: job.id,
      status: job.status,
      format,
      filename: job.filename,
      message: `Export ${format.toUpperCase()} lancé. Utilisez GET /api/export/${job.id} pour suivre et télécharger.`,
    }, { status: 202 })
  } catch (err) {
    console.error("[export] POST error:", err)
    return errorResponse("Erreur lors du lancement de l'export", 500)
  }
}

export async function GET() {
  const jobs = listExportJobs()
  return jsonResponse({
    jobs: jobs.map((j) => ({
      id: j.id,
      format: j.config.format,
      filename: j.filename,
      status: j.status,
      progress: j.progress,
      totalRows: j.totalRows,
      fileSizeBytes: j.fileSizeBytes,
      createdAt: j.createdAt,
      completedAt: j.completedAt,
    })),
    total: jobs.length,
  })
}
