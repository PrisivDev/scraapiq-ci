/**
 * GET /api/export/stats
 * Statistiques d'export
 */
import { getExportStats } from "@/lib/export/export-store"
import { jsonResponse } from "@/lib/auth/helpers"

export async function GET() {
  return jsonResponse(getExportStats())
}
