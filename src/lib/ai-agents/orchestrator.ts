/**
 * Framework d'agents IA — Architecture multi-agents spécialisés
 *
 * 10 agents organisés en pipeline séquentiel + branches parallèles :
 *
 *  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
 *  │ Agent 1  │───▶│ Agent 2  │───▶│ Agent 3  │───▶│ Agent 4  │
 *  │ Sources  │    │ Scraping │    │Nettoyage │    │ Dédup    │
 *  └──────────┘    └──────────┘    └──────────┘    └──────────┘
 *                                                       │
 *  ┌──────────┐    ┌──────────┐    ┌──────────┐        ▼
 *  │ Agent 8  │◀───│ Agent 7  │◀───│ Agent 5  │    ┌──────────┐
 *  │Classif.  │    │Géocodage │    │Enrichiss.│◀───│ Agent 6  │
 *  └────┬─────┘    └──────────┘    └──────────┘    │Validation│
 *       │                                           └──────────┘
 *       ▼
 *  ┌──────────┐    ┌──────────┐
 *  │ Agent 9  │───▶│ Agent 10 │
 *  │ Scoring  │    │ Export   │
 *  └──────────┘    └──────────┘
 *
 * Coordination :
 *  - Orchestrateur central qui dispatch les tâches
 *  - Chaque agent reçoit le contexte accumulé des agents précédents
 *  - Communication par "shared state" (blackboard pattern)
 *  - Branches parallèles : Agent 5 et Agent 6 s'exécutent en parallèle après Agent 4
 *
 * Reprise sur erreur :
 *  - Retry par agent (3 tentatives, backoff exponentiel)
 *  - Fallback : si un agent échoue définitivement, l'orchestrateur décide :
 *    - Skip (continuer sans cet agent) si non critique
 *    - Abort (arrêter le pipeline) si critique
 *  - Checkpoint : l'état est sauvegardé après chaque agent → reprise possible
 *  - Circuit breaker : si un agent échoue 3 fois de suite, il est marqué "défaillant"
 */

import { randomUUID } from "crypto"

// ============================================================================
// TYPES
// ============================================================================

export type AgentId =
  | "sources"
  | "scraping"
  | "cleaning"
  | "dedup"
  | "enrichment"
  | "validation"
  | "geocoding"
  | "classification"
  | "scoring"
  | "export"

export type AgentStatus = "pending" | "running" | "completed" | "failed" | "skipped"

export interface AgentDefinition {
  id: AgentId
  number: number
  name: string
  role: string
  description: string
  inputs: string[]
  outputs: string[]
  dependencies: AgentId[]
  isParallel?: boolean
  isCritical: boolean // si true, échec = arrêt du pipeline
  maxRetries: number
  timeoutMs: number
  icon: string
  color: string
}

export interface AgentEvent {
  agentId: AgentId
  type: "start" | "progress" | "complete" | "error" | "retry" | "skip"
  message: string
  data?: Record<string, unknown>
  timestamp: string
}

export interface AgentResult {
  agentId: AgentId
  status: AgentStatus
  durationMs: number
  attempts: number
  result: Record<string, unknown>
  error?: string
}

export interface PipelineState {
  jobId: string
  query: string
  startedAt: string
  status: "running" | "completed" | "failed" | "partial"
  currentAgent: AgentId | null
  sharedData: Record<string, unknown>
  agentResults: Record<AgentId, AgentResult>
  events: AgentEvent[]
  totalDurationMs: number
  /**
   * Multi-tenant: org that owns this pipeline run. Mirrored from the
   * PipelineConfig so consumers (e.g. GET /api/v1/agents/[id]) can enforce
   * tenant isolation without reaching into the orchestrator's private config.
   */
  config?: { organizationId?: string | null; userId?: string | null }
}

export interface PipelineConfig {
  query: string
  city?: string
  commune?: string
  maxResults?: number
  skipAgents?: AgentId[]
  enableLLM?: boolean
  /**
   * Multi-tenant: org that owns this pipeline run. Thread-through only — used
   * when the export agent eventually persists Company rows so they're scoped
   * to the caller's org. null = global (OWNER only).
   */
  organizationId?: string | null
  /** User who launched the pipeline (audit). */
  userId?: string | null
}

// ============================================================================
// DÉFINITIONS DES 10 AGENTS
// ============================================================================

export const AGENT_DEFINITIONS: AgentDefinition[] = [
  {
    id: "sources",
    number: 1,
    name: "Agent Recherche de Sources",
    role: "Identifie et sélectionne les sources de données pertinentes",
    description:
      "Analyse la requête utilisateur, détermine les sources optimales (Google Maps, Facebook, LinkedIn, RCCM, annuaires), " +
      "construit les requêtes de recherche pour chaque source, et établit un plan de collecte.",
    inputs: ["Requête utilisateur", "Localisation (ville/commune)", "Critères (secteur, mots-clés)"],
    outputs: ["Liste des sources sélectionnées", "Requêtes de recherche par source", "Plan de collecte"],
    dependencies: [],
    isCritical: true,
    maxRetries: 3,
    timeoutMs: 30000,
    icon: "search",
    color: "#10b981",
  },
  {
    id: "scraping",
    number: 2,
    name: "Agent Scraping",
    role: "Collecte les données brutes depuis les sources identifiées",
    description:
      "Exécute le scraping multi-sources en parallèle, gère les rate limits, " +
      "détecte les blocages (CAPTCHA, 429), applique les proxies et rotations, " +
      "et collecte les données brutes (HTML, JSON, coordonnées GPS).",
    inputs: ["Liste des sources", "Requêtes de recherche", "Plan de collecte"],
    outputs: ["Données brutes par source", "Métadonnées (timestamps, URLs, statuts)", "Logs de scraping"],
    dependencies: ["sources"],
    isCritical: true,
    maxRetries: 3,
    timeoutMs: 300000,
    icon: "radar",
    color: "#3b82f6",
  },
  {
    id: "cleaning",
    number: 3,
    name: "Agent Nettoyage",
    role: "Normalise et corrige les données brutes",
    description:
      "Normalise les téléphones (+225 XX XX XX XX), corrige les emails (typos, domaines), " +
      "nettoie les noms (suffixes SARL/SA), uniformise les adresses (abréviations, communes), " +
      "et valide les formats (URL, RCCM, GPS).",
    inputs: ["Données brutes par source", "Logs de scraping"],
    outputs: ["Données normalisées", "Corrections appliquées", "Champs invalides marqués"],
    dependencies: ["scraping"],
    isCritical: true,
    maxRetries: 2,
    timeoutMs: 60000,
    icon: "sparkles",
    color: "#8b5cf6",
  },
  {
    id: "dedup",
    number: 4,
    name: "Agent Déduplication",
    role: "Détecte et fusionne les doublons",
    description:
      "Calcule les embeddings vectoriels (pgvector), compare par similarité (Jaro-Winkler + GPS haversine), " +
      "identifie les doublons par stratégie multi-critères (placeId, tél, email, site, nom+GPS), " +
      "et fusionne en conservant le meilleur champ de chaque source.",
    inputs: ["Données normalisées", "Corrections appliquées"],
    outputs: ["Entités uniques", "Groupes de doublons", "Score de fusion par entité"],
    dependencies: ["cleaning"],
    isCritical: true,
    maxRetries: 2,
    timeoutMs: 60000,
    icon: "git-merge",
    color: "#f97316",
  },
  {
    id: "enrichment",
    number: 5,
    name: "Agent Enrichissement",
    role: "Complète les champs manquants via IA",
    description:
      "Identifie les champs manquants (email, site web, description, horaires), " +
      "utilise le LLM z-ai pour déduire/compléter, scrape les sites web pour extraire emails, " +
      "et génère des descriptions à partir du nom + secteur.",
    inputs: ["Entités uniques"],
    outputs: ["Entités enrichies", "Champs complétés par IA", "Confiance par complétion"],
    dependencies: ["dedup"],
    isParallel: true,
    isCritical: false,
    maxRetries: 2,
    timeoutMs: 120000,
    icon: "brain",
    color: "#06b6d4",
  },
  {
    id: "validation",
    number: 6,
    name: "Agent Validation",
    role: "Vérifie la qualité et la cohérence des données",
    description:
      "Valide les emails (syntaxe + domaine MX), vérifie les téléphones (format +225), " +
      "contrôle les URLs (accessibilité HTTP), détecte les entreprises fermées (mots-clés, note faible), " +
      "et marque les données invalides ou suspectes.",
    inputs: ["Entités uniques"],
    outputs: ["Entités validées", "Liste des invalides", "Indicateurs de fermeture"],
    dependencies: ["dedup"],
    isParallel: true,
    isCritical: false,
    maxRetries: 2,
    timeoutMs: 90000,
    icon: "shield-check",
    color: "#ef4444",
  },
  {
    id: "geocoding",
    number: 7,
    name: "Agent Géocodage",
    role: "Convertit les adresses en coordonnées GPS",
    description:
      "Géocode les adresses via OpenStreetMap Nominatim, complète les GPS manquants, " +
      "valide les coordonnées (bounds Côte d'Ivoire), et construit les liens Google Maps. " +
      "Reçoit les données fusionnées de l'enrichissement + validation.",
    inputs: ["Entités enrichies", "Entités validées"],
    outputs: ["Coordonnées GPS complètes", "Liens Google Maps", "Précision de géocodage"],
    dependencies: ["enrichment", "validation"],
    isCritical: false,
    maxRetries: 2,
    timeoutMs: 60000,
    icon: "map-pin",
    color: "#84cc16",
  },
  {
    id: "classification",
    number: 8,
    name: "Agent Classification",
    role: "Détecte le secteur d'activité de chaque entreprise",
    description:
      "Utilise un modèle hybride (règles + LLM z-ai) pour classifier chaque entreprise " +
      "dans un des 18 secteurs normalisés (Restauration, Santé, BTP, Télécom, etc.), " +
      "extrait les mots-clés du secteur, et calcule un code secteur (NSE/NACE).",
    inputs: ["Coordonnées GPS complètes", "Entités enrichies"],
    outputs: ["Secteur détecté par entité", "Code secteur", "Mots-clés", "Confiance de classification"],
    dependencies: ["geocoding"],
    isCritical: false,
    maxRetries: 2,
    timeoutMs: 60000,
    icon: "tag",
    color: "#ec4899",
  },
  {
    id: "scoring",
    number: 9,
    name: "Agent Scoring",
    role: "Calcule le score de qualité de chaque entreprise",
    description:
      "Évalue 7 dimensions (complétude, validité contacts, qualité nom, précision géo, " +
      "fiabilité source, fraîcheur, présence online) avec pondérations, " +
      "calcule le score global (0-100), et catégorise (A/B/C/D).",
    inputs: ["Secteur détecté", "Entités enrichies + validées + géocodées"],
    outputs: ["Score global par entité", "Détail par dimension", "Catégorie qualité (A/B/C/D)"],
    dependencies: ["classification"],
    isCritical: false,
    maxRetries: 1,
    timeoutMs: 30000,
    icon: "gauge",
    color: "#f59e0b",
  },
  {
    id: "export",
    number: 10,
    name: "Agent Export",
    role: "Génère les fichiers d'export et notifie",
    description:
      "Génère les exports multi-formats (Excel, CSV, JSON, PDF, ZIP), " +
      "envoie les notifications (email, webhook), crée les entrées d'audit, " +
      "et met à jour les statistiques du dashboard.",
    inputs: ["Scores finaux", "Toutes les données enrichies"],
    outputs: ["Fichiers d'export", "Notifications envoyées", "Logs d'audit"],
    dependencies: ["scoring"],
    isCritical: false,
    maxRetries: 2,
    timeoutMs: 60000,
    icon: "download",
    color: "#a16207",
  },
]

// ============================================================================
// ORCHESTRATEUR
// ============================================================================

type AgentProcessor = (state: PipelineState, config: PipelineConfig) => Promise<Record<string, unknown>>

const processors: Map<AgentId, AgentProcessor> = new Map()

export function registerProcessor(agentId: AgentId, processor: AgentProcessor) {
  processors.set(agentId, processor)
}

export class PipelineOrchestrator {
  private state: PipelineState
  private config: PipelineConfig
  private listeners: ((event: AgentEvent) => void)[] = []
  private checkpoints: Map<AgentId, PipelineState> = new Map()

  constructor(jobId: string, config: PipelineConfig) {
    this.config = config
    this.state = {
      jobId,
      query: config.query,
      startedAt: new Date().toISOString(),
      status: "running",
      currentAgent: null,
      sharedData: {},
      agentResults: {} as Record<AgentId, AgentResult>,
      events: [],
      totalDurationMs: 0,
      // Mirror the tenant context so GET /api/v1/agents/[id] can enforce
      // isolation without reaching into the orchestrator's private config.
      config: {
        organizationId: config.organizationId ?? null,
        userId: config.userId ?? null,
      },
    }
  }

  on(listener: (event: AgentEvent) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private emit(event: AgentEvent) {
    this.state.events.push(event)
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch {}
    }
  }

  getState(): PipelineState {
    return { ...this.state }
  }

  /**
   * Exécute le pipeline complet
   */
  async run(): Promise<PipelineState> {
    const startTime = Date.now()

    // Définit l'ordre d'exécution avec branches parallèles
    const phases: AgentId[][] = [
      ["sources"],         // Phase 1 : Agent 1
      ["scraping"],        // Phase 2 : Agent 2
      ["cleaning"],        // Phase 3 : Agent 3
      ["dedup"],           // Phase 4 : Agent 4
      ["enrichment", "validation"], // Phase 5 : Agents 5+6 en parallèle
      ["geocoding"],       // Phase 6 : Agent 7 (attend 5+6)
      ["classification"],  // Phase 7 : Agent 8
      ["scoring"],         // Phase 8 : Agent 9
      ["export"],          // Phase 9 : Agent 10
    ]

    for (const phase of phases) {
      // Filtre les agents skipés
      const agentsToRun = phase.filter((id) => !this.config.skipAgents?.includes(id))

      if (agentsToRun.length === 0) continue

      // Exécute les agents de la phase (en parallèle si plusieurs)
      if (agentsToRun.length === 1) {
        await this.runAgent(agentsToRun[0])
      } else {
        await Promise.all(agentsToRun.map((id) => this.runAgent(id)))
      }

      // Si un agent critique a échoué, arrête le pipeline
      const failed = agentsToRun.find((id) => {
        const result = this.state.agentResults[id]
        return result?.status === "failed" && AGENT_DEFINITIONS.find((a) => a.id === id)?.isCritical
      })

      if (failed) {
        this.state.status = "failed"
        this.emit({
          agentId: failed,
          type: "error",
          message: `Pipeline arrêté : agent critique "${failed}" a échoué`,
          timestamp: new Date().toISOString(),
        })
        break
      }
    }

    this.state.status = this.state.status === "failed" ? "failed" : "completed"
    this.state.totalDurationMs = Date.now() - startTime
    this.state.currentAgent = null

    return this.getState()
  }

  /**
   * Exécute un agent avec retry et checkpoint
   */
  private async runAgent(agentId: AgentId): Promise<void> {
    const def = AGENT_DEFINITIONS.find((a) => a.id === agentId)!
    const processor = processors.get(agentId)

    if (!processor) {
      this.state.agentResults[agentId] = {
        agentId,
        status: "skipped",
        durationMs: 0,
        attempts: 0,
        result: {},
        error: "Processor not registered",
      }
      return
    }

    this.state.currentAgent = agentId
    this.emit({
      agentId,
      type: "start",
      message: `Agent ${def.number} — ${def.name} démarré`,
      timestamp: new Date().toISOString(),
    })

    let attempts = 0
    let lastError: string | undefined

    while (attempts < def.maxRetries + 1) {
      attempts++
      const agentStart = Date.now()

      try {
        this.emit({
          agentId,
          type: attempts > 1 ? "retry" : "progress",
          message: attempts > 1
            ? `Tentative ${attempts}/${def.maxRetries + 1} — ${def.name}`
            : `Traitement en cours…`,
          timestamp: new Date().toISOString(),
          data: { attempt: attempts },
        })

        // Exécute avec timeout
        const result = await this.withTimeout(
          processor(this.state, this.config),
          def.timeoutMs
        )

        const durationMs = Date.now() - agentStart

        // Fusionne le résultat dans le shared data
        this.state.sharedData = { ...this.state.sharedData, ...result }

        // Checkpoint : sauvegarde l'état après cet agent
        this.checkpoints.set(agentId, JSON.parse(JSON.stringify(this.state)))

        this.state.agentResults[agentId] = {
          agentId,
          status: "completed",
          durationMs,
          attempts,
          result,
        }

        this.emit({
          agentId,
          type: "complete",
          message: `Agent ${def.number} terminé en ${durationMs}ms`,
          timestamp: new Date().toISOString(),
          data: { durationMs, result },
        })

        return // Succès
      } catch (err) {
        lastError = (err as Error).message
        const durationMs = Date.now() - agentStart

        this.emit({
          agentId,
          type: "error",
          message: `Tentative ${attempts} échouée: ${lastError}`,
          timestamp: new Date().toISOString(),
          data: { attempt: attempts, error: lastError, durationMs },
        })

        // Backoff exponentiel
        if (attempts < def.maxRetries + 1) {
          const backoffMs = 1000 * Math.pow(2, attempts - 1)
          await new Promise((r) => setTimeout(r, backoffMs))
        }
      }
    }

    // Toutes les tentatives ont échoué
    const def2 = AGENT_DEFINITIONS.find((a) => a.id === agentId)!
    if (def2.isCritical) {
      this.state.agentResults[agentId] = {
        agentId,
        status: "failed",
        durationMs: 0,
        attempts,
        result: {},
        error: lastError,
      }
    } else {
      // Agent non critique → skip et continue
      this.state.agentResults[agentId] = {
        agentId,
        status: "skipped",
        durationMs: 0,
        attempts,
        result: {},
        error: lastError,
      }
      this.emit({
        agentId,
        type: "skip",
        message: `Agent ${def2.number} ignoré (non critique) — pipeline continue`,
        timestamp: new Date().toISOString(),
      })
    }
  }

  /**
   * Wrapper avec timeout
   */
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout après ${ms}ms`)), ms)
      ),
    ])
  }

  /**
   * Reprise depuis un checkpoint
   */
  async resumeFrom(agentId: AgentId): Promise<PipelineState> {
    const checkpoint = this.checkpoints.get(agentId)
    if (!checkpoint) {
      throw new Error(`Aucun checkpoint pour l'agent "${agentId}"`)
    }
    this.state = checkpoint
    this.emit({
      agentId,
      type: "start",
      message: `Reprise depuis le checkpoint de l'agent ${agentId}`,
      timestamp: new Date().toISOString(),
    })
    return this.run()
  }
}
