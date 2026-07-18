/**
 * POST /api/v1/agents
 * Lance le pipeline multi-agents
 *
 * Body: { query, city?, commune?, maxResults?, skipAgents? }
 * Returns: { jobId, status, pipeline }
 *
 * Multi-tenant: orgId/userId are captured from the authenticated caller and
 * threaded into PipelineConfig. The orchestrator currently produces in-memory
 * results, but when it eventually persists Company rows, they'll be scoped to
 * the caller's org.
 *
 * GET /api/v1/agents
 * Liste les définitions des 10 agents
 */
import { NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { AGENT_DEFINITIONS, PipelineOrchestrator, type PipelineConfig, type AgentId, type PipelineState } from "@/lib/ai-agents/orchestrator"
import "@/lib/ai-agents/agents" // enregistre les processors
import { jsonResponse, errorResponse } from "@/lib/auth/helpers"
import { requireApiAuth } from "@/lib/api/auth-middleware"

// Store global pour les pipelines
const globalForAgents = globalThis as unknown as { __agentPipelines?: Map<string, { state: PipelineState; orchestrator: PipelineOrchestrator }> }
const pipelines = globalForAgents.__agentPipelines ?? new Map<string, { state: PipelineState; orchestrator: PipelineOrchestrator }>()
if (process.env.NODE_ENV !== "production") globalForAgents.__agentPipelines = pipelines

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(req: NextRequest) {
  // Auth required — even the agent definitions list should be gated.
  const auth = await requireApiAuth(req)
  if (!auth.user) {
    return errorResponse(auth.error || "Unauthorized", auth.status)
  }
  return jsonResponse({
    agents: AGENT_DEFINITIONS,
    total: AGENT_DEFINITIONS.length,
  })
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiAuth(req)
    if (!auth.user) {
      return errorResponse(auth.error || "Unauthorized", auth.status)
    }

    const body = await req.json()
    const { query, city, commune, maxResults, skipAgents } = body

    if (!query || typeof query !== "string") {
      return errorResponse("Requête (query) requise", 400)
    }

    const jobId = `agents-${randomUUID().slice(0, 8)}`
    const config: PipelineConfig = {
      query: query.trim(),
      city: city?.trim() || undefined,
      commune: commune?.trim() || undefined,
      maxResults: maxResults || 50,
      skipAgents: skipAgents as AgentId[] | undefined,
      enableLLM: true,
      // Multi-tenant: thread caller's org/user for future Company persistence.
      organizationId: auth.user.orgId,
      userId: auth.user.id,
    }

    const orchestrator = new PipelineOrchestrator(jobId, config)

    // Enregistre les events en temps réel
    pipelines.set(jobId, { state: orchestrator.getState(), orchestrator })

    // Lance le pipeline asynchrone
    orchestrator.on((event) => {
      const entry = pipelines.get(jobId)
      if (entry) entry.state = orchestrator.getState()
    })

    orchestrator.run().then((finalState) => {
      const entry = pipelines.get(jobId)
      if (entry) entry.state = finalState
    }).catch(() => {})

    return jsonResponse({
      jobId,
      status: "running",
      agents: AGENT_DEFINITIONS.length,
      message: `Pipeline multi-agents lancé : ${AGENT_DEFINITIONS.length} agents spécialisés`,
    }, { status: 202 })
  } catch (err) {
    console.error("[agents] error:", err)
    return errorResponse("Erreur lors du lancement du pipeline", 500)
  }
}
