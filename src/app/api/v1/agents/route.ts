/**
 * POST /api/v1/agents
 * Lance le pipeline multi-agents
 *
 * Body: { query, city?, commune?, maxResults?, skipAgents? }
 * Returns: { jobId, status, pipeline }
 *
 * GET /api/v1/agents
 * Liste les définitions des 10 agents
 */
import { NextRequest } from "next/server"
import { randomUUID } from "crypto"
import { AGENT_DEFINITIONS, PipelineOrchestrator, type PipelineConfig, type AgentId, type PipelineState } from "@/lib/ai-agents/orchestrator"
import "@/lib/ai-agents/agents" // enregistre les processors
import { jsonResponse, errorResponse } from "@/lib/auth/helpers"

// Store global pour les pipelines
const globalForAgents = globalThis as unknown as { __agentPipelines?: Map<string, PipelineState> }
const pipelines = globalForAgents.__agentPipelines ?? new Map<string, { state: PipelineState; orchestrator: PipelineOrchestrator }>()
if (process.env.NODE_ENV !== "production") globalForAgents.__agentPipelines = pipelines

export async function GET() {
  return jsonResponse({
    agents: AGENT_DEFINITIONS,
    total: AGENT_DEFINITIONS.length,
  })
}

export async function POST(req: NextRequest) {
  try {
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
