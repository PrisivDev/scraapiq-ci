/**
 * POST /api/export/bulk
 * Export massif — génère plusieurs formats en une fois (dans un ZIP)
 *
 * Body: {
 *   formats: ExportFormat[],   // ["xlsx", "csv", "json"]
 *   columns?: ExportColumn[],
 *   filters?: ExportFilters,
 *   filename?: string,
 * }
 */
import { NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { startExportJob } from "@/lib/export/export-store"
import { DEFAULT_COLUMNS } from "@/lib/export/types"
import { errorResponse, jsonResponse } from "@/lib/auth/helpers"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { formats, columns, filters, filename } = body

    if (!formats || !Array.isArray(formats) || formats.length === 0) {
      return errorResponse("Formats requis (array)", 400)
    }

    const jobId = `export-bulk-${randomUUID().slice(0, 8)}`
    const config = {
      format: "zip" as const,
      columns: columns || DEFAULT_COLUMNS,
      filters,
      filename: filename || `export_massif_${new Date().toISOString().slice(0, 10)}`,
      zipFormats: formats,
    }

    const job = startExportJob(jobId, config)

    return jsonResponse({
      jobId: job.id,
      status: job.status,
      formats,
      filename: job.filename,
      message: `Export massif lancé (${formats.length} formats dans un ZIP).`,
    }, { status: 202 })
  } catch (err) {
    console.error("[export/bulk] error:", err)
    return errorResponse("Erreur lors de l'export massif", 500)
  }
}
