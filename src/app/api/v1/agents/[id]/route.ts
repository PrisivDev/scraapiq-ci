/**
 * GET /api/v1/agents/[id]
 * Récupère l'état d'un pipeline en cours
 */
import { NextRequest } from "next/server"
import { jsonResponse, errorResponse } from "@/lib/auth/helpers"

const globalForAgents = globalThis as unknown as { __agentPipelines?: Map<string, unknown> }
const pipelines = globalForAgents.__agentPipelines ?? new Map()

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const entry = pipelines.get(id) as { state: Record<string, unknown> } | undefined

  if (!entry) {
    return errorResponse("Pipeline introuvable", 404)
  }

  return jsonResponse(entry.state)
}
