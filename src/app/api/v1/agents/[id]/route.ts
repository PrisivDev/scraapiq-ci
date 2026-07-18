/**
 * GET /api/v1/agents/[id]
 * Récupère l'état d'un pipeline en cours
 *
 * Auth required — pipelines are org-scoped (config.organizationId). A non-OWNER
 * user can only view pipelines started in their own org.
 */
import { NextRequest } from "next/server"
import { jsonResponse, errorResponse } from "@/lib/auth/helpers"
import { requireApiAuth } from "@/lib/api/auth-middleware"

interface StoredPipeline {
  state: {
    jobId?: string
    config?: { organizationId?: string | null }
    [k: string]: unknown
  }
}

const globalForAgents = globalThis as unknown as { __agentPipelines?: Map<string, unknown> }
const pipelines = globalForAgents.__agentPipelines ?? new Map()

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuth(req)
  if (!auth.user) {
    return errorResponse(auth.error || "Unauthorized", auth.status)
  }

  const { id } = await params
  const entry = pipelines.get(id) as StoredPipeline | undefined

  if (!entry) {
    return errorResponse("Pipeline introuvable", 404)
  }

  // Multi-tenant: non-OWNER can only view pipelines started in their own org.
  // OWNER sees all pipelines.
  const pipelineOrgId = entry.state?.config?.organizationId ?? null
  if (auth.user.role !== "OWNER") {
    if (!pipelineOrgId || pipelineOrgId !== auth.user.orgId) {
      return errorResponse("Pipeline introuvable", 404)
    }
  }

  return jsonResponse(entry.state)
}
